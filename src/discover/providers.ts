/**
 * Discovery helpers shared by the search providers (D-007: keyless only,
 * Apple first, then fyyd). Pure, so the query builders, the fyyd parser and
 * the "already subscribed" matching can be tested without a network.
 */
import type { PodcastResult } from './itunes';

/** Apple's chart countries offered in the picker: code (ISO 3166) and name. */
export const CHART_COUNTRIES: readonly { code: string; name: string }[] = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' },
  { code: 'nz', name: 'New Zealand' },
  { code: 'ie', name: 'Ireland' },
  { code: 'in', name: 'India' },
  { code: 'za', name: 'South Africa' },
  { code: 'ng', name: 'Nigeria' },
  { code: 'ke', name: 'Kenya' },
  { code: 'zw', name: 'Zimbabwe' },
  { code: 'de', name: 'Germany' },
  { code: 'at', name: 'Austria' },
  { code: 'ch', name: 'Switzerland' },
  { code: 'fr', name: 'France' },
  { code: 'be', name: 'Belgium' },
  { code: 'nl', name: 'Netherlands' },
  { code: 'es', name: 'Spain' },
  { code: 'it', name: 'Italy' },
  { code: 'pt', name: 'Portugal' },
  { code: 'br', name: 'Brazil' },
  { code: 'mx', name: 'Mexico' },
  { code: 'ar', name: 'Argentina' },
  { code: 'se', name: 'Sweden' },
  { code: 'no', name: 'Norway' },
  { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' },
  { code: 'pl', name: 'Poland' },
  { code: 'jp', name: 'Japan' },
  { code: 'kr', name: 'South Korea' },
  { code: 'sg', name: 'Singapore' },
  { code: 'ph', name: 'Philippines' },
];

export const DEFAULT_COUNTRY = 'us';

export function countryName(code: string): string {
  return CHART_COUNTRIES.find((country) => country.code === code.toLowerCase())?.name ?? code.toUpperCase();
}

/** A supported chart country, or the default for anything else. */
export function parseCountry(raw: string | null | undefined): string {
  const code = (raw ?? '').toLowerCase();
  return CHART_COUNTRIES.some((country) => country.code === code) ? code : DEFAULT_COUNTRY;
}

export function itunesSearchUrl(term: string, options: { limit?: number; country?: string } = {}): string {
  const { limit = 40, country = DEFAULT_COUNTRY } = options;
  return (
    'https://itunes.apple.com/search?media=podcast&entity=podcast' +
    `&term=${encodeURIComponent(term.trim())}&limit=${limit}&country=${country.toUpperCase()}`
  );
}

export function itunesChartsUrl(country: string, limit: number): string {
  return `https://rss.applemarketingtools.com/api/v2/${country.toLowerCase()}/podcasts/top/${limit}/podcasts.json`;
}

export function fyydSearchUrl(term: string, count = 30): string {
  return `https://api.fyyd.de/0.2/search/podcast?title=${encodeURIComponent(term.trim())}&count=${count}`;
}

type FyydPodcast = {
  id?: number;
  title?: string;
  author?: string | null;
  xmlURL?: string | null;
  imgURL?: string | null;
  layoutImageURL?: string | null;
  episode_count?: number | null;
  categories?: unknown;
};

/** fyyd's `search/podcast` response → results; entries without a feed are dropped. */
export function parseFyydResults(json: unknown): PodcastResult[] {
  const data = (json as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const results: PodcastResult[] = [];
  for (const raw of data as FyydPodcast[]) {
    if (!raw || typeof raw.xmlURL !== 'string' || !raw.xmlURL) continue;
    results.push({
      id: `fyyd:${raw.id ?? raw.xmlURL}`,
      title: raw.title?.trim() || 'Untitled podcast',
      author: raw.author?.trim() || null,
      feedUrl: raw.xmlURL,
      artworkUrl: raw.imgURL || raw.layoutImageURL || null,
      genre: null,
      episodeCount: typeof raw.episode_count === 'number' ? raw.episode_count : null,
    });
  }
  return results;
}

/**
 * A feed address reduced to what identifies it, so a directory's copy of a
 * URL matches the one stored on subscribing: no scheme, no "www.", no
 * trailing slash, case-insensitive host.
 */
export function feedUrlKey(url: string): string {
  const trimmed = url.trim().replace(/^(?:https?|feed|itpc|podcast):\/\//i, '');
  const slash = trimmed.indexOf('/');
  const host = (slash === -1 ? trimmed : trimmed.slice(0, slash)).toLowerCase().replace(/^www\./, '');
  const path = slash === -1 ? '' : trimmed.slice(slash);
  return (host + path).replace(/\/+$/, '');
}

/** Joins provider result lists in order, dropping later copies of the same feed. */
export function mergeResults(...lists: PodcastResult[][]): PodcastResult[] {
  const seen = new Set<string>();
  const merged: PodcastResult[] = [];
  for (const list of lists) {
    for (const podcast of list) {
      const key = feedUrlKey(podcast.feedUrl);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(podcast);
    }
  }
  return merged;
}
