import { parseFeed, type ParsedFeed } from './parser';

/** A feed body plus the cache validators to send on the next refresh. */
export type FetchedFeed = {
  feed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  /** True when the server answered 304 and there was nothing new to parse. */
  notModified: boolean;
};

const USER_AGENT = 'SagePod/0.1 (+https://github.com/sagefromtheeast/sage-pod)';
const REQUEST_TIMEOUT_MS = 20_000;
/** Feeds with decades of episodes exist; refuse to hold one entirely in memory. */
const MAX_FEED_BYTES = 12 * 1024 * 1024;

export class FeedError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'FeedError';
  }
}

/** Accepts "example.com/feed" and podcast-app style "feed://" URLs. */
export function normalizeFeedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new FeedError('Enter a feed URL.');

  const withScheme = trimmed
    .replace(/^feed:\/\//i, 'https://')
    .replace(/^podcast:\/\//i, 'https://')
    .replace(/^itpc:\/\//i, 'https://');

  const candidate = /^https?:\/\//i.test(withScheme) ? withScheme : `https://${withScheme}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new FeedError(`Unsupported URL scheme: ${url.protocol}`);
    }
    return url.toString();
  } catch (error) {
    if (error instanceof FeedError) throw error;
    throw new FeedError(`That doesn't look like a URL: ${trimmed}`);
  }
}

/**
 * Downloads and parses a feed.
 *
 * Sends `If-None-Match` / `If-Modified-Since` when the caller has validators
 * from a previous fetch, so a routine refresh of an unchanged feed costs one
 * small 304 rather than a full re-download. This matters: a refresh-all across
 * dozens of subscriptions on cellular is the app's heaviest network moment.
 */
export async function fetchFeed(
  feedUrl: string,
  validators: { etag?: string | null; lastModified?: string | null } = {}
): Promise<FetchedFeed> {
  const url = normalizeFeedUrl(feedUrl);

  // Extract HTTP Basic Auth credentials embedded in the URL (user:pass@host)
  // and pass them as an Authorization header instead, so they never leak into
  // logs or show up in the address bar.
  const parsedUrl = new URL(url);
  const fetchUrl =
    parsedUrl.username || parsedUrl.password
      ? (() => {
          const clean = new URL(url);
          clean.username = '';
          clean.password = '';
          return clean.toString();
        })()
      : url;

  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'User-Agent': USER_AGENT,
  };

  if (parsedUrl.username || parsedUrl.password) {
    const credentials = `${decodeURIComponent(parsedUrl.username)}:${decodeURIComponent(parsedUrl.password)}`;
    headers['Authorization'] = `Basic ${btoa(credentials)}`;
  }
  if (validators.etag) headers['If-None-Match'] = validators.etag;
  if (validators.lastModified) headers['If-Modified-Since'] = validators.lastModified;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(fetchUrl, { headers, signal: controller.signal, redirect: 'follow' });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new FeedError('The feed took too long to respond.', error);
    }
    throw new FeedError('Could not reach the feed. Check your connection.', error);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 304) {
    return {
      feed: { title: '', author: null, description: null, imageUrl: null, link: null, language: null, explicit: false, episodes: [] },
      etag: validators.etag ?? null,
      lastModified: validators.lastModified ?? null,
      notModified: true,
    };
  }

  if (!response.ok) {
    throw new FeedError(`The feed returned HTTP ${response.status}.`);
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
    throw new FeedError('That feed is too large to load.');
  }

  const body = await response.text();
  if (body.length > MAX_FEED_BYTES) {
    throw new FeedError('That feed is too large to load.');
  }

  let feed: ParsedFeed;
  try {
    // Redirects are followed above, so resolve relative URLs against wherever
    // we actually landed rather than where we started.
    feed = parseFeed(body, response.url || fetchUrl);
  } catch (error) {
    throw new FeedError(
      error instanceof Error ? error.message : 'Could not read that feed.',
      error
    );
  }

  return {
    feed,
    etag: response.headers.get('etag'),
    lastModified: response.headers.get('last-modified'),
    notModified: false,
  };
}
