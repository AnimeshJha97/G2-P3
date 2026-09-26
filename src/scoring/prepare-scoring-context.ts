import type { EmbeddingProvider } from "../embeddings/embedding-provider.js";
import { toFixedContentText, toSemanticText } from "../text/canonicalize.js";
import {
  fixedContentSchema,
  type FixedContent,
} from "../types/fixed-content.js";
import { submissionSchema, type Submission } from "../types/submission.js";

export interface EmbeddedSubmission {
  submission: Submission;
  vector: number[];
}

export interface PreparedScoringContext {
  fixedContent: FixedContent;
  fixedContentEmbedding: number[];
  baselines: EmbeddedSubmission[];
}

const assertValidEmbedding = (vector: readonly number[], label: string): void => {
  if (
    vector.length === 0 ||
    vector.some((value) => !Number.isFinite(value))
  ) {
    throw new Error(`${label} must be a non-empty finite vector`);
  }
};

export const prepareScoringContext = async (
  fixedContent: FixedContent,
  baselineSubmissions: readonly Submission[],
  embeddingProvider: EmbeddingProvider,
): Promise<PreparedScoringContext> => {
  const validatedFixedContent = fixedContentSchema.parse(fixedContent);

  if (baselineSubmissions.length === 0) {
    throw new Error("At least one baseline submission is required");
  }

  const validatedBaselines = baselineSubmissions.map((submission) =>
    submissionSchema.parse(submission),
  );

  // The fixed content ID also identifies it as a comparison neighbor.
  if (validatedBaselines.some(({ id }) => id === validatedFixedContent.id)) {
    throw new Error("Baseline submission IDs must not match the fixed content ID");
  }

  const [fixedContentEmbedding, baselineEmbeddings] = await Promise.all([
    embeddingProvider.embed(toFixedContentText(validatedFixedContent)),
    embeddingProvider.embedMany(validatedBaselines.map(toSemanticText)),
  ]);

  if (baselineEmbeddings.length !== validatedBaselines.length) {
    throw new Error("Embedding provider returned an unexpected baseline count");
  }

  assertValidEmbedding(fixedContentEmbedding, "Fixed-content embedding");
  baselineEmbeddings.forEach((vector, index) => {
    assertValidEmbedding(vector, `Baseline embedding at index ${index}`);
  });

  const embeddingDimension = fixedContentEmbedding.length;
  if (baselineEmbeddings.some((vector) => vector.length !== embeddingDimension)) {
    throw new Error("Prepared embedding dimensions do not match");
  }

  return {
    fixedContent: validatedFixedContent,
    fixedContentEmbedding: [...fixedContentEmbedding],
    baselines: validatedBaselines.map((submission, index) => ({
      submission,
      vector: [...baselineEmbeddings[index]],
    })),
  };
};
