import type { FixedContent } from "../types/fixed-content.js";
import type { Submission } from "../types/submission.js";

export const toSemanticText = (submission: Submission): string =>
  [
    `Headline: ${submission.headline.trim()}`,
    `Body: ${submission.body.trim()}`,
    `Perspective: ${submission.perspective}`,
  ].join("\n");

export const toFixedContentText = (content: FixedContent): string => {
  const title = content.title?.trim();

  if (title) {
    return `Title: ${title}\nBody: ${content.body.trim()}`;
  }

  return content.body.trim();
};
