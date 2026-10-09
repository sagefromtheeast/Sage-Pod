/**
 * Podcast discovery via Apple's public iTunes Search API.
 *
 * Chosen because it needs no API key or account — the app works the moment it
 * is installed. The API returns catalogue metadata plus the `feedUrl` we
 * actually subscribe to, so results flow straight into the normal RSS path.
 */

export type PodcastResult = {
  /** Apple's collection id, used for `lookup` calls and as a list key. */
  id: string;
  title: string;
  author: string | null;
  /** RSS URL. Absent for a small number of catalogue entries, which we drop. */
  feedUrl: string;
  artworkUrl: string | null;
  genre: string | null;
  episodeCount: number | null;
};

import { DEFAULT_COUNTRY, itunesChartsUrl, itunesSearchUrl } from './providers';

const LOOKUP_ENDPOINT = 'https://itunes.apple.com/lookup';
const REQUEST_TIMEOUT_MS = 15_000;

type RawResult = {
  collectionId?: number;
  trackId?: number;
  collectionName?: string;
  trackName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  primaryGenreName?: string;
  trackCount?: number;
};

export class DiscoveryError extends Error {}

export async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new DiscoveryError(`Search failed (HTTP ${response.status}).`);
    return (await response.json()) as T;
  } catch (error) {
    if (controller.signal.aborted) throw new DiscoveryError('The search timed out.');
    if (error instanceof DiscoveryError) throw error;
    throw new DiscoveryError('Could not reach the podcast directory.');
  } finally {
    clearTimeout(timeout);
  }
}

function toPodcast(raw: RawResult): PodcastResult | null {
  // Without a feed URL there is nothing to subscribe to, so the entry is
  // useless to us however good its metadata looks.
  if (!raw.feedUrl) return null;

  const id = String(raw.collectionId ?? raw.trackId ?? raw.feedUrl);
  return {
    id,
    title: raw.collectionName ?? raw.trackName ?? 'Untitled podcast',
    author: raw.artistName ?? null,
    feedUrl: raw.feedUrl,
    // artworkUrl600 is the largest size the search API returns; the 100px
    // variant is a blurry fallback but better than an empty tile.
    artworkUrl: raw.artworkUrl600 ?? raw.artworkUrl100 ?? null,
    genre: raw.primaryGenreName ?? null,
    episodeCount: typeof raw.trackCount === 'number' ? raw.trackCount : null,
  };
}

/** Full-text podcast search. */
export async function searchPodcasts(
  term: string,
  options: { limit?: number; country?: string } = {}
): Promise<PodcastResult[]> {
  const query = term.trim();
  if (!query) return [];

  const data = await getJson<{ results?: RawResult[] }>(itunesSearchUrl(query, options));
  return (data.results ?? []).map(toPodcast).filter((p): p is PodcastResult => p !== null);
}

/** Resolves Apple collection IDs to full podcast records, preserving order. */
async function lookupPodcasts(ids: string[], country: string): Promise<PodcastResult[]> {
  if (ids.length === 0) return [];

  const url = `${LOOKUP_ENDPOINT}?id=${ids.join(',')}&entity=podcast&country=${country}`;
  const data = await getJson<{ results?: RawResult[] }>(url);

  const byId = new Map<string, PodcastResult>();
  for (const raw of data.results ?? []) {
    const podcast = toPodcast(raw);
    if (podcast) byId.set(podcast.id, podcast);
  }

  // `lookup` does not guarantee the order of the ids we asked for, and the
  // chart order is the whole point of a chart.
  return ids.map((id) => byId.get(id)).filter((p): p is PodcastResult => p !== undefined);
}

/**
 * The current top podcasts chart.
 *
 * Apple's marketing feed returns ranked IDs only, so this is a two-step fetch:
 * chart IDs, then a batch lookup for the metadata.
 */
export async function fetchTopPodcasts(
  options: { limit?: number; country?: string } = {}
): Promise<PodcastResult[]> {
  const { limit = 25, country = DEFAULT_COUNTRY } = options;
  const data = await getJson<{ feed?: { results?: { id?: string }[] } }>(itunesChartsUrl(country, limit));
  const ids = (data.feed?.results ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === 'string');

  return lookupPodcasts(ids, country.toUpperCase());
}

/** Curated browse rows for the Discover screen's empty state. */
export const BROWSE_CATEGORIES = [
  'True Crime',
  'News',
  'Comedy',
  'History',
  'Science',
  'Technology',
  'Business',
  'Health',
  'Sports',
  'Music',
  'Fiction',
  'Education',
] as const;
