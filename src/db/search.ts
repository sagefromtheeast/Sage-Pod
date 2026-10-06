/**
 * Splits a search into LIKE patterns, one per word, with % and _ (and the
 * escape character) taken literally. Every word must match, in any order,
 * as AntennaPod's search does ("chip shortage" finds "the shortage of chips").
 * Use with `LIKE ? ESCAPE '\\'`.
 */
export function searchWords(term: string): string[] {
  return term
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => `%${word.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
}
