import type { EpisodeWithFeed } from '@/db/types';

export type QueueSortCriterion =
  | 'duration_remaining_asc'
  | 'duration_desc'
  | 'date_desc'
  | 'date_asc'
  | 'podcast_title_asc'
  | 'shuffle';

/**
 * Sorts an array of queue episodes in-memory by a given criterion.
 * (AntennaPod issue #5427 duration remaining sort, date, title, shuffle).
 */
export function sortQueueEpisodes(
  episodes: readonly {
    id: number;
    duration: number | null;
    position: number;
    published_at: number | null;
    feed_title: string;
  }[],
  criterion: QueueSortCriterion
): number[] {
  const items = [...episodes];
  switch (criterion) {
    case 'duration_remaining_asc':
      items.sort((a, b) => {
        const remA = Math.max(0, (a.duration ?? 0) - a.position);
        const remB = Math.max(0, (b.duration ?? 0) - b.position);
        return remA - remB;
      });
      break;
    case 'duration_desc':
      items.sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0));
      break;
    case 'date_desc':
      items.sort((a, b) => (b.published_at ?? 0) - (a.published_at ?? 0));
      break;
    case 'date_asc':
      items.sort((a, b) => (a.published_at ?? 0) - (b.published_at ?? 0));
      break;
    case 'podcast_title_asc':
      items.sort((a, b) =>
        (a.feed_title || '').localeCompare(b.feed_title || '', undefined, {
          sensitivity: 'base',
        })
      );
      break;
    case 'shuffle': {
      // Fisher-Yates shuffle
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
      }
      break;
    }
  }
  return items.map((item) => item.id);
}
