import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse,
} from "node:http";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  loadProjectData,
  parseWithContext,
  readJsonFile,
} from "../cli/score.js";
import { LocalEmbeddingProvider } from "../embeddings/local-embedding-provider.js";
import { EVALUATION_SCORING_CONFIG } from "../evaluation/config.js";
import { DEMO_CASE_IDS } from "../evaluation/markdown.js";
import {
  appendScoreLog,
  baselineFingerprint,
  DEFAULT_SCORE_LOG_PATH,
  type ScoreRunEntry,
} from "../io/score-log.js";
import { neighborHeadlines, NoveltyScorer } from "../scoring/novelty-scorer.js";
import type { PreparedScoringContext } from "../scoring/prepare-scoring-context.js";
import { labeledEvaluationCasesSchema } from "../types/evaluation.js";
import type { FixedContent } from "../types/fixed-content.js";
import {
  PERSPECTIVES,
  submissionSchema,
  type Submission,
} from "../types/submission.js";
import {
  nextBaselineId,
  parseBaselineUpload,
  validateBaselineSet,
  type BaselineUploadFormat,
} from "./baseline-set.js";

export const UI_CANDIDATE_ID = "ui-candidate";

const PRESET_CASES = [
  { label: "Exact duplicate", caseId: "eval-duplicate-001" },
  { label: "Semantic paraphrase", caseId: DEMO_CASE_IDS.paraphrase },
  { label: "Novel + relevant", caseId: DEMO_CASE_IDS.novelRelevant },
  { label: "Novel + irrelevant", caseId: DEMO_CASE_IDS.novelIrrelevant },
] as const;

export interface Preset {
  label: string;
  caseId: string;
  headline: string;
  body: string;
  perspective: Submission["perspective"];
}

export interface DevServerOptions {
  scorer: NoveltyScorer;
  fixedContent: FixedContent;
  baselines: readonly Submission[];
  presets: readonly Preset[];
  html: string;
  logRun?: (entry: ScoreRunEntry) => Promise<void>;
}

interface BaselineState {
  baselines: Submission[];
  prepared: PreparedScoringContext;
}

const MAX_BODY_BYTES = 2 * 1024 * 1024;

class ClientError extends Error {}

class PayloadTooLargeError extends ClientError {}

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// Runs input parsing/validation and reports any failure as a 400.
const clientInput = <T>(parse: () => T): T => {
  try {
    return parse();
  } catch (error) {
    throw error instanceof ClientError ? error : new ClientError(errorMessage(error));
  }
};

const sendJson = (
  response: ServerResponse,
  status: number,
  payload: unknown,
): void => {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
};

const readJsonBody = async (
  request: IncomingMessage,
): Promise<Record<string, unknown>> => {
  let size = 0;
  const chunks: Buffer[] = [];
  // An oversized body is still read to the end (and discarded): leaving it
  // unread would corrupt the next request on the same kept-alive connection.
  for await (const chunk of request) {
    size += (chunk as Buffer).length;
    if (size <= MAX_BODY_BYTES) {
      chunks.push(chunk as Buffer);
    }
  }
  if (size > MAX_BODY_BYTES) {
    throw new PayloadTooLargeError("Request body is too large (limit 2 MB)");
  }

  const parsed = clientInput(() =>
    JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown,
  );
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new ClientError("Request body must be a JSON object");
  }
  return parsed as Record<string, unknown>;
};

