export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'timestamp'; raw: string; seconds: number };

const TIMESTAMP_REGEX = /\b(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\b/g;

/**
 * Parses timestamps (HH:MM:SS or MM:SS) from text into interactive segments.
 */
export function parseTimestamps(text: string): TextSegment[] {
  if (!text) return [];

  const segments: TextSegment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TIMESTAMP_REGEX.exec(text)) !== null) {
    const raw = match[0];
    const matchIndex = match.index;

    // Push text preceding the timestamp
    if (matchIndex > lastIndex) {
      segments.push({
        type: 'text',
        value: text.slice(lastIndex, matchIndex),
      });
    }

    const first = match[1] ? parseInt(match[1], 10) : null;
    const second = parseInt(match[2], 10);
    const third = parseInt(match[3], 10);

    let seconds = 0;
    if (first !== null) {
      // Format is HH:MM:SS
      seconds = first * 3600 + second * 60 + third;
    } else {
      // Format is MM:SS
      seconds = second * 60 + third;
    }

    segments.push({
      type: 'timestamp',
      raw,
      seconds,
    });

    lastIndex = matchIndex + raw.length;
  }

  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      value: text.slice(lastIndex),
    });
  }

  return segments;
}
