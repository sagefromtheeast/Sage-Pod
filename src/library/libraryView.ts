/**
 * The Library's display choices (AntennaPod's Subscriptions screen): sort,
 * the number on each tile, the filter, tags and columns. Pure so the rules
 * can be tested; the saved values live in settings.
 */
import { parseTags, serializeTags } from '../feed/feedPrefs';

/** What a tile needs to be sorted, counted and filtered. */
export type LibraryFeedCounts = {
  id: number;
  title: string;
  tags: string | null;
  keep_updated: number;
  auto_download_override: number | null;
  last_refresh_error: string | null;
  latest_published_at: number | null;
  unplayed_count: number;
  inbox_count: number;
  downloaded_count: number;
  downloaded_unplayed_count: number;
  played_count: number;
};

export type LibrarySort = 'title' | 'updated' | 'unplayed' | 'played';
export const LIBRARY_SORTS: readonly { key: LibrarySort; label: string }[] = [
  { key: 'title', label: 'Title (A–Z)' },
  { key: 'updated', label: 'Latest episode' },
  { key: 'unplayed', label: 'Most unplayed' },
  { key: 'played', label: 'Most played' },
];

export type LibraryCounter = 'unplayed' | 'inbox' | 'downloaded' | 'downloaded_unplayed' | 'none';
export const LIBRARY_COUNTERS: readonly { key: LibraryCounter; label: string }[] = [
  { key: 'unplayed', label: 'Unplayed episodes' },
  { key: 'inbox', label: 'Inbox episodes' },
  { key: 'downloaded', label: 'Downloaded episodes' },
  { key: 'downloaded_unplayed', label: 'Downloaded and unplayed' },
  { key: 'none', label: 'No number' },
];

/** Column choices; 0 follows the window width (useLayout). */
export const LIBRARY_COLUMNS = [0, 2, 3, 4, 5] as const;

export function parseSort(raw: string | null | undefined): LibrarySort {
  return LIBRARY_SORTS.some((sort) => sort.key === raw) ? (raw as LibrarySort) : 'title';
}

export function parseCounter(raw: string | null | undefined): LibraryCounter {
  return LIBRARY_COUNTERS.some((counter) => counter.key === raw) ? (raw as LibraryCounter) : 'unplayed';
}

export function counterValue(feed: LibraryFeedCounts, counter: LibraryCounter): number {
  switch (counter) {
    case 'unplayed':
      return feed.unplayed_count;
    case 'inbox':
      return feed.inbox_count;
    case 'downloaded':
      return feed.downloaded_count;
    case 'downloaded_unplayed':
      return feed.downloaded_unplayed_count;
    default:
      return 0;
  }
}

const byTitle = (a: LibraryFeedCounts, b: LibraryFeedCounts) =>
  a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });

/** A new array in the chosen order; ties fall back to the title. */
export function sortFeeds<T extends LibraryFeedCounts>(feeds: readonly T[], sort: LibrarySort): T[] {
  const list = [...feeds];
  const by = (value: (feed: T) => number) => (a: T, b: T) => value(b) - value(a) || byTitle(a, b);
  switch (sort) {
    case 'updated':
      return list.sort(by((feed) => feed.latest_published_at ?? 0));
    case 'unplayed':
      return list.sort(by((feed) => feed.unplayed_count));
    case 'played':
      return list.sort(by((feed) => feed.played_count));
    default:
      return list.sort(byTitle);
  }
}

export type LibraryFacet = 'updated' | 'autoDownload' | 'counter' | 'error';
/** true = only podcasts that are this; false = only those that aren't. */
export type LibraryFilter = Partial<Record<LibraryFacet, boolean>>;

export const LIBRARY_FACETS: readonly { facet: LibraryFacet; yes: string; no: string }[] = [
  { facet: 'updated', yes: 'Kept updated', no: 'Not updated' },
  { facet: 'autoDownload', yes: 'Auto-download', no: 'No auto-download' },
  { facet: 'counter', yes: 'Counter above zero', no: 'Counter zero' },
  { facet: 'error', yes: 'Refresh failed', no: 'Refreshing fine' },
];
const FACETS = LIBRARY_FACETS.map((entry) => entry.facet);

/** 'updated,-autoDownload' → { updated: true, autoDownload: false }. */
export function parseLibraryFilter(raw: string | null | undefined): LibraryFilter {
  const filter: LibraryFilter = {};
  for (const part of (raw ?? '').split(',')) {
    const token = part.trim();
    const include = !token.startsWith('-');
    const facet = (include ? token : token.slice(1)) as LibraryFacet;
    if (FACETS.includes(facet)) filter[facet] = include;
  }
  return filter;
}

export function serializeLibraryFilter(filter: LibraryFilter): string {
  return FACETS.filter((facet) => filter[facet] !== undefined)
    .map((facet) => (filter[facet] ? facet : `-${facet}`))
    .join(',');
}

export function toggleLibraryFacet(filter: LibraryFilter, facet: LibraryFacet, include: boolean): LibraryFilter {
  const next = { ...filter };
  if (next[facet] === include) delete next[facet];
  else next[facet] = include;
  return next;
}

export function isLibraryFiltered(filter: LibraryFilter): boolean {
  return FACETS.some((facet) => filter[facet] !== undefined);
}

export type FilterContext = { counter: LibraryCounter; globalAutoDownload: boolean; tag: string | null };

function facetValue(feed: LibraryFeedCounts, facet: LibraryFacet, context: FilterContext): boolean {
  switch (facet) {
    case 'updated':
      return feed.keep_updated === 1;
    case 'autoDownload':
      return feed.auto_download_override === null ? context.globalAutoDownload : feed.auto_download_override === 1;
    case 'counter':
      return counterValue(feed, context.counter) > 0;
    case 'error':
      return feed.last_refresh_error !== null;
  }
}

/** Podcasts matching every set facet and, when a tag is chosen, carrying it (case-insensitive). */
export function filterFeeds<T extends LibraryFeedCounts>(
  feeds: readonly T[],
  filter: LibraryFilter,
  context: FilterContext
): T[] {
  const tag = context.tag?.toLowerCase() ?? null;
  return feeds.filter(
    (feed) =>
      FACETS.every((facet) => filter[facet] === undefined || facetValue(feed, facet, context) === filter[facet]) &&
      (tag === null || parseTags(feed.tags).some((t) => t.toLowerCase() === tag))
  );
}

/** Every tag in use, sorted, first spelling wins. */
export function allTags(feeds: readonly { tags: string | null }[]): string[] {
  const seen = new Map<string, string>();
  for (const feed of feeds) {
    for (const tag of parseTags(feed.tags)) {
      if (!seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

/** A feed's tags with `from` renamed to `to` (or removed when `to` is empty); null when none are left. */
export function renameTagIn(raw: string | null, from: string, to: string): string | null {
  const key = from.toLowerCase();
  const tags = parseTags(raw).flatMap((tag) => (tag.toLowerCase() === key ? (to.trim() ? [to.trim()] : []) : [tag]));
  return serializeTags(tags) || null;
}

export function addTagTo(raw: string | null, tag: string): string | null {
  return serializeTags([...parseTags(raw), tag]) || null;
}

/** Column count for the grid: the saved choice, or the layout's own when 0. */
export function columnsFor(saved: number, layoutColumns: number): number {
  return (LIBRARY_COLUMNS as readonly number[]).includes(saved) && saved > 0 ? saved : layoutColumns;
}
