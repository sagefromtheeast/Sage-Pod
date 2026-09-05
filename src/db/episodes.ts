import { getDb } from './index';
import type { DownloadState, EpisodeRow, EpisodeWithFeed } from './types';

/**
 * An episode counts as finished once the listener is within this many seconds
 * of the end — most podcasts close with credits nobody sits through.
 */
export const COMPLETION_TAIL_SECONDS = 20;

const EPISODE_WITH_FEED = `
  SELECT e.*, f.title AS feed_title, f.image_url AS feed_image_url, f.author AS feed_author,
         f.playback_speed AS feed_playback_speed, f.skip_intro_seconds AS feed_skip_intro_seconds
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
  | 'season_asc';

export type EpisodeFilterOptions = {
  includePlayed?: boolean;
  unplayedOnly?: boolean;
  downloadedOnly?: boolean;
  favoritesOnly?: boolean;
  inProgressOnly?: boolean;
};

export type ListEpisodesOptions = {
  filters?: EpisodeFilterOptions;
  sort?: EpisodeSortKey;
  includePlayed?: boolean;
  limit?: number;
};

export async function listEpisodesForFeed(
  feedId: number,
  options: ListEpisodesOptions = {}
): Promise<EpisodeWithFeed[]> {
  const { filters = {}, sort = 'date_desc', limit = 500, includePlayed } = options;
  const whereClauses = ['e.feed_id = ?'];
  const args: (number | string)[] = [feedId];

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

  const sortClauses: Record<EpisodeSortKey, string> = {
    date_desc: 'e.published_at DESC, e.id DESC',
    date_asc: 'e.published_at ASC, e.id ASC',
    duration_asc: 'e.duration ASC',
    duration_desc: 'e.duration DESC',
    title_asc: 'e.title COLLATE NOCASE ASC',
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
export async function listRecentEpisodes(limit = 100): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      ORDER BY e.published_at DESC, e.id DESC
      LIMIT ?`,
    limit
  );
}

/** Started but unfinished — "Continue listening". */
export async function listInProgressEpisodes(limit = 20): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.position > 30 AND e.is_played = 0
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

/** Full-text-ish search over titles and show notes of subscribed episodes. */
export async function searchEpisodes(term: string, limit = 60): Promise<EpisodeWithFeed[]> {
  const like = `%${term.replace(/[%_]/g, (c) => `\\${c}`)}%`;
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.title LIKE ? ESCAPE '\\' OR e.description LIKE ? ESCAPE '\\'
      ORDER BY e.published_at DESC
      LIMIT ?`,
    like,
    like,
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

export async function markPlayed(episodeId: number, played = true): Promise<void> {
  await getDb().runAsync(
    `UPDATE episodes
        SET is_played = ?, is_new = 0, played_at = ?, position = CASE WHEN ? THEN 0 ELSE position END
      WHERE id = ?`,
    played ? 1 : 0,
    Date.now(),
    played ? 1 : 0,
    episodeId
  );
}

export async function markFeedPlayed(feedId: number): Promise<void> {
  await getDb().runAsync(
    'UPDATE episodes SET is_played = 1, is_new = 0, position = 0, played_at = ? WHERE feed_id = ?',
    Date.now(),
    feedId
  );
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
  limit: number
): Promise<EpisodeRow[]> {
  return getDb().getAllAsync<EpisodeRow>(
    `SELECT * FROM episodes
      WHERE feed_id = ? AND is_played = 0 AND download_state = 'none'
      ORDER BY published_at DESC
      LIMIT ?`,
    feedId,
    limit
  );
}

export type InboxFeedInfo = {
  id: number;
  title: string;
  image_url: string | null;
  unplayed_count: number;
};

export async function listInboxEpisodes(
  options: { feedId?: number | null; limit?: number } | number = 100
): Promise<EpisodeWithFeed[]> {
  const limit = typeof options === 'number' ? options : options.limit ?? 100;
  const feedId = typeof options === 'number' ? undefined : options.feedId;

  if (feedId != null) {
    return getDb().getAllAsync<EpisodeWithFeed>(
      `${EPISODE_WITH_FEED}
        WHERE e.is_new = 1 AND e.is_played = 0 AND e.feed_id = ?
        ORDER BY e.published_at DESC, e.id DESC
        LIMIT ?`,
      feedId,
      limit
    );
  }

  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.is_new = 1 AND e.is_played = 0
      ORDER BY e.published_at DESC, e.id DESC
      LIMIT ?`,
    limit
  );
}

export async function listInboxFeeds(): Promise<InboxFeedInfo[]> {
  return getDb().getAllAsync<InboxFeedInfo>(
    `SELECT f.id, f.title, f.image_url, COUNT(e.id) AS unplayed_count
       FROM feeds f
       JOIN episodes e ON e.feed_id = f.id
      WHERE e.is_new = 1 AND e.is_played = 0
      GROUP BY f.id, f.title, f.image_url
      ORDER BY f.title COLLATE NOCASE ASC`
  );
}

export async function getInboxCount(): Promise<number> {
  const row = await getDb().getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM episodes WHERE is_new = 1 AND is_played = 0`
  );
  return row?.count ?? 0;
}

export async function dismissFromInbox(episodeId: number): Promise<void> {
  await getDb().runAsync('UPDATE episodes SET is_new = 0 WHERE id = ?', episodeId);
}

export async function dismissAllFromInbox(): Promise<void> {
  await getDb().runAsync('UPDATE episodes SET is_new = 0 WHERE is_new = 1');
}

export async function listRandomUnplayedEpisodes(limit = 10, seed = 0): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(
    `${EPISODE_WITH_FEED}
      WHERE e.is_played = 0 AND e.position = 0
      ORDER BY RANDOM()
      LIMIT ?`,
    limit
  );
}
