import { SURPRISE_MODULUS } from '@/discover/surpriseSeed';
import { EPISODE_WITH_FEED_COLUMNS } from './columns';
import { getDb } from './index';
import { searchWords } from './search';
import { filterClauses, type EpisodeFilter } from '@/feed/episodeFilter';
import type { DownloadState, EpisodeRow, EpisodeWithFeed } from './types';

/** For queries on `episodes` alone: the episode's podcast is a subscription. */
const SUBSCRIBED_FEED = "feed_id IN (SELECT id FROM feeds WHERE state = 'subscribed')";

const EPISODE_WITH_FEED = `
  SELECT ${EPISODE_WITH_FEED_COLUMNS}
    FROM episodes e
    JOIN feeds f ON f.id = e.feed_id
`;

export async function getEpisode(id: number): Promise<EpisodeWithFeed | null> {
  return getDb().getFirstAsync<EpisodeWithFeed>(`${EPISODE_WITH_FEED} WHERE e.id = ?`, id);
}

export type EpisodeSortKey =
  | 'date_desc'
  | 'date_asc'
  | 'duration_asc'
  | 'duration_desc'
  | 'title_asc'
  | 'title_desc'
  | 'season_asc';

export const EPISODE_SORT_KEYS: readonly EpisodeSortKey[] = [
  'date_desc',
  'date_asc',
  'duration_asc',
  'duration_desc',
  'title_asc',
  'title_desc',
  'season_asc',
];

export const EPISODE_SORT_LABELS: Record<EpisodeSortKey, string> = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  duration_asc: 'Shortest first',
  duration_desc: 'Longest first',
  title_asc: 'Title A–Z',
  title_desc: 'Title Z–A',
  season_asc: 'Season and episode',
};

export const parseEpisodeSort = (raw: string | null | undefined): EpisodeSortKey =>
  EPISODE_SORT_KEYS.includes(raw as EpisodeSortKey) ? (raw as EpisodeSortKey) : 'date_desc';

export type EpisodeFilterOptions = {
  includePlayed?: boolean;
  unplayedOnly?: boolean;
  downloadedOnly?: boolean;
  favoritesOnly?: boolean;
  inProgressOnly?: boolean;
};

export type ListEpisodesOptions = {
  filters?: EpisodeFilterOptions;
  /** The podcast page's saved include/exclude filter. */
  episodeFilter?: EpisodeFilter;
  /** Every word must appear in the title or show notes. */
  search?: string;
  sort?: EpisodeSortKey;
  includePlayed?: boolean;
  limit?: number;
};

export async function listEpisodesForFeed(
  feedId: number,
  options: ListEpisodesOptions = {}
): Promise<EpisodeWithFeed[]> {
  return listEpisodesWhere('e.feed_id = ?', [feedId], options);
}

/** Every subscribed podcast's episodes (the Library's Episodes screen), filtered and sorted. */
export async function listAllEpisodes(options: ListEpisodesOptions = {}): Promise<EpisodeWithFeed[]> {
  return listEpisodesWhere("f.state = 'subscribed'", [], options);
}

