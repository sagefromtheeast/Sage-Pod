import { XMLParser } from 'fast-xml-parser';

import type { Chapter } from '../player/chapters';
import { parseDate, parseDuration } from '../util/time';

import { parsePodloveChapters } from './podloveChapters';

export type ParsedEpisode = {
  guid: string;
  title: string;
  description: string | null;
  link: string | null;
  publishedAt: number | null;
  duration: number | null;
  mediaUrl: string;
  mediaType: string | null;
  mediaSize: number | null;
  imageUrl: string | null;
  season: number | null;
  episodeNumber: number | null;
  chaptersUrl: string | null;
  /** Podlove Simple Chapters written into the feed, if any. */
  chapters: Chapter[] | null;
};

export type ParsedFeed = {
  title: string;
  author: string | null;
  description: string | null;
  imageUrl: string | null;
  link: string | null;
  language: string | null;
  explicit: boolean;
  episodes: ParsedEpisode[];
  nextPageUrl?: string | null;
  /** Podcasting 2.0 `<podcast:funding url="…">label</podcast:funding>` links. */
  funding: FundingLink[];
};

export type FundingLink = { url: string; label: string };

/**
 * `fast-xml-parser` configured for podcast feeds specifically.
 *
 * Attribute values carry the audio URL (`<enclosure url=…>`), so attributes are
 * parsed and prefixed with `@` to keep them from colliding with child elements
 * of the same name. Values are *not* coerced to numbers: GUIDs and episode
 * numbers are frequently digit-only strings that must stay strings.
 */
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@',
  textNodeName: '#text',
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
  processEntities: true,
  // Namespace prefixes are kept (`itunes:duration`) because several fields are
  // only distinguishable by their namespace.
  removeNSPrefix: false,
});

type Node = Record<string, unknown>;

/** Feeds are inconsistent about whether a repeated element is an array. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

/** Reads an element's text, whether it came through as a string or a node. */
function text(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return text(value[0]);
  if (typeof value === 'object') {
    const node = value as Node;
    if ('#text' in node) return text(node['#text']);
    if ('@href' in node) return text(node['@href']);
  }
  return null;
}

function attr(node: unknown, name: string): string | null {
  if (!node || typeof node !== 'object') return null;
  return text((node as Node)[`@${name}`]);
}

/** Returns the first present key among `names`. */
function pick(node: Node, ...names: string[]): unknown {
  for (const name of names) {
    if (node[name] !== undefined) return node[name];
  }
  return undefined;
}

function toInt(value: unknown): number | null {
  const raw = text(value);
  if (raw == null) return null;
  const num = Number.parseInt(raw, 10);
  return Number.isFinite(num) ? num : null;
}

/** Resolves a possibly relative URL against the feed's own URL. */
function absolute(url: string | null, base: string): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

/** Pulls artwork from the several places feeds hide it. */
function imageFrom(node: Node, base: string): string | null {
  const itunesImage = attr(node['itunes:image'], 'href') ?? text(node['itunes:image']);
  if (itunesImage) return absolute(itunesImage, base);

  const image = node.image;
  if (image) {
    const url = text((image as Node).url) ?? attr(image, 'href');
    if (url) return absolute(url, base);
  }

  // Media RSS, used by a handful of large networks.
  for (const thumb of asArray(node['media:thumbnail'] as unknown)) {
    const url = attr(thumb, 'url');
    if (url) return absolute(url, base);
  }

  return null;
}

