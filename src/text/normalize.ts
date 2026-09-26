import type { FixedContent } from "../types/fixed-content.js";
import type { Submission } from "../types/submission.js";

export const toLexicalText = (submission: Submission): string =>
  `${submission.headline.trim()} ${submission.body.trim()}`;

export const toFixedContentLexicalText = (content: FixedContent): string =>
  [content.title?.trim(), content.body.trim()].filter(Boolean).join(" ");

export const normalizeLexicalText = (text: string): string =>
  text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{P}+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export const tokenizeLexicalText = (text: string): string[] => {
  const normalized = normalizeLexicalText(text);

  return normalized ? normalized.split(" ") : [];
};
