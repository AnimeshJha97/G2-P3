import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  type EmbeddingProvider,
  EVALUATION_SCORING_CONFIG,
  NoveltyScorer,
  type Submission,
} from "../src/index.js";
import type { ScoreRunEntry } from "../src/io/score-log.js";
import {
  createDevServerHandler,
  type Preset,
} from "../src/server/dev-server.js";

// Deterministic fake embeddings: texts mentioning "garden" point away from
// the fixed content; everything else points along it.
class FakeEmbeddingProvider implements EmbeddingProvider {
  public async embed(text: string): Promise<number[]> {
    return text.toLowerCase().includes("garden") ? [0, 1] : [1, 0.1];
  }

  public async embedMany(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((text) => this.embed(text)));
  }
}

const baselines: Submission[] = [
  { id: "b1", headline: "Faster handoffs", body: "Automatic summaries speed up case handoffs.", perspective: "support" },
  { id: "b2", headline: "Retention controls", body: "Admins need configurable deletion windows for summaries.", perspective: "concern" },
  { id: "b3", headline: "Audit access", body: "Log who views each generated summary.", perspective: "suggestion" },
  { id: "b4", headline: "Language support", body: "Provide summaries in many customer languages.", perspective: "question" },
];

const presets: Preset[] = [
  { label: "Exact duplicate", caseId: "case-1", headline: "Faster handoffs", body: "Automatic summaries speed up case handoffs.", perspective: "support" },
];

const loggedRuns: ScoreRunEntry[] = [];
let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const handler = await createDevServerHandler({
    scorer: new NoveltyScorer(new FakeEmbeddingProvider(), EVALUATION_SCORING_CONFIG),
    fixedContent: { id: "source", body: "Automatic conversation summaries for support agents." },
    baselines,
    presets,
    html: "<html>ok</html>",
    logRun: async (entry) => {
      loggedRuns.push(entry);
    },
  });
  server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const send = (method: string, path: string, payload?: unknown) =>
  fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });

const baselineIds = async (): Promise<string[]> =>
  (await (await send("GET", "/api/baselines")).json()).baselines.map(
    ({ id }: Submission) => id,
  );