async function listEpisodesWhere(
  scope: string,
  scopeArgs: (number | string)[],
  options: ListEpisodesOptions
): Promise<EpisodeWithFeed[]> {
  const { filters = {}, sort = 'date_desc', limit = 500, includePlayed, episodeFilter, search } = options;
  const whereClauses = [scope];
  const args: (number | string)[] = [...scopeArgs];

  const hidePlayed = includePlayed === false || filters.unplayedOnly;
  if (hidePlayed) {
    whereClauses.push('e.is_played = 0');
  }
  if (filters.downloadedOnly) {
    whereClauses.push("e.download_state = 'done'");
  }
  if (filters.favoritesOnly) {
    whereClauses.push('e.is_favorite = 1');
  }
  if (filters.inProgressOnly) {
    whereClauses.push('e.position > 30 AND e.is_played = 0');
  }
  if (episodeFilter) whereClauses.push(...filterClauses(episodeFilter));
  for (const word of searchWords(search ?? '')) {
    whereClauses.push("(e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\')");
    args.push(word, word);
  }

  const sortClauses: Record<EpisodeSortKey, string> = {
    date_desc: 'e.published_at DESC, e.id DESC',
    date_asc: 'e.published_at ASC, e.id ASC',
    duration_asc: 'e.duration ASC',
    duration_desc: 'e.duration DESC',
    title_asc: 'e.title COLLATE NOCASE ASC',
    title_desc: 'e.title COLLATE NOCASE DESC',
    season_asc: 'COALESCE(e.season, 1) ASC, COALESCE(e.episode_number, 0) ASC, e.published_at ASC',
  };

  const whereSql = whereClauses.join(' AND ');
  const orderSql = sortClauses[sort] ?? sortClauses.date_desc;

  args.push(limit);

  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE ${whereSql}
      ORDER BY ${orderSql}
      LIMIT ?`,
    ...args
  );
}

/** Newest episodes across every subscription — the "Inbox" screen. */
/** A podcast's episode ids, newest first (the podcast page's default order), for swiping between episodes. */
export async function listFeedEpisodeIds(feedId: number): Promise<number[]> {
  const rows = await getDb().getAllAsync<{ id: number }>(
    'SELECT id FROM episodes WHERE feed_id = ? ORDER BY published_at DESC, id DESC',
    feedId
  );
  return rows.map((row) => row.id);
}

export async function listRecentEpisodes(limit = 100): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE f.state = 'subscribed'
      ORDER BY e.published_at DESC, e.id DESC
      LIMIT ?`,
    limit
  );
}

/** Started but unfinished — "Continue listening". */
export async function listInProgressEpisodes(
  limit = 20,
  options: { excludeQueued?: boolean } = {}
): Promise<EpisodeWithFeed[]> {
  // Excluding in SQL (not after the LIMIT) so a long queue can't crowd out
  // older unqueued episodes.
  const notQueued = options.excludeQueued ? 'AND e.id NOT IN (SELECT episode_id FROM queue)' : '';
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE f.state = 'subscribed' AND e.position > 30 AND e.is_played = 0 ${notQueued}
      ORDER BY e.played_at DESC
      LIMIT ?`,
    limit
  );
}

export async function listFavorites(limit = 200): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.is_favorite = 1
      ORDER BY e.published_at DESC
      LIMIT ?`,
    limit
  );
}

export type DownloadSortKey = 'date' | 'size' | 'duration';

export async function listDownloaded(sort: DownloadSortKey = 'date'): Promise<EpisodeWithFeed[]> {
  const orderMap: Record<DownloadSortKey, string> = {
    date: 'e.published_at DESC',
    size: 'COALESCE(e.downloaded_bytes, e.media_size, 0) DESC',
    duration: 'COALESCE(e.duration, 0) DESC',
  };
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.download_state = 'done' AND e.local_path IS NOT NULL
      ORDER BY ${orderMap[sort] ?? orderMap.date}`
  );
}

export async function listHistory(limit = 100): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.played_at IS NOT NULL
      ORDER BY e.played_at DESC
      LIMIT ?`,
    limit
  );
}

/**
 * Searches subscribed episodes: each word of `term` must appear in the title
 * or the show notes (AntennaPod's search), newest first.
 */
