export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'timestamp'; raw: string; seconds: number };

const TIMESTAMP_REGEX = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g;
const LONG_TIMECODE = /\b\d{1,2}:\d{1,2}:\d{2}\b/g;
const SHORT_TIMECODE = /\b(\d{1,2}):(\d{2})\b/g;

/**
 * Whether two-part timecodes ("12:30") in these notes mean HH:MM rather than
 * MM:SS. AntennaPod's rule: read them as hours:minutes only if every one of
 * them still fits inside the episode that way; if any would run past the end,
 * they're minutes:seconds. Without a known duration, assume minutes:seconds.
 */
export function shortTimecodesAreHours(text: string, durationSeconds: number | null | undefined): boolean {
  if (!durationSeconds || durationSeconds <= 0) return false;
  let any = false;
  // Blank out HH:MM:SS first so their tails don't read as short timecodes
  // (no lookbehind: not every JS engine the app runs on supports it).
  for (const match of text.replace(LONG_TIMECODE, ' ').matchAll(SHORT_TIMECODE)) {
    any = true;
    const asHours = Number(match[1]) * 3600 + Number(match[2]) * 60;
    if (asHours > durationSeconds) return false;
  }
  return any;
}

/**
 * Splits text into plain runs and tappable timestamps (HH:MM:SS, or two-part
 * timecodes read per `shortTimecodesAreHours`). Anything that isn't a real
 * time (":75" seconds) or lies past the end of the episode stays plain text.
 */
export function parseTimestamps(
  text: string,
  durationSeconds?: number | null,
  shortAsHours: boolean = shortTimecodesAreHours(text, durationSeconds)
): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let pending = '';
  let lastIndex = 0;

  for (const match of text.matchAll(TIMESTAMP_REGEX)) {
    const raw = match[0];
    const index = match.index ?? 0;
    const first = match[1] !== undefined ? Number(match[1]) : null;
    const second = Number(match[2]);
    const third = Number(match[3]);

    let seconds: number | null;
    if (first !== null) {
      seconds = second < 60 && third < 60 ? first * 3600 + second * 60 + third : null;
    } else if (shortAsHours) {
      seconds = third < 60 ? second * 3600 + third * 60 : null;
    } else {
      seconds = third < 60 ? second * 60 + third : null;
    }
    if (seconds !== null && durationSeconds && durationSeconds > 0 && seconds > durationSeconds) seconds = null;

    pending += text.slice(lastIndex, index);
    lastIndex = index + raw.length;
    if (seconds === null) {
      pending += raw;
      continue;
    }
    if (pending) segments.push({ type: 'text', value: pending });
    pending = '';
    segments.push({ type: 'timestamp', raw, seconds });
  }

  pending += text.slice(lastIndex);
  if (pending) segments.push({ type: 'text', value: pending });
  return segments;
}