const AUDIO_MIME = /^audio\//i;
const VIDEO_MIME = /^video\//i;
const MEDIA_EXTENSION = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|m4v|mp4)(\?|#|$)/i;

/**
 * Finds the playable media URL for an item.
 *
 * Prefers `<enclosure>` (the RSS standard), then Media RSS `<media:content>`.
 * An item with neither isn't playable and gets dropped by the caller.
 */
function mediaFrom(
  item: Node,
  base: string
): { url: string; type: string | null; size: number | null } | null {
  const candidates: { url: string; type: string | null; size: number | null }[] = [];

  for (const enclosure of asArray(item.enclosure as unknown)) {
    const url = absolute(attr(enclosure, 'url'), base);
    if (url) {
      candidates.push({
        url,
        type: attr(enclosure, 'type'),
        size: toInt(attr(enclosure, 'length')),
      });
    }
  }

  for (const content of asArray(item['media:content'] as unknown)) {
    const url = absolute(attr(content, 'url'), base);
    if (url) {
      candidates.push({
        url,
        type: attr(content, 'type'),
        size: toInt(attr(content, 'fileSize')),
      });
    }
  }

  if (candidates.length === 0) return null;

  // Audio wins over video; a declared MIME type wins over a guess from the
  // file extension; anything else is a last resort.
  return (
    candidates.find((c) => c.type && AUDIO_MIME.test(c.type)) ??
    candidates.find((c) => MEDIA_EXTENSION.test(c.url)) ??
    candidates.find((c) => c.type && VIDEO_MIME.test(c.type)) ??
    candidates[0]
  );
}

function parseItem(item: Node, base: string, feedImage: string | null): ParsedEpisode | null {
  const media = mediaFrom(item, base);
  if (!media) return null;

  const title = text(pick(item, 'title', 'itunes:title')) ?? 'Untitled episode';

  // `<guid>` is the correct identity, but plenty of feeds omit it. Falling back
  // to the media URL keeps episodes stable across refreshes, which is what the
  // (feed_id, guid) unique index actually needs.
  const guid =
    text(item.guid) ?? text(item.id) ?? media.url;

  const description =
    text(pick(item, 'content:encoded', 'description', 'itunes:summary', 'summary')) ?? null;

  const link = absolute(text(item.link), base);

  const chapters = item['podcast:chapters'] as Node | undefined;
  const chaptersUrl = chapters ? absolute(attr(chapters, 'url'), base) : null;

  return {
    guid,
    title,
    description,
    link,
    publishedAt: parseDate(text(pick(item, 'pubDate', 'published', 'updated', 'dc:date'))),
    duration: parseDuration(text(item['itunes:duration'])),
    mediaUrl: media.url,
    mediaType: media.type,
    mediaSize: media.size,
    imageUrl: imageFrom(item, base) ?? feedImage,
    season: toInt(item['itunes:season']),
    episodeNumber: toInt(item['itunes:episode']),
    chaptersUrl,
    chapters: parsePodloveChapters(item['psc:chapters'], base),
  };
}

/**
 * Parses an RSS 2.0 or Atom podcast feed.
 *
 * @param xml  Raw feed body.
 * @param base Feed URL, used to resolve relative links.
 * @throws If the document has no recognisable channel element.
 */
export function parseFeed(xml: string, base: string): ParsedFeed {
  const doc = parser.parse(xml) as Node;

  const rss = doc.rss as Node | undefined;
  const channel = (rss?.channel ?? doc.channel ?? doc.feed) as Node | undefined;
  if (!channel) {
    throw new Error('Not a podcast feed: no <channel> or <feed> element found.');
  }

  const imageUrl = imageFrom(channel, base);

  const rawItems = [
    ...asArray(channel.item as unknown),
    ...asArray(channel.entry as unknown), // Atom
  ] as Node[];

  const episodes: ParsedEpisode[] = [];
  const seenGuids = new Set<string>();

  for (const raw of rawItems) {
    const episode = parseItem(raw, base, imageUrl);
    if (!episode) continue;
    // Duplicate GUIDs in one document would violate the unique index on insert.
    if (seenGuids.has(episode.guid)) continue;
    seenGuids.add(episode.guid);
    episodes.push(episode);
  }

  episodes.sort((a, b) => (b.publishedAt ?? 0) - (a.publishedAt ?? 0));

  const explicitRaw = text(channel['itunes:explicit'])?.toLowerCase();

  const linkNodes = [
    ...asArray(channel['atom:link'] as unknown),
    ...asArray(channel.link as unknown),
  ];
  let nextPageUrl: string | null = null;
  for (const linkNode of linkNodes) {
    if (attr(linkNode, 'rel') === 'next') {
      nextPageUrl = absolute(attr(linkNode, 'href'), base);
      if (nextPageUrl) break;
    }
  }

  const funding: FundingLink[] = [];
  for (const node of asArray(channel['podcast:funding'] as unknown)) {
    const url = absolute(attr(node, 'url'), base);
    if (!url || !/^https?:\/\//i.test(url) || funding.some((link) => link.url === url)) continue;
    funding.push({ url, label: text(node) ?? 'Support this podcast' });
  }

  return {
    title: text(channel.title) ?? 'Untitled podcast',
    author:
      text(pick(channel, 'itunes:author', 'managingEditor', 'author', 'dc:creator')) ?? null,
    description:
      text(pick(channel, 'description', 'itunes:summary', 'subtitle', 'summary')) ?? null,
    imageUrl,
    link: absolute(text(channel.link), base),
    language: text(pick(channel, 'language', 'dc:language')) ?? null,
    explicit: explicitRaw === 'yes' || explicitRaw === 'true',
    episodes,
    nextPageUrl,
    funding,
  };
}