export async function searchEpisodes(term: string, limit = 60): Promise<EpisodeWithFeed[]> {
  const words = searchWords(term);
  if (words.length === 0) return [];
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE f.state = 'subscribed'
        AND ${words.map(() => "(e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\')").join(' AND ')}
      ORDER BY e.published_at DESC
      LIMIT ?`,
    ...words.flatMap((word) => [word, word]),
    limit
  );
}

/** Persists playback position. Called on a timer while playing, so keep it cheap. */
export async function savePosition(
  episodeId: number,
  positionSeconds: number,
  durationSeconds?: number | null
): Promise<void> {
  const position = Math.max(0, Math.floor(positionSeconds));
  const db = getDb();

  if (durationSeconds && Number.isFinite(durationSeconds) && durationSeconds > 0) {
    await db.runAsync(
      `UPDATE episodes
          SET position = ?, duration = COALESCE(duration, ?), played_at = ?, is_new = 0
        WHERE id = ?`,
      position,
      Math.floor(durationSeconds),
      Date.now(),
      episodeId
    );
  } else {
    await db.runAsync(
      'UPDATE episodes SET position = ?, played_at = ?, is_new = 0 WHERE id = ?',
      position,
      Date.now(),
      episodeId
    );
  }
}

/** `?, ?, …` for an `IN (…)` list of `n` values. */
const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/**
 * Marks episodes played (or unplayed). Only marking played stamps
 * `played_at`: History is ordered by it, and marking something unplayed isn't
 * listening to it.
 */
export async function markPlayedMany(episodeIds: readonly number[], played = true): Promise<void> {
  if (episodeIds.length === 0) return;
  await getDb().runAsync(
    `UPDATE episodes
        SET is_played = ?, is_new = 0,
            played_at = CASE WHEN ? THEN ? ELSE played_at END,
            position = CASE WHEN ? THEN 0 ELSE position END
      WHERE id IN (${placeholders(episodeIds.length)})`,
    played ? 1 : 0,
    played ? 1 : 0,
    Date.now(),
    played ? 1 : 0,
    ...episodeIds
  );
}

export async function markPlayed(episodeId: number, played = true): Promise<void> {
  await markPlayedMany([episodeId], played);
}

export async function markFeedPlayed(feedId: number): Promise<void> {
  await getDb().runAsync(
    'UPDATE episodes SET is_played = 1, is_new = 0, position = 0, played_at = ? WHERE feed_id = ?',
    Date.now(),
    feedId
  );
}

export async function setFavoriteMany(episodeIds: readonly number[], favorite: boolean): Promise<void> {
  if (episodeIds.length === 0) return;
  await getDb().runAsync(
    `UPDATE episodes SET is_favorite = ? WHERE is_favorite != ? AND id IN (${placeholders(episodeIds.length)})`,
    favorite ? 1 : 0,
    favorite ? 1 : 0,
    ...episodeIds
  );
}

/** Starts episodes over from the beginning next time they play. */
export async function resetPositionMany(episodeIds: readonly number[]): Promise<void> {
  if (episodeIds.length === 0) return;
  await getDb().runAsync(
    `UPDATE episodes SET position = 0 WHERE position != 0 AND id IN (${placeholders(episodeIds.length)})`,
    ...episodeIds
  );
}

/** The playback fields an action can change, captured so Undo can put them back. */
export type PlaybackSnapshot = {
  is_played: number;
  is_new: number;
  position: number;
  played_at: number | null;
};

export async function getPlaybackSnapshots(
  episodeIds: readonly number[]
): Promise<Map<number, PlaybackSnapshot>> {
  if (episodeIds.length === 0) return new Map();
  const rows = await getDb().getAllAsync<PlaybackSnapshot & { id: number }>(
    `SELECT id, is_played, is_new, position, played_at FROM episodes
      WHERE id IN (${placeholders(episodeIds.length)})`,
    ...episodeIds
  );
  return new Map(rows.map(({ id, ...snapshot }) => [id, snapshot]));
}

/**
 * Puts back the given fields of what `getPlaybackSnapshots` captured, in one
 * transaction. Restore only what the undone action changed: restoring
 * `position` for an inbox undo would rewind an episode that kept playing.
 */
export async function restorePlaybackSnapshots(
  snapshots: Map<number, PlaybackSnapshot>,
  fields: readonly (keyof PlaybackSnapshot)[]
): Promise<void> {
  if (fields.length === 0 || snapshots.size === 0) return;
  // Column names come from the PlaybackSnapshot keys, never from input.
  const assignments = fields.map((field) => `${field} = ?`).join(', ');
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const [id, snapshot] of snapshots) {
      await db.runAsync(
        `UPDATE episodes SET ${assignments} WHERE id = ?`,
        ...fields.map((field) => snapshot[field]),
        id
      );
    }
  });
}

/** Just the favourite flag, for the player's heart (cheaper than re-reading the whole episode). */
export async function isFavorite(episodeId: number): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ is_favorite: number }>(
    'SELECT is_favorite FROM episodes WHERE id = ?',
    episodeId
  );
  return row?.is_favorite === 1;
}

export async function toggleFavorite(episodeId: number): Promise<void> {
  await getDb().runAsync(
    'UPDATE episodes SET is_favorite = CASE is_favorite WHEN 1 THEN 0 ELSE 1 END WHERE id = ?',
    episodeId
  );
}

export async function setDownloadState(
  episodeId: number,
  state: DownloadState,
  localPath?: string | null,
  downloadedBytes?: number | null
): Promise<void> {
  await getDb().runAsync(
    `UPDATE episodes
        SET download_state = ?, local_path = ?, downloaded_bytes = ?
      WHERE id = ?`,
    state,
    localPath ?? null,
    downloadedBytes ?? null,
    episodeId
  );
}

/** Downloads waiting, running or failed (the Downloads screen's top section), oldest first. */
export async function listActiveDownloads(): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.download_state IN ('queued', 'downloading', 'error')
      ORDER BY e.download_state = 'error', e.published_at ASC`
  );
}