describe("dev server", () => {
  beforeEach(async () => {
    await send("POST", "/api/baselines/reset");
    loggedRuns.length = 0;
  });

  it("serves the page, presets, and the original baseline set", async () => {
    expect(await (await fetch(`${baseUrl}/`)).text()).toBe("<html>ok</html>");

    const presetBody = await (await send("GET", "/api/presets")).json();
    expect(presetBody.presets).toEqual(presets);
    expect(presetBody.perspectives).toContain("suggestion");

    const baselineBody = await (await send("GET", "/api/baselines")).json();
    expect(baselineBody.baselines).toEqual(baselines);
    expect(baselineBody.isOriginal).toBe(true);
    expect(baselineBody.fingerprint).toMatch(/^[0-9a-f]{12}$/u);
  });

  it("returns the scorer result with top-3 neighbor headlines and logs the run", async () => {
    const response = await send("POST", "/api/score", {
      headline: "Faster handoffs",
      body: "Automatic summaries speed up case handoffs.",
      perspective: "support",
    });
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.lexical.novelty).toBe(0);
    expect(result.relevance.gate).toBe(1);
    expect(result.nearestNeighbors).toHaveLength(3);
    expect(result.nearestNeighbors[0].headline).toEqual(expect.any(String));

    expect(loggedRuns).toHaveLength(1);
    expect(loggedRuns[0]).toMatchObject({
      source: "ui",
      candidate: { id: "ui-candidate", headline: "Faster handoffs" },
      baselines,
    });
    expect(loggedRuns[0].result.finalScore).toBe(result.finalScore);
  });

  it("gates an irrelevant candidate to zero", async () => {
    const result = await (
      await send("POST", "/api/score", {
        headline: "Garden planner",
        body: "Plan garden beds by season.",
        perspective: "suggestion",
      })
    ).json();
    expect(result.relevance.gate).toBe(0);
    expect(result.finalScore).toBe(0);
  });

  it("rejects invalid candidates with 400 and does not log them", async () => {
    const empty = await send("POST", "/api/score", { headline: " ", body: "x", perspective: "support" });
    expect(empty.status).toBe(400);
    expect((await empty.json()).error).toContain("Headline is required");

    expect((await send("POST", "/api/score", { headline: "h", body: "b", perspective: "rant" })).status).toBe(400);
    expect((await fetch(`${baseUrl}/api/score`, { method: "POST", body: "{" })).status).toBe(400);
    expect(loggedRuns).toHaveLength(0);
  });

  it("rejects content-free and over-long candidates", async () => {
    for (const body of ["ok", "🚀 🔥 ✨ 🎉 💡", "!!! ??? ... --- ***", "Too short to count."]) {
      const response = await send("POST", "/api/score", { headline: "Idea", body, perspective: "support" });
      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("at least 5 words");
    }

    const emojiHeadline = await send("POST", "/api/score", { headline: "🚀", body: "A valid body with enough words.", perspective: "support" });
    expect(emojiHeadline.status).toBe(400);
    expect((await emojiHeadline.json()).error).toContain("Headline must contain");

    const words = (count: number) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
    const tooLong = await send("POST", "/api/score", { headline: "Five words in this headline", body: words(96), perspective: "support" });
    expect(tooLong.status).toBe(400);
    expect((await tooLong.json()).error).toContain("at most 100 words");

    const atLimit = await send("POST", "/api/score", { headline: "Five words in this headline", body: words(95), perspective: "support" });
    expect(atLimit.status).toBe(200);
  });

  it("adds, removes, and resets baseline submissions", async () => {
    const added = await send("POST", "/api/baselines", {
      headline: "Garden tips",
      body: "Water the garden beds every week.",
      perspective: "suggestion",
    });
    expect(added.status).toBe(200);
    const addedBody = await added.json();
    expect(addedBody.isOriginal).toBe(false);
    expect(await baselineIds()).toEqual(["b1", "b2", "b3", "b4", "custom-001"]);

    // The new baseline is used for scoring immediately.
    const result = await (
      await send("POST", "/api/score", {
        headline: "Garden tips",
        body: "Water the garden beds every week.",
        perspective: "suggestion",
      })
    ).json();
    expect(result.nearestNeighbors[0].submissionId).toBe("custom-001");
    expect(loggedRuns.at(-1)?.baselines).toHaveLength(5);

    expect((await send("DELETE", "/api/baselines/b2")).status).toBe(200);
    expect(await baselineIds()).toEqual(["b1", "b3", "b4", "custom-001"]);

    const reset = await (await send("POST", "/api/baselines/reset")).json();
    expect(reset.isOriginal).toBe(true);
    expect(await baselineIds()).toEqual(["b1", "b2", "b3", "b4"]);
  });

  it("rejects invalid baseline edits", async () => {
    const duplicate = await send("POST", "/api/baselines", {
      id: "b1",
      headline: "h",
      body: "A valid body with enough words.",
      perspective: "support",
    });
    expect(duplicate.status).toBe(400);
    expect((await duplicate.json()).error).toContain("Duplicate baseline submission ID: b1");

    expect(
      (await send("POST", "/api/baselines", { id: "ui-candidate", headline: "h", body: "A valid body with enough words.", perspective: "support" })).status,
    ).toBe(400);
    expect((await send("DELETE", "/api/baselines/missing")).status).toBe(400);

    for (const id of ["b1", "b2", "b3"]) {
      await send("DELETE", `/api/baselines/${id}`);
    }
    const last = await send("DELETE", "/api/baselines/b4");
    expect(last.status).toBe(400);
    expect((await last.json()).error).toContain("At least one baseline");
    expect(await baselineIds()).toEqual(["b4"]);

    const fixedContentId = await send("POST", "/api/baselines", { id: "source", headline: "h", body: "A valid body with enough words.", perspective: "support" });
    expect(fixedContentId.status).toBe(400);
    expect((await fixedContentId.json()).error).toContain("reserved");
  });

  it("removes several selected baselines in one change", async () => {
    const removed = await send("POST", "/api/baselines/remove", { ids: ["b1", "b3"] });
    expect(removed.status).toBe(200);
    expect(await baselineIds()).toEqual(["b2", "b4"]);

    // All-or-nothing: an unknown ID or emptying the set leaves the set unchanged.
    const unknown = await send("POST", "/api/baselines/remove", { ids: ["b2", "missing"] });
    expect(unknown.status).toBe(400);
    expect((await unknown.json()).error).toContain("missing");
    expect((await send("POST", "/api/baselines/remove", { ids: ["b2", "b4"] })).status).toBe(400);
    expect((await send("POST", "/api/baselines/remove", { ids: [] })).status).toBe(400);
    expect(await baselineIds()).toEqual(["b2", "b4"]);
  });

  it("replaces the baseline set from JSON and CSV uploads", async () => {
    const json = await send("PUT", "/api/baselines", {
      format: "json",
      content: JSON.stringify([
        { id: "j1", headline: "Json one", body: "First uploaded body with enough words.", perspective: "support" },
      ]),
    });
    expect(json.status).toBe(200);
    expect(await baselineIds()).toEqual(["j1"]);

    const csv = await send("PUT", "/api/baselines", {
      format: "csv",
      content: 'id,headline,body,perspective\nc1,Csv one,"Has, a comma in the body",concern\nc2,Csv two,Second body has five words,question\n',
    });
    expect(csv.status).toBe(200);
    expect((await csv.json()).baselines[0]).toEqual({
      id: "c1",
      headline: "Csv one",
      body: "Has, a comma in the body",
      perspective: "concern",
    });
    expect(await baselineIds()).toEqual(["c1", "c2"]);

    const invalid = await send("PUT", "/api/baselines", { format: "csv", content: "id,headline\nx,y\n" });
    expect(invalid.status).toBe(400);
    expect(await baselineIds()).toEqual(["c1", "c2"]);
  });

  it("rejects oversized bodies without breaking the next request", async () => {
    const tooLarge = await fetch(`${baseUrl}/api/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(3 * 1024 * 1024),
    });
    expect(tooLarge.status).toBe(413);
    expect((await tooLarge.json()).error).toContain("too large");

    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await send("GET", "/api/baselines")).status).toBe(200);
    }
  });

  it("returns 404 for unknown routes", async () => {
    expect((await fetch(`${baseUrl}/nope`)).status).toBe(404);
  });
});
