import { routeForFeedLink } from '@/feed/deepLink';

/** Podcast links (itpc://, feed://…) open Add podcast; Sage Pod's own links route as usual. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return routeForFeedLink(path) ?? path;
  } catch {
    return path;
  }
}
