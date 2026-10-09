/**
 * Podcast links from web pages and other apps (AntennaPod's intent filters):
 * itpc://, pcast://, feed://, podcast:// and the "feed:https://…" form. Each
 * opens Add podcast with the feed's address. Pure, so it is tested.
 */
export const FEED_LINK_SCHEMES = ['itpc', 'pcast', 'feed', 'podcast'] as const;

const FEED_LINK = new RegExp(`^(?:${FEED_LINK_SCHEMES.join('|')}):`, 'i');

/** The route a podcast link opens, or null to let the router handle the path itself. */
export function routeForFeedLink(path: string): string | null {
  const link = path.trim();
  if (!FEED_LINK.test(link)) return null;
  // Nothing after the scheme ("itpc://") is not a feed.
  if (!/^[a-z]+:(?:\/\/)?[^/\s]/i.test(link)) return null;
  return `/add-feed?url=${encodeURIComponent(link)}`;
}