export const createDevServerHandler = async (
  options: DevServerOptions,
): Promise<RequestListener> => {
  const { scorer, fixedContent, presets, html, logRun } = options;
  const reservedIds = [UI_CANDIDATE_ID, fixedContent.id];
  const originalBaselines = validateBaselineSet(options.baselines, reservedIds);

  let state: BaselineState = {
    baselines: originalBaselines,
    prepared: await scorer.prepare(fixedContent, originalBaselines),
  };

  // Baseline edits are applied one at a time; scoring always reads a
  // consistent snapshot of the baselines and their prepared embeddings.
  let pendingChange: Promise<unknown> = Promise.resolve();
  const changeBaselines = (
    update: (current: Submission[]) => Submission[],
  ): Promise<void> => {
    const apply = async (): Promise<void> => {
      const next = clientInput(() => validateBaselineSet(update(state.baselines), reservedIds));
      state = { baselines: next, prepared: await scorer.prepare(fixedContent, next) };
    };
    const change = pendingChange.then(apply, apply);
    pendingChange = change.catch(() => undefined);
    return change;
  };

  const baselinePayload = () => ({
    baselines: state.baselines,
    fingerprint: baselineFingerprint(state.baselines),
    isOriginal:
      baselineFingerprint(state.baselines) === baselineFingerprint(originalBaselines),
  });

  const handleScore = async (request: IncomingMessage) => {
    const input = await readJsonBody(request);
    // The UI sends only the editable fields; the server supplies the candidate ID.
    const candidate = clientInput(() =>
      parseWithContext(
        submissionSchema,
        {
          id: UI_CANDIDATE_ID,
          headline: input.headline,
          body: input.body,
          perspective: input.perspective,
        },
        "Candidate",
      ),
    );

    const { baselines, prepared } = state;
    const result = await scorer.score(candidate, prepared);

    await logRun?.({ source: "ui", candidate, result, baselines }).catch(
      (error: unknown) => console.warn(`Could not log score run: ${errorMessage(error)}`),
    );

    const headlines = neighborHeadlines(baselines, fixedContent);
    return {
      ...result,
      nearestNeighbors: result.nearestNeighbors.map((neighbor) => ({
        ...neighbor,
        headline: headlines.get(neighbor.submissionId) ?? null,
      })),
    };
  };

  const handleAddBaseline = async (request: IncomingMessage) => {
    const input = await readJsonBody(request);
    await changeBaselines((current) => {
      const id =
        typeof input.id === "string" && input.id.trim() !== ""
          ? input.id
          : nextBaselineId(current);
      return [
        ...current,
        { id, headline: input.headline, body: input.body, perspective: input.perspective } as Submission,
      ];
    });
    return baselinePayload();
  };

  const handleReplaceBaselines = async (request: IncomingMessage) => {
    const input = await readJsonBody(request);
    const format = input.format;
    if (format !== "json" && format !== "csv") {
      throw new ClientError('Upload format must be "json" or "csv"');
    }
    if (typeof input.content !== "string") {
      throw new ClientError("Upload content must be a string");
    }
    const uploaded = clientInput(() =>
      parseBaselineUpload(format as BaselineUploadFormat, input.content as string, reservedIds),
    );
    await changeBaselines(() => uploaded);
    return baselinePayload();
  };

  // Removes all IDs in one change, or none if any ID is unknown or the set would be empty.
  const removeBaselines = async (ids: readonly string[]) => {
    await changeBaselines((current) => {
      const missing = ids.filter((id) => !current.some((submission) => submission.id === id));
      if (missing.length > 0) {
        throw new ClientError(`Baseline submission not found: ${missing.join(", ")}`);
      }
      return current.filter((submission) => !ids.includes(submission.id));
    });
    return baselinePayload();
  };

  const handleRemoveSelected = async (request: IncomingMessage) => {
    const { ids } = await readJsonBody(request);
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.some((id) => typeof id !== "string")
    ) {
      throw new ClientError("ids must be a non-empty array of submission IDs");
    }
    return removeBaselines(ids as string[]);
  };

  const routes: Array<{
    method: string;
    match: (pathname: string) => string[] | null;
    handle: (request: IncomingMessage, params: string[]) => Promise<unknown>;
  }> = [
    {
      method: "GET",
      match: (path) => (path === "/api/presets" ? [] : null),
      handle: async () => ({ perspectives: PERSPECTIVES, presets }),
    },
    {
      method: "GET",
      match: (path) => (path === "/api/baselines" ? [] : null),
      handle: async () => baselinePayload(),
    },
    {
      method: "POST",
      match: (path) => (path === "/api/baselines" ? [] : null),
      handle: handleAddBaseline,
    },
    {
      method: "PUT",
      match: (path) => (path === "/api/baselines" ? [] : null),
      handle: handleReplaceBaselines,
    },
    {
      method: "POST",
      match: (path) => (path === "/api/baselines/reset" ? [] : null),
      handle: async () => {
        await changeBaselines(() => originalBaselines);
        return baselinePayload();
      },
    },
    {
      method: "DELETE",
      match: (path) => {
        const found = /^\/api\/baselines\/([^/]+)$/u.exec(path);
        return found ? [decodeURIComponent(found[1])] : null;
      },
      handle: (_request, [id]) => removeBaselines([id]),
    },
    {
      method: "POST",
      match: (path) => (path === "/api/baselines/remove" ? [] : null),
      handle: handleRemoveSelected,
    },
    {
      method: "POST",
      match: (path) => (path === "/api/score" ? [] : null),
      handle: handleScore,
    },
  ];

  return (request, response) => {
    const { pathname } = new URL(request.url ?? "/", "http://localhost");

    if (request.method === "GET" && pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
      return;
    }

    for (const route of routes) {
      const params = request.method === route.method ? route.match(pathname) : null;
      if (params) {
        route
          .handle(request, params)
          .then((payload) => sendJson(response, 200, payload))
          .catch((error: unknown) => {
            const status =
              error instanceof PayloadTooLargeError ? 413 : error instanceof ClientError ? 400 : 500;
            sendJson(response, status, {
              error: errorMessage(error),
            });
          });
        return;
      }
    }

    sendJson(response, 404, { error: "Not found" });
  };
};

const loadPresets = async (): Promise<Preset[]> => {
  const cases = parseWithContext(
    labeledEvaluationCasesSchema,
    await readJsonFile(resolve("data/labeled-cases.json"), "labeled-case data"),
    "Labeled-case data",
  );

  return PRESET_CASES.map(({ label, caseId }) => {
    const found = cases.find(({ id }) => id === caseId);
    if (!found) {
      throw new Error(`Preset evaluation case not found: ${caseId}`);
    }
    const { headline, body, perspective } = found.candidate;
    return { label, caseId, headline, body, perspective };
  });
};

const startDevServer = async (): Promise<void> => {
  const port = Number(process.env.PORT ?? 3000);
  const htmlPath = fileURLToPath(new URL("./index.html", import.meta.url));

  console.log("Loading data and embedding model...");
  const [{ fixedContent, baselines }, presets, html] = await Promise.all([
    loadProjectData(),
    loadPresets(),
    readFile(htmlPath, "utf8"),
  ]);

  const scorer = new NoveltyScorer(
    new LocalEmbeddingProvider(),
    EVALUATION_SCORING_CONFIG,
  );
  const handler = await createDevServerHandler({
    scorer,
    fixedContent,
    baselines,
    presets,
    html,
    logRun: (entry) => appendScoreLog(entry),
  });

  const server = createServer(handler);
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(
      error.code === "EADDRINUSE"
        ? `Dev server failed: port ${port} is already in use. Stop the other server or choose another port with the PORT environment variable.`
        : `Dev server failed: ${error.message}`,
    );
    process.exitCode = 1;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`Novelty demo ready at http://localhost:${port}`);
    console.log(`Score runs are logged to ${relative(process.cwd(), DEFAULT_SCORE_LOG_PATH)}`);
  });
};

const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  startDevServer().catch((error: unknown) => {
    console.error(`Dev server failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  });
}