/** Episodes queued for download, oldest queued first. */
export async function listPendingDownloads(): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.download_state IN ('queued', 'downloading')
      ORDER BY e.published_at ASC`
  );
}

/** The `n` newest not-yet-downloaded episodes of an auto-download feed. */
export async function listAutoDownloadCandidates(
  feedId: number,
  limit: number,
  offset = 0
): Promise<EpisodeRow[]> {
  return getDb().getAllAsync<EpisodeRow>(
    `SELECT * FROM episodes
      WHERE feed_id = ? AND is_played = 0 AND download_state = 'none'
      ORDER BY published_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    feedId,
    limit,
    offset
  );
}

export type InboxFeedInfo = {
  id: number;
  title: string;
  image_url: string | null;
  unplayed_count: number;
};

/** Inbox orders (AntennaPod's inbox sort), saved in the `inboxSort` setting. */
export type InboxSort = 'date:desc' | 'date:asc' | 'duration:asc' | 'duration:desc';

const INBOX_ORDER: Record<InboxSort, string> = {
  'date:desc': 'e.published_at DESC, e.id DESC',
  'date:asc': 'e.published_at ASC, e.id ASC',
  'duration:asc': 'COALESCE(e.duration, 0) ASC, e.published_at DESC',
  'duration:desc': 'COALESCE(e.duration, 0) DESC, e.published_at DESC',
};

export async function listInboxEpisodes(
  options: { feedId?: number | null; limit?: number; sort?: InboxSort; search?: string } | number = 100
): Promise<EpisodeWithFeed[]> {
  const opts = typeof options === 'number' ? { limit: options } : options;
  const limit = opts.limit ?? 100;
  // Whitelisted: the ORDER BY can't take a bound parameter.
  const order = INBOX_ORDER[opts.sort ?? 'date:desc'] ?? INBOX_ORDER['date:desc'];

  // Only subscriptions feed the Inbox (D-016, D-019), whatever is_new says.
  const where = ['e.is_new = 1', 'e.is_played = 0', "f.state = 'subscribed'"];
  const params: (string | number)[] = [];
  if (opts.feedId != null) {
    where.push('e.feed_id = ?');
    params.push(opts.feedId);
  }
  const term = opts.search?.trim();
  if (term) {
    // Match the episode or podcast title; % and _ in the term are literal.
    const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push("(e.title LIKE ? ESCAPE '\\' OR COALESCE(f.custom_title, f.title) LIKE ? ESCAPE '\\')");
    params.push(like, like);
  }

  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE ${where.join(' AND ')}
      ORDER BY ${order}
      LIMIT ?`,
    ...params,
    limit
  );
}

/** Every inbox episode's id (optionally one podcast's), for "Remove all" and its undo. */
export async function listInboxIds(feedId: number | null = null): Promise<number[]> {
  const rows = await getDb().getAllAsync<{ id: number }>(
    feedId === null
      ? `SELECT id FROM episodes WHERE is_new = 1 AND is_played = 0 AND ${SUBSCRIBED_FEED}`
      : `SELECT id FROM episodes WHERE is_new = 1 AND is_played = 0 AND ${SUBSCRIBED_FEED} AND feed_id = ?`,
    ...(feedId === null ? [] : [feedId])
  );
  return rows.map((row) => row.id);
}

export async function listInboxFeeds(): Promise<InboxFeedInfo[]> {
  return getDb().getAllAsync<InboxFeedInfo>(
    `SELECT f.id, COALESCE(f.custom_title, f.title) AS title, f.image_url, COUNT(e.id) AS unplayed_count
       FROM feeds f
       JOIN episodes e ON e.feed_id = f.id
      WHERE e.is_new = 1 AND e.is_played = 0 AND f.state = 'subscribed'
      GROUP BY f.id
      ORDER BY COALESCE(f.custom_title, f.title) COLLATE NOCASE ASC`
  );
}

export async function getInboxCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM episodes WHERE is_new = 1 AND is_played = 0 AND ${SUBSCRIBED_FEED}`
  );
  return row?.count ?? 0;
}

