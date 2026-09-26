import { z } from "zod";

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

export const perspectiveSchema = z.enum(PERSPECTIVES);

export const submissionSchema: z.ZodType<Submission> = z
  .object({
    id: z.string().trim().min(1, "Submission ID is required"),
    headline: z.string().trim().min(1, "Headline is required"),
    body: z.string().trim().min(1, "Submission body is required"),
    perspective: perspectiveSchema,
  })
  .strict();
