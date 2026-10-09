import { basicAuthHeader, splitCredentials, type FeedCredentials } from './auth';
import { findFeedLinks, looksLikeHtml, type FeedLink } from './autodiscovery';
import { parseFeed, type ParsedFeed } from './parser';

/** A feed body plus the cache validators to send on the next refresh. */
export type FetchedFeed = {
  feed: ParsedFeed;
  etag: string | null;
  lastModified: string | null;
  /** True when the server answered 304 and there was nothing new to parse. */
  notModified: boolean;
};

export const USER_AGENT = 'SagePod/0.1 (+https://github.com/sagefromtheeast/sage-pod)';
const REQUEST_TIMEOUT_MS = 60_000;
/** Feeds with decades of episodes exist; permit up to 35MB before rejecting. */
const MAX_FEED_BYTES = 35 * 1024 * 1024;

export class FeedError extends Error {
  /** The HTTP status, when the server answered with an error. */
  readonly status: number | null;
  /** Feeds a web page advertises, when the address was a page rather than a feed. */
  readonly feedLinks: FeedLink[];

  constructor(
    message: string,
    readonly cause?: unknown,
    details: { status?: number; feedLinks?: FeedLink[] } = {}
  ) {
    super(message);
    this.name = 'FeedError';
    this.status = details.status ?? null;
    this.feedLinks = details.feedLinks ?? [];
  }
}

/** Accepts "example.com/feed" and podcast-app style "feed://" URLs. */
export function normalizeFeedUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new FeedError('Enter a feed URL.');

  const withScheme = trimmed
    // "feed:https://…" wraps a whole address; "feed://…" and the others replace the scheme.
    .replace(/^(?:feed|podcast):(?=https?:\/\/)/i, '')
    .replace(/^feed:\/\//i, 'https://')
    .replace(/^pcast:\/\//i, 'https://')
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
  validators: { etag?: string | null; lastModified?: string | null } = {},
  credentials: FeedCredentials | null = null
): Promise<FetchedFeed> {
  const url = normalizeFeedUrl(feedUrl);

  // Credentials embedded in the URL (user:pass@host) go in a header instead,
  // so they never leak into logs; otherwise the podcast's saved ones.
  const { url: fetchUrl, credentials: embedded } = splitCredentials(url);
  const auth = embedded ?? credentials;

  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'User-Agent': USER_AGENT,
  };
  if (auth) headers['Authorization'] = basicAuthHeader(auth);
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
      feed: { title: '', author: null, description: null, imageUrl: null, link: null, language: null, explicit: false, episodes: [], funding: [] },
      etag: validators.etag ?? null,
      lastModified: validators.lastModified ?? null,
      notModified: true,
    };
  }

  if (response.status === 401 || response.status === 403) {
    throw new FeedError('This feed needs a username and password.', undefined, { status: response.status });
  }
  if (!response.ok) {
    throw new FeedError(`The feed returned HTTP ${response.status}.`, undefined, { status: response.status });
  }

  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FEED_BYTES) {
    throw new FeedError('That feed is too large to load.');
  }

  const body = await response.text();
  if (body.length > MAX_FEED_BYTES) {
    throw new FeedError('That feed is too large to load.');
  }

  // A website address: offer the feeds the page links to (autodiscovery).
  if (looksLikeHtml(body, response.headers.get('content-type'))) {
    const feedLinks = findFeedLinks(body, response.url || fetchUrl);
    throw new FeedError(
      feedLinks.length > 0
        ? 'That address is a web page. Pick its feed below.'
        : "That address is a web page, and it doesn't link to a podcast feed.",
      undefined,
      { feedLinks }
    );
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
