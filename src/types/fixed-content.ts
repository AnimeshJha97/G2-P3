import { z } from "zod";

export interface FixedContent {
  id: string;
  title?: string;
  body: string;
}

const countWords = (text: string): number => text.trim().split(/\s+/u).length;

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
