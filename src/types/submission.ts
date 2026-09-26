import { z } from "zod";

import { countContentWords, countWords } from "../text/word-count.js";

export const PERSPECTIVES = [
  "support",
  "concern",
  "question",
  "suggestion",
  "observation",
] as const;

export type Perspective = (typeof PERSPECTIVES)[number];

export interface Submission {
  id: string;
  headline: string;
  body: string;
  perspective: Perspective;
}

export const MIN_HEADLINE_CONTENT_WORDS = 1;
export const MIN_BODY_CONTENT_WORDS = 5;
export const MAX_SUBMISSION_WORDS = 100;

export const perspectiveSchema = z.enum(PERSPECTIVES);

export const submissionSchema: z.ZodType<Submission> = z
  .object({
    id: z.string().trim().min(1, "Submission ID is required"),
    headline: z
      .string()
      .trim()
      .min(1, "Headline is required")
      .refine((headline) => countContentWords(headline) >= MIN_HEADLINE_CONTENT_WORDS, {
        message: "Headline must contain at least one word with letters or digits",
      }),
    body: z
      .string()
      .trim()
      .min(1, "Submission body is required")
      .refine((body) => countContentWords(body) >= MIN_BODY_CONTENT_WORDS, {
        message: `Submission body must contain at least ${MIN_BODY_CONTENT_WORDS} words with letters or digits`,
      }),
    perspective: perspectiveSchema,
  })
  .strict()
  .refine(
    ({ headline, body }) => countWords(headline) + countWords(body) <= MAX_SUBMISSION_WORDS,
    {
      message: `Headline and body together must contain at most ${MAX_SUBMISSION_WORDS} words`,
      path: ["body"],
    },
  );
