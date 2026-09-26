import { z } from "zod";

import { countWords } from "../text/word-count.js";

export interface FixedContent {
  id: string;
  title?: string;
  body: string;
}

export const fixedContentSchema: z.ZodType<FixedContent> = z
  .object({
    id: z.string().trim().min(1, "Fixed content ID is required"),
    title: z.string().trim().optional(),
    body: z
      .string()
      .trim()
      .min(1, "Fixed content body is required")
      .refine((body) => countWords(body) <= 100, {
        message: "Fixed content body must contain at most 100 words",
      }),
  })
  .strict();
