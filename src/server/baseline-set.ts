import { parseWithContext } from "../cli/score.js";
import { parseCsv } from "../io/csv.js";
import { submissionSchema, type Submission } from "../types/submission.js";

export type BaselineUploadFormat = "json" | "csv";

const CSV_COLUMNS = ["id", "headline", "body", "perspective"] as const;

export const validateBaselineSet = (
  baselines: readonly Submission[],
  reservedIds: readonly string[] = [],
): Submission[] => {
  const validated = parseWithContext(
    submissionSchema.array().min(1, "At least one baseline submission is required"),
    baselines,
    "Baseline set",
  );

  const seen = new Set<string>();
  for (const { id } of validated) {
    if (seen.has(id)) {
      throw new Error(`Duplicate baseline submission ID: ${id}`);
    }
    if (reservedIds.includes(id)) {
      throw new Error(`Baseline submission ID is reserved: ${id}`);
    }
    seen.add(id);
  }

  return validated;
};

const parseCsvSubmissions = (content: string): unknown[] => {
  const [header, ...rows] = parseCsv(content);
  if (!header) {
    throw new Error("CSV upload is empty");
  }

  const columns = header.map((name) => name.trim().toLowerCase());
  const missing = CSV_COLUMNS.filter((name) => !columns.includes(name));
  if (missing.length > 0) {
    throw new Error(
      `CSV header must include ${CSV_COLUMNS.join(", ")} (missing: ${missing.join(", ")})`,
    );
  }

  return rows.map((cells) =>
    Object.fromEntries(
      CSV_COLUMNS.map((name) => [name, cells[columns.indexOf(name)] ?? ""]),
    ),
  );
};

export const parseBaselineUpload = (
  format: BaselineUploadFormat,
  content: string,
  reservedIds: readonly string[] = [],
): Submission[] => {
  let records: unknown;
  if (format === "json") {
    try {
      records = JSON.parse(content);
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : "";
      throw new Error(`JSON upload is not valid JSON${detail}`);
    }
  } else {
    records = parseCsvSubmissions(content);
  }

  if (!Array.isArray(records)) {
    throw new Error("Upload must contain an array of submissions");
  }

  return validateBaselineSet(records as Submission[], reservedIds);
};

export const nextBaselineId = (baselines: readonly Submission[]): string => {
  const ids = new Set(baselines.map(({ id }) => id));
  let index = 1;
  while (ids.has(`custom-${String(index).padStart(3, "0")}`)) {
    index += 1;
  }
  return `custom-${String(index).padStart(3, "0")}`;
};
