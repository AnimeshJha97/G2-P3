// Every whitespace-separated token, matching how the 100-word limit is read.
export const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/u).length : 0;
};

// Tokens that carry content: at least one letter or digit, so emoji,
// punctuation, and symbols alone do not count.
export const countContentWords = (text: string): number =>
  text
    .trim()
    .split(/\s+/u)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