/** The inbox episodes of some podcasts (for "Remove all from inbox" on a selection). */
export async function listInboxIdsForFeeds(feedIds: readonly number[]): Promise<number[]> {
  if (feedIds.length === 0) return [];
  const rows = await getDb().getAllAsync<{ id: number }>(
    `SELECT id FROM episodes WHERE is_new = 1 AND is_played = 0 AND feed_id IN (${placeholders(feedIds.length)})`,
    ...feedIds
  );
  return rows.map((row) => row.id);
}

/**
 * Takes episodes out of the inbox. Only touches rows still marked new, so it
 * writes nothing (and wakes no screens) when they already left.
 */
export async function dismissManyFromInbox(episodeIds: readonly number[]): Promise<void> {
  if (episodeIds.length === 0) return;
  await getDb().runAsync(
    `UPDATE episodes SET is_new = 0 WHERE is_new = 1 AND id IN (${placeholders(episodeIds.length)})`,
    ...episodeIds
  );
}

export async function dismissFromInbox(episodeId: number): Promise<void> {
  await dismissManyFromInbox([episodeId]);
}

export async function dismissAllFromInbox(): Promise<void> {
  await getDb().runAsync('UPDATE episodes SET is_new = 0 WHERE is_new = 1');
}

const SURPRISE_MAX_AGE_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const SURPRISE_JUST_STARTED_MS = 60 * 60 * 1000;

/**
 * Unplayed episodes for the "Surprise Me" shelf, in an order fixed by `seed`.
 *
 * The same seed returns the same list, so the shelf holds still while the
 * player saves positions; a new seed is a new shuffle. Picks round-robin
 * across podcasts — one from each before a second from any — so the shelf
 * favours variety but still fills up when there are only a few subscriptions.
 *
 * Skips episodes older than two years (stale feeds often have broken artwork)
 * and half-listened ones, except an episode started within the last hour —
 * otherwise the episode you just tapped play on would vanish from the shelf.
 */
export async function listSurpriseEpisodes(
  limit: number,
  seed: number,
  now: number = Date.now()
): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `SELECT * FROM (
       SELECT c.*,
              ROW_NUMBER() OVER (
                PARTITION BY c.feed_id
                ORDER BY (c.id * ?) % ${SURPRISE_MODULUS} DESC, c.id
              ) AS feed_rank
         FROM (${EPISODE_WITH_FEED}
                WHERE f.state = 'subscribed' AND e.is_played = 0
                  AND (e.published_at IS NULL OR e.published_at > ?)
                  AND (e.position = 0 OR e.played_at > ?)) c
     )
     ORDER BY feed_rank, (id * ? * 3) % ${SURPRISE_MODULUS} DESC, id
     LIMIT ?`,
    seed,
    now - SURPRISE_MAX_AGE_MS,
    now - SURPRISE_JUST_STARTED_MS,
    seed,
    limit
  );
}
