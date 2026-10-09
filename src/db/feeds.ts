import { deleteFeedDownloads } from '@/player/downloads';
import { getDb } from './index';
import { searchWords } from './search';
import type { FeedRow, FeedWithCounts } from './types';

/** Columns shared by every feed select, so joins and plain reads stay in sync. */
// title is the listener's name for the podcast when they set one (Rename).
const FEED_COLUMNS = `
  f.id, f.feed_url, COALESCE(f.custom_title, f.title) AS title, f.author, f.description, f.image_url, f.link,
  f.language, f.explicit, f.etag, f.last_modified, f.last_refreshed_at,
  f.auto_download, f.keep_updated, f.created_at,
  f.playback_speed, f.skip_intro_seconds, f.next_page_url,
  f.state, f.last_refresh_error, f.episode_filter, f.episode_sort, f.funding,
  f.custom_title, f.tags, f.skip_ending_seconds, f.volume_reduction, f.auto_delete,
  f.new_episodes_action, f.auto_download_override, f.download_include, f.download_exclude,
  f.download_min_minutes
`;

export async function listFeeds(): Promise<FeedWithCounts[]> {
  return getDb().getAllAsync<FeedWithCounts>(
    `SELECT ${FEED_COLUMNS},
            COUNT(e.id) AS episode_count,
            COALESCE(SUM(CASE WHEN e.is_played = 0 THEN 1 ELSE 0 END), 0) AS unplayed_count,
            MAX(e.published_at) AS latest_published_at
       FROM feeds f
       LEFT JOIN episodes e ON e.feed_id = f.id
      WHERE f.state = 'subscribed'
      GROUP BY f.id
      ORDER BY COALESCE(f.custom_title, f.title) COLLATE NOCASE ASC`
  );
}

export async function getFeed(id: number): Promise<FeedWithCounts | null> {
  return getDb().getFirstAsync<FeedWithCounts>(
    `SELECT ${FEED_COLUMNS},
            COUNT(e.id) AS episode_count,
            COALESCE(SUM(CASE WHEN e.is_played = 0 THEN 1 ELSE 0 END), 0) AS unplayed_count,
            MAX(e.published_at) AS latest_published_at
       FROM feeds f
       LEFT JOIN episodes e ON e.feed_id = f.id
      WHERE f.id = ?
      GROUP BY f.id`,
    id
  );
}

/**
 * "Check your classics": the podcasts listened to most since `since`
 * ('YYYY-MM-DD'), by total listening time in playback_history.
 */
export async function listClassicFeeds(since: string, limit = 8): Promise<FeedWithCounts[]> {
  return getDb().getAllAsync<FeedWithCounts>(
    `SELECT ${FEED_COLUMNS},
            0 AS episode_count, 0 AS unplayed_count, NULL AS latest_published_at
       FROM feeds f
       JOIN (SELECT feed_id, SUM(listened_seconds) AS total
               FROM playback_history
              WHERE date >= ?
              GROUP BY feed_id) h ON h.feed_id = f.id
      WHERE f.state = 'subscribed'
      ORDER BY h.total DESC, COALESCE(f.custom_title, f.title) COLLATE NOCASE ASC
      LIMIT ?`,
    since,
    limit
  );
}

/** Subscribed podcasts whose title or author contains every word of `term`. */
export async function searchFeeds(term: string, limit = 20): Promise<FeedWithCounts[]> {
  const words = searchWords(term);
  if (words.length === 0) return [];
  return getDb().getAllAsync<FeedWithCounts>(
    `SELECT ${FEED_COLUMNS},
            0 AS episode_count, 0 AS unplayed_count, NULL AS latest_published_at
       FROM feeds f
      WHERE f.state = 'subscribed'
        AND ${words.map(() => "(COALESCE(f.custom_title, f.title) LIKE ? ESCAPE '\\' OR f.author LIKE ? ESCAPE '\\')").join(' AND ')}
      ORDER BY COALESCE(f.custom_title, f.title) COLLATE NOCASE ASC
      LIMIT ?`,
    ...words.flatMap((word) => [word, word]),
    limit
  );
}

export async function getFeedByUrl(feedUrl: string): Promise<FeedRow | null> {
  return getDb().getFirstAsync<FeedRow>('SELECT * FROM feeds WHERE feed_url = ?', feedUrl);
}

export async function isSubscribed(feedUrl: string): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ id: number }>(
    'SELECT id FROM feeds WHERE feed_url = ?',
    feedUrl
  );
  return row != null;
}

