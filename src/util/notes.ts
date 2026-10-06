import { decodeEntities, htmlToPlainText } from './html';
import { parseTimestamps, shortTimecodesAreHours } from './timestamps';

export type NoteSegment =
  | { type: 'text'; value: string }
  | { type: 'timestamp'; raw: string; seconds: number }
  | { type: 'link'; url: string; label: string };

// Private-use characters mark where each <a> was, through the HTML flattening.
const OPEN = '';
const CLOSE = '';
const MARKER = new RegExp(`${OPEN}(\\d+)${CLOSE}`, 'g');
const BARE_URL = /https?:\/\/[^\s<>"'”’)\]]+/g;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/** Bare URLs in plain text become links (minus trailing punctuation). */
function linkify(text: string, out: NoteSegment[], shortAsHours: boolean, duration: number | null): void {
  let lastIndex = 0;
  for (const match of text.matchAll(BARE_URL)) {
    const index = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION, '');
    out.push(...parseTimestamps(text.slice(lastIndex, index), duration, shortAsHours));
    out.push({ type: 'link', url, label: url });
    lastIndex = index + url.length;
  }
  out.push(...parseTimestamps(text.slice(lastIndex), duration, shortAsHours));
}

/**
 * Show notes as readable text with inline, tappable links (from <a> tags and
 * bare URLs) and timestamps, replacing the separate Links list (D-003.5).
 * Timestamps past the end of the episode stay plain text.
 */
export function parseShowNotes(html: string | null | undefined, durationSeconds: number | null): NoteSegment[] {
  if (!html) return [];
  const links: { url: string; label: string }[] = [];
  const marked = String(html).replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (all, href, inner) => {
    const url = decodeEntities(href).trim();
    const label = htmlToPlainText(inner).replace(/\s+/g, ' ').trim();
    // Only web links are tappable; anything else keeps just its text.
    if (!/^https?:\/\//i.test(url)) return inner;
    links.push({ url, label: label || url });
    return `${OPEN}${links.length - 1}${CLOSE}`;
  });

  const text = htmlToPlainText(marked);
  const shortAsHours = shortTimecodesAreHours(text.replace(MARKER, ' '), durationSeconds);

  const segments: NoteSegment[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(MARKER)) {
    const index = match.index ?? 0;
    linkify(text.slice(lastIndex, index), segments, shortAsHours, durationSeconds);
    segments.push({ type: 'link', ...links[Number(match[1])] });
    lastIndex = index + match[0].length;
  }
  linkify(text.slice(lastIndex), segments, shortAsHours, durationSeconds);

  // Merge neighbouring text runs.
  return segments.reduce<NoteSegment[]>((merged, segment) => {
    const previous = merged[merged.length - 1];
    if (segment.type === 'text' && previous?.type === 'text') previous.value += segment.value;
    else if (segment.type !== 'text' || segment.value) merged.push({ ...segment });
    return merged;
  }, []);
}
