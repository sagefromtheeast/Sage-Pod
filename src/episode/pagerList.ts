/**
 * The episode pager follows the list an episode was opened from (AntennaPod
 * passes the source list to its pager): the inbox, the queue, downloads,
 * search results and so on. The list travels by a token in the route, so the
 * URL stays short; a deep link or a stale token falls back to the podcast.
 */

/** Lists kept for tokens still in the navigation history. */
const KEEP = 10;

const lists = new Map<string, readonly number[]>();
let counter = 0;

/** Stores `ids` and returns the token for the episode route's `list` param. */
export function rememberPagerList(ids: readonly number[]): string {
  const token = `${Date.now().toString(36)}${(counter++).toString(36)}`;
  lists.set(token, [...ids]);
  while (lists.size > KEEP) lists.delete(lists.keys().next().value!);
  return token;
}

/** The list stored for `token`, if it is still kept. */
export function recallPagerList(token: string | undefined): readonly number[] | null {
  return token ? (lists.get(token) ?? null) : null;
}

/**
 * The pages to swipe through: the source list when it holds the opened
 * episode, else the podcast's episodes, else null (no pager yet).
 */
export function pagerIds(
  source: readonly number[] | null,
  openedId: number,
  feedIds: readonly number[] | null
): readonly number[] | null {
  if (source && source.includes(openedId)) return source;
  return feedIds && feedIds.includes(openedId) ? feedIds : null;
}