/** Feeds due for a refresh, oldest first. Skips feeds the user muted. */
export async function listFeedsToRefresh(staleAfterMs: number): Promise<FeedRow[]> {
  const cutoff = Date.now() - staleAfterMs;
  return getDb().getAllAsync<FeedRow>(
    `SELECT * FROM feeds
      WHERE keep_updated = 1 AND state = 'subscribed'
        AND (last_refreshed_at IS NULL OR last_refreshed_at < ?)
      ORDER BY COALESCE(last_refreshed_at, 0) ASC`,
    cutoff
  );
}

export async function deleteFeed(id: number): Promise<void> {
  // Clean up any downloaded media files on disk for this feed
  await deleteFeedDownloads(id);
  // ON DELETE CASCADE clears the feed's episodes, and the queue's cascade
  // clears any of those episodes that were queued.
  await getDb().runAsync('DELETE FROM feeds WHERE id = ?', id);
}

export async function setFeedFlags(
  id: number,
  flags: {
    autoDownload?: boolean;
    keepUpdated?: boolean;
    playbackSpeed?: number | null;
    skipIntroSeconds?: number | null;
  }
): Promise<void> {
  const db = getDb();
  if (flags.autoDownload !== undefined) {
    await db.runAsync(
      'UPDATE feeds SET auto_download_override = ? WHERE id = ?',
      flags.autoDownload ? 1 : 0,
      id
    );
  }
  if (flags.keepUpdated !== undefined) {
    await db.runAsync(
      'UPDATE feeds SET keep_updated = ? WHERE id = ?',
      flags.keepUpdated ? 1 : 0,
      id
    );
  }
  if (flags.playbackSpeed !== undefined) {
    await db.runAsync(
      'UPDATE feeds SET playback_speed = ? WHERE id = ?',
      flags.playbackSpeed,
      id
    );
  }
  if (flags.skipIntroSeconds !== undefined) {
    await db.runAsync(
      'UPDATE feeds SET skip_intro_seconds = ? WHERE id = ?',
      flags.skipIntroSeconds,
      id
    );
  }
}

/** Every subscribed feed URL, for OPML export. */
/** Subscribed podcasts' addresses and ids, for marking directory results as already followed. */
export async function listSubscribedUrls(): Promise<{ id: number; feed_url: string }[]> {
  return getDb().getAllAsync<{ id: number; feed_url: string }>(
    "SELECT id, feed_url FROM feeds WHERE state = 'subscribed'"
  );
}

export async function listFeedUrls(): Promise<Pick<FeedRow, 'title' | 'feed_url' | 'link'>[]> {
  return getDb().getAllAsync(
    "SELECT title, feed_url, link FROM feeds WHERE state = 'subscribed' ORDER BY title COLLATE NOCASE"
  );
}

/** The podcast page's saved filter and/or sort (undefined leaves one unchanged). */
export async function setFeedViewPrefs(
  id: number,
  prefs: { episodeFilter?: string | null; episodeSort?: string | null }
): Promise<void> {
  const db = getDb();
  if (prefs.episodeFilter !== undefined) {
    await db.runAsync('UPDATE feeds SET episode_filter = ? WHERE id = ?', prefs.episodeFilter || null, id);
  }
  if (prefs.episodeSort !== undefined) {
    await db.runAsync('UPDATE feeds SET episode_sort = ? WHERE id = ?', prefs.episodeSort || null, id);
  }
}

/** Turns a preview into a subscription. */
export async function subscribeFeed(id: number): Promise<void> {
  await getDb().runAsync("UPDATE feeds SET state = 'subscribed' WHERE id = ?", id);
}

/** Previews younger than this survive a restart (an app crash shouldn't lose one). */
export const PREVIEW_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Removes previews that were looked at but not subscribed to (run at startup,
 * when no preview is on screen) once they are a day old (D-016). A preview is
 * kept while one of its episodes is queued, downloaded, a favourite, or the
 * one the player is restoring, so nothing the listener chose to keep disappears.
 */
export async function removeStalePreviews(
  keepEpisodeId: number | null,
  now: number = Date.now()
): Promise<number> {
  const db = getDb();
  const stale = await db.getAllAsync<{ id: number }>(
    `SELECT f.id FROM feeds f
      WHERE f.state = 'preview'
        AND f.created_at < ?
        AND NOT EXISTS (
          SELECT 1 FROM episodes e
           WHERE e.feed_id = f.id
             AND (e.id = ? OR e.is_favorite = 1 OR e.download_state != 'none'
                  OR e.id IN (SELECT episode_id FROM queue))
        )`,
    now - PREVIEW_TTL_MS,
    keepEpisodeId ?? -1
  );
  for (const { id } of stale) await db.runAsync('DELETE FROM feeds WHERE id = ?', id);
  return stale.length;
}

