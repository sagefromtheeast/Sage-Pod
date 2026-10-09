/**
 * The Downloads screen's rules (AntennaPod's): the saved order, which
 * downloads "Delete played" removes, and the text of a log entry's details.
 * Pure so they can be tested.
 */

export type DownloadSortField = 'date' | 'title' | 'duration' | 'size';
export type DownloadSort = `${DownloadSortField}:${'asc' | 'desc'}`;

export const DOWNLOAD_SORTS: readonly { key: DownloadSort; label: string }[] = [
  { key: 'date:desc', label: 'Newest first' },
  { key: 'date:asc', label: 'Oldest first' },
  { key: 'title:asc', label: 'Title A–Z' },
  { key: 'title:desc', label: 'Title Z–A' },
  { key: 'duration:asc', label: 'Shortest first' },
  { key: 'duration:desc', label: 'Longest first' },
  { key: 'size:desc', label: 'Largest first' },
  { key: 'size:asc', label: 'Smallest first' },
];

export function parseDownloadSort(raw: string | null | undefined): DownloadSort {
  return DOWNLOAD_SORTS.some((sort) => sort.key === raw) ? (raw as DownloadSort) : 'date:desc';
}

type Sortable = {
  id: number;
  title: string;
  published_at: number | null;
  duration: number | null;
  downloaded_bytes: number | null;
  media_size: number | null;
};

const sizeOf = (episode: Sortable) => episode.downloaded_bytes ?? episode.media_size ?? 0;

/** A new array in the chosen order; ties keep the newest first. */
export function sortDownloads<T extends Sortable>(episodes: readonly T[], sort: DownloadSort): T[] {
  const [field, direction] = sort.split(':') as [DownloadSortField, 'asc' | 'desc'];
  const sign = direction === 'asc' ? 1 : -1;
  const compare = (a: T, b: T): number => {
    switch (field) {
      case 'title':
        return a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true });
      case 'duration':
        return (a.duration ?? 0) - (b.duration ?? 0);
      case 'size':
        return sizeOf(a) - sizeOf(b);
      default:
        return (a.published_at ?? 0) - (b.published_at ?? 0);
    }
  };
  return [...episodes].sort(
    (a, b) => sign * compare(a, b) || (b.published_at ?? 0) - (a.published_at ?? 0) || b.id - a.id
  );
}

/** "Delete played" removes finished downloads that aren't favourites. */
export function playedToDelete<T extends { is_played: number; is_favorite: number }>(episodes: readonly T[]): T[] {
  return episodes.filter((episode) => episode.is_played === 1 && episode.is_favorite === 0);
}

/** Case-insensitive match on the episode or podcast title (every word). */
export function matchesDownloadSearch(episode: { title: string; feed_title: string }, term: string): boolean {
  const words = term.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const haystack = `${episode.title} ${episode.feed_title}`.toLowerCase();
  return words.every((word) => haystack.includes(word));
}

export type DownloadLogRow = {
  id: number;
  episode_id: number;
  episode_title: string;
  feed_title: string | null;
  url: string;
  status: 'success' | 'failed';
  error_code: string | null;
  error_message: string | null;
  created_at: number;
};

/** The copyable details of a log entry, for a bug report or the podcast's host. */
export function logDetails(entry: DownloadLogRow, formatDate: (ms: number) => string): string {
  return [
    entry.feed_title ? `${entry.feed_title}: ${entry.episode_title}` : entry.episode_title,
    `Status: ${entry.status === 'success' ? 'Downloaded' : 'Failed'}`,
    entry.error_code ? `Error: ${entry.error_code}` : null,
    entry.error_message ? `Reason: ${entry.error_message}` : null,
    `When: ${formatDate(entry.created_at)}`,
    `Address: ${entry.url}`,
  ]
    .filter(Boolean)
    .join('\n');
}
