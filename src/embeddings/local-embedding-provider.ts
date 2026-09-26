import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

import type { EmbeddingProvider } from "./embedding-provider.js";

export const DEFAULT_LOCAL_EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

const copyVector = (vector: readonly number[]): number[] => [...vector];

const validateTexts = (texts: readonly string[]): void => {
  for (const text of texts) {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new Error("Embedding text must be a non-empty string");
    }
  }
};

const toVectors = (value: unknown, expectedCount: number): number[][] => {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error("Embedding model returned an unexpected batch shape");
  }

  const vectors = value.map((row) => {
    if (
      !Array.isArray(row) ||
      row.length === 0 ||
      row.some((item) => typeof item !== "number" || !Number.isFinite(item))
    ) {
      throw new Error("Embedding model returned an invalid vector");
    }

    return row as number[];
  });

  const dimensions = vectors[0].length;
  if (vectors.some((vector) => vector.length !== dimensions)) {
    throw new Error("Embedding model returned inconsistent vector dimensions");
  }

  return vectors;
};

export class LocalEmbeddingProvider implements EmbeddingProvider {
  private static readonly pipelinePromises = new Map<
    string,
    Promise<FeatureExtractionPipeline>
  >();

  private readonly cache = new Map<string, number[]>();
  private readonly inFlight = new Map<string, Promise<number[]>>();

  public constructor(
    public readonly modelId = DEFAULT_LOCAL_EMBEDDING_MODEL,
  ) {}

  public async embed(text: string): Promise<number[]> {
    const [embedding] = await this.embedMany([text]);
    return embedding;
  }

  public async embedMany(texts: string[]): Promise<number[][]> {
    validateTexts(texts);

    if (texts.length === 0) {
      return [];
    }

    const uncachedTexts = [
      ...new Set(
        texts.filter(
          (text) => !this.cache.has(text) && !this.inFlight.has(text),
        ),
      ),
    ];

    if (uncachedTexts.length > 0) {
      const batchPromise = this.generateEmbeddings(uncachedTexts);

      uncachedTexts.forEach((text, index) => {
        const embeddingPromise = batchPromise
          .then((vectors) => {
            const vector = vectors[index];
            this.cache.set(text, vector);
            return vector;
          })
          .finally(() => {
            this.inFlight.delete(text);
          });

        this.inFlight.set(text, embeddingPromise);
      });
    }

    return Promise.all(
      texts.map((text) => {
        const cached = this.cache.get(text);
        if (cached) {
          return copyVector(cached);
        }

        const pending = this.inFlight.get(text);
        if (!pending) {
          throw new Error("Embedding cache entered an unexpected state");
        }

        return pending.then(copyVector);
      }),
    );
  }

  private async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const extractor = await this.getPipeline();
    const output = await extractor(texts, {
      pooling: "mean",
      normalize: true,
    });

    return toVectors(output.tolist(), texts.length);
  }

  private getPipeline(): Promise<FeatureExtractionPipeline> {
    const existing = LocalEmbeddingProvider.pipelinePromises.get(this.modelId);
    if (existing) {
      return existing;
    }

    const initialization = pipeline("feature-extraction", this.modelId).catch(
      (error: unknown) => {
        LocalEmbeddingProvider.pipelinePromises.delete(this.modelId);
        throw new Error(
          `Failed to initialize local embedding model "${this.modelId}"`,
          { cause: error },
        );
      },
    );

    LocalEmbeddingProvider.pipelinePromises.set(this.modelId, initialization);
    return initialization;
  }
}