export type FeedStats = {
  total: number;
  played: number;
  downloaded: number;
  downloadedBytes: number;
  firstPublished: number | null;
  latestPublished: number | null;
  listenedSeconds: number;
};

/** The numbers on the podcast info page. */
export async function getFeedStats(feedId: number): Promise<FeedStats> {
  const db = getDb();
  const row = await db.getFirstAsync<Omit<FeedStats, 'listenedSeconds'>>(
    `SELECT COUNT(*) AS total,
            COALESCE(SUM(is_played), 0) AS played,
            COALESCE(SUM(CASE WHEN download_state = 'done' THEN 1 ELSE 0 END), 0) AS downloaded,
            COALESCE(SUM(CASE WHEN download_state = 'done'
                              THEN COALESCE(downloaded_bytes, media_size, 0) ELSE 0 END), 0) AS downloadedBytes,
            MIN(published_at) AS firstPublished,
            MAX(published_at) AS latestPublished
       FROM episodes WHERE feed_id = ?`,
    feedId
  );
  const listened = await db.getFirstAsync<{ seconds: number }>(
    'SELECT COALESCE(SUM(listened_seconds), 0) AS seconds FROM playback_history WHERE feed_id = ?',
    feedId
  );
  return {
    total: row?.total ?? 0,
    played: row?.played ?? 0,
    downloaded: row?.downloaded ?? 0,
    downloadedBytes: row?.downloadedBytes ?? 0,
    firstPublished: row?.firstPublished ?? null,
    latestPublished: row?.latestPublished ?? null,
    listenedSeconds: listened?.seconds ?? 0,
  };
}

/** Per-podcast settings, by name → column. Booleans store 1/0; null means "use the global setting". */
const PREF_COLUMNS = {
  customTitle: 'custom_title',
  tags: 'tags',
  playbackSpeed: 'playback_speed',
  skipIntroSeconds: 'skip_intro_seconds',
  skipEndingSeconds: 'skip_ending_seconds',
  volumeReduction: 'volume_reduction',
  keepUpdated: 'keep_updated',
  newEpisodesAction: 'new_episodes_action',
  autoDownload: 'auto_download_override',
  downloadInclude: 'download_include',
  downloadExclude: 'download_exclude',
  downloadMinMinutes: 'download_min_minutes',
  autoDelete: 'auto_delete',
} as const;

export type FeedPrefs = {
  customTitle: string | null;
  tags: string | null;
  playbackSpeed: number | null;
  skipIntroSeconds: number | null;
  skipEndingSeconds: number | null;
  volumeReduction: number | null;
  keepUpdated: boolean;
  newEpisodesAction: string | null;
  autoDownload: boolean | null;
  downloadInclude: string | null;
  downloadExclude: string | null;
  downloadMinMinutes: number | null;
  autoDelete: boolean | null;
};

/** Saves any of a podcast's settings in one statement (only the keys given). */
export async function setFeedPrefs(id: number, prefs: Partial<FeedPrefs>): Promise<void> {
  const entries = (Object.keys(prefs) as (keyof FeedPrefs)[]).filter((key) => key in PREF_COLUMNS);
  if (entries.length === 0) return;
  const values = entries.map((key) => {
    const value = prefs[key];
    if (typeof value === 'boolean') return value ? 1 : 0;
    // An empty text field clears the setting rather than storing "".
    if (typeof value === 'string' && value.trim() === '') return null;
    return value ?? null;
  });
  await getDb().runAsync(
    `UPDATE feeds SET ${entries.map((key) => `${PREF_COLUMNS[key]} = ?`).join(', ')} WHERE id = ?`,
    ...values,
    id
  );
}

/**
 * Points a podcast at a new feed address (AntennaPod's "Edit feed URL"). The
 * cache validators are cleared so the next refresh reads the new feed in full.
 * Refuses an address another podcast already uses.
 */
export async function setFeedUrl(id: number, feedUrl: string): Promise<void> {
  const taken = await getDb().getFirstAsync<{ id: number }>(
    'SELECT id FROM feeds WHERE feed_url = ? AND id != ?',
    feedUrl,
    id
  );
  if (taken) throw new Error('Another podcast already uses that address.');
  await getDb().runAsync(
    'UPDATE feeds SET feed_url = ?, etag = NULL, last_modified = NULL WHERE id = ?',
    feedUrl,
    id
  );
}
