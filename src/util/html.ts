const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  rsquo: '’',
  lsquo: '‘',
  ldquo: '“',
  rdquo: '”',
};

/** Decodes the HTML entities that realistically show up in podcast show notes. */
export function decodeEntities(input: string): string {
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

/**
 * Flattens show-note HTML into readable plain text.
 *
 * Show notes are the wild west — publishers ship anything from a single
 * sentence to a full newsletter with tracking pixels. We keep paragraph and
 * list breaks (they carry meaning) and drop everything else.
 */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';

  const withBreaks = String(html)
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  return decodeEntities(withBreaks)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
}

/** First `limit` characters of the show notes, for list subtitles. */
export function excerpt(html: string | null | undefined, limit = 220): string {
  const text = htmlToPlainText(html).replace(/\s+/g, ' ');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trimEnd()}…`;
}
