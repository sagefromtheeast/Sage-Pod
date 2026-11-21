import type { Chapter } from '@/player/chapters';

/**
 * Podlove Simple Chapters (`<psc:chapters>` in a feed item), which AntennaPod
 * reads as well as Podcasting 2.0 chapter files and chapters in the audio:
 *
 *   <psc:chapters version="1.2" xmlns:psc="http://podlove.org/simple-chapters">
 *     <psc:chapter start="00:00:00.000" title="Intro" />
 *     <psc:chapter start="12:34" title="Interview" href="https://…" image="https://…" />
 *   </psc:chapters>
 */

/**
 * A Normal Play Time value as Podlove writes it: `HH:MM:SS(.mmm)`,
 * `MM:SS(.mmm)` or plain seconds. Returns seconds, or null if unreadable.
 */
export function parseNormalPlayTime(value: string | null | undefined): number | null {
  if (!value) return null;
  const parts = value.trim().split(':');
  if (parts.length > 3 || parts.some((part) => !/^\d+(\.\d+)?$/.test(part))) return null;
  // Only the last field may carry a fraction.
  if (parts.slice(0, -1).some((part) => part.includes('.'))) return null;
  return parts.reduce((total, part) => total * 60 + Number(part), 0);
}

type Node = Record<string, unknown>;

function attribute(node: Node, name: string): string | null {
  const value = node[`@${name}`];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** An http(s) link resolved against the feed, or undefined. */
function link(value: string | null, base: string): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The chapters in an item's `<psc:chapters>` element (as parsed by
 * fast-xml-parser with `@` attributes), sorted by start. Null when there are
 * none, so the player can fall back to chapters in the audio.
 */
export function parsePodloveChapters(element: unknown, base: string): Chapter[] | null {
  if (!element || typeof element !== 'object') return null;
  const raw = (element as Node)['psc:chapter'];
  const entries = (Array.isArray(raw) ? raw : [raw]).filter(
    (entry): entry is Node => !!entry && typeof entry === 'object'
  );
  const chapters: Chapter[] = [];
  for (const entry of entries) {
    const startTime = parseNormalPlayTime(attribute(entry, 'start'));
    if (startTime === null) continue;
    chapters.push({
      startTime,
      title: attribute(entry, 'title') ?? '',
      url: link(attribute(entry, 'href'), base),
      img: link(attribute(entry, 'image'), base),
    });
  }
  if (chapters.length === 0) return null;
  return chapters.sort((a, b) => a.startTime - b.startTime);
}
