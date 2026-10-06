/**
 * Queue ordering rules, pure so they can be tested: AntennaPod's sort orders
 * (plus Sage Pod's "time left"), the enqueue location, the speed-aware time
 * left, and the arithmetic behind drag-to-reorder.
 */

export type QueueSortKey =
  | 'date'
  | 'duration'
  | 'remaining'
  | 'episodeTitle'
  | 'podcastTitle'
  | 'smartShuffle'
  | 'random';

export type QueueSort = { key: QueueSortKey; descending: boolean };

/** What sorting needs from an episode. */
export type SortableEpisode = {
  id: number;
  title: string;
  duration: number | null;
  position: number;
  published_at: number | null;
  feed_id: number;
  feed_title: string;
};

const KEYS: readonly QueueSortKey[] = [
  'date',
  'duration',
  'remaining',
  'episodeTitle',
  'podcastTitle',
  'smartShuffle',
  'random',
];

/** A random order can't be "kept": every enqueue would reshuffle the whole queue. */
export function canKeepSorted(sort: QueueSort): boolean {
  return sort.key !== 'random';
}

/** The "Keep sorted" setting: '' when off, else e.g. 'date:desc'. Junk reads as off. */
export function parseQueueSort(raw: string): QueueSort | null {
  const [key, direction] = raw.split(':');
  if (!KEYS.includes(key as QueueSortKey)) return null;
  return { key: key as QueueSortKey, descending: direction === 'desc' };
}

export function serializeQueueSort(sort: QueueSort | null): string {
  return sort ? `${sort.key}:${sort.descending ? 'desc' : 'asc'}` : '';
}

const text = (a: string, b: string) => (a || '').localeCompare(b || '', undefined, { sensitivity: 'base' });
const remaining = (episode: SortableEpisode) => Math.max(0, (episode.duration ?? 0) - episode.position);

/**
 * Spreads podcasts out (AntennaPod's smart shuffle): each podcast's episodes
 * stay in date order, and the queue takes one from each podcast in turn, so a
 * prolific show can't fill the top of the queue. Podcasts take turns in the
 * order of their first episode, which keeps the result stable for "Keep sorted".
 */
function smartShuffle<T extends SortableEpisode>(items: T[], newestFirst: boolean): T[] {
  const byDate = [...items].sort((a, b) =>
    newestFirst ? (b.published_at ?? 0) - (a.published_at ?? 0) : (a.published_at ?? 0) - (b.published_at ?? 0)
  );
  const groups = new Map<number, T[]>();
  for (const episode of byDate) {
    const group = groups.get(episode.feed_id);
    if (group) group.push(episode);
    else groups.set(episode.feed_id, [episode]);
  }
  const lanes = [...groups.values()];
  const result: T[] = [];
  for (let round = 0; result.length < items.length; round++) {
    for (const lane of lanes) if (round < lane.length) result.push(lane[round]);
  }
  return result;
}

/** The queue in the given order, as episode ids. Ties keep their current order. */
export function sortQueue<T extends SortableEpisode>(
  episodes: readonly T[],
  sort: QueueSort,
  random: () => number = Math.random
): number[] {
  const items = [...episodes];
  const flip = sort.descending ? -1 : 1;
  switch (sort.key) {
    case 'date':
      items.sort((a, b) => flip * ((a.published_at ?? 0) - (b.published_at ?? 0)));
      break;
    case 'duration':
      items.sort((a, b) => flip * ((a.duration ?? 0) - (b.duration ?? 0)));
      break;
    case 'remaining':
      items.sort((a, b) => flip * (remaining(a) - remaining(b)));
      break;
    case 'episodeTitle':
      items.sort((a, b) => flip * text(a.title, b.title));
      break;
    case 'podcastTitle':
      // Within a podcast, oldest first, so a show plays in order.
      items.sort((a, b) => flip * text(a.feed_title, b.feed_title) || (a.published_at ?? 0) - (b.published_at ?? 0));
      break;
    case 'smartShuffle':
      return smartShuffle(items, sort.descending).map((episode) => episode.id);
    case 'random':
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      break;
  }
  return items.map((episode) => episode.id);
}

export type EnqueueLocation = 'back' | 'front' | 'afterCurrent' | 'random';

/**
 * Where "Add to queue" inserts (AntennaPod's enqueue location), as an index
 * into the current queue. "After current" falls back to the front when the
 * playing episode isn't queued; unknown values behave as "back".
 */
export function enqueueIndex(
  location: string,
  queueIds: readonly number[],
  currentId: number | null,
  random: () => number = Math.random
): number {
  switch (location) {
    case 'front':
      return 0;
    case 'afterCurrent':
      return currentId === null ? 0 : queueIds.indexOf(currentId) + 1;
    case 'random':
      return Math.floor(random() * (queueIds.length + 1));
    default:
      return queueIds.length;
  }
}

/**
 * A sort_order that places a new row at `index` among rows with these orders
 * (ascending), without renumbering anything.
 */
export function sortOrderAt(orders: readonly number[], index: number): number {
  if (orders.length === 0) return 0;
  if (index <= 0) return orders[0] - 1;
  if (index >= orders.length) return orders[orders.length - 1] + 1;
  return (orders[index - 1] + orders[index]) / 2;
}

/**
 * Listening time left in the queue, in seconds of real time: each episode's
 * remaining length divided by the speed it will play at (its podcast's own
 * speed, else the global one), as AntennaPod's queue info line does.
 */
export function queueTimeLeft(
  episodes: readonly { duration: number | null; position: number; feed_playback_speed: number | null }[],
  globalSpeed: number
): number {
  return episodes.reduce((sum, episode) => {
    const speed = episode.feed_playback_speed ?? globalSpeed;
    return sum + Math.max(0, (episode.duration ?? 0) - episode.position) / (speed > 0 ? speed : 1);
  }, 0);
}

/** Moves the item at `from` to `to`, returning a new array. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(Math.max(0, Math.min(to, next.length)), 0, item);
  return next;
}

/**
 * Drag-to-reorder: the slot a dragged row lands in after moving `dy` points,
 * given every row's height in list order. It takes a neighbour's slot once its
 * centre passes that neighbour's midpoint.
 */
export function dropIndex(heights: readonly number[], from: number, dy: number): number {
  let to = from;
  let travelled = 0;
  if (dy > 0) {
    for (let j = from + 1; j < heights.length; j++) {
      if (dy <= travelled + heights[j] / 2) break;
      travelled += heights[j];
      to = j;
    }
  } else if (dy < 0) {
    for (let j = from - 1; j >= 0; j--) {
      if (-dy <= travelled + heights[j] / 2) break;
      travelled += heights[j];
      to = j;
    }
  }
  return to;
}
