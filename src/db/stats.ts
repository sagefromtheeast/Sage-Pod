import { RELEASE_WINDOW } from '@/stats/releaseSchedule';
import { localDay, markedPlayedRows, type ListenRow, type PlayedEpisodeRow } from '@/stats/aggregate';

import { getDb, quietRows } from './index';
import { getMeta, setMeta } from './settings';

const STATS_RESET_KEY = 'statsReset';

/**
 * The last Reset statistics: when it happened and the newest history row at
 * that moment. Statistics count only rows after it, so nothing is deleted.
 */
export type StatsReset = { at: number; rowId: number };

/** Cached for `addListenedSeconds`, which runs every few seconds during playback. */
let cachedReset: StatsReset | null | undefined;

export async function getStatsReset(): Promise<StatsReset | null> {
  if (cachedReset !== undefined) return cachedReset;
  const raw = await getMeta(STATS_RESET_KEY);
  let reset: StatsReset | null = null;
  try {
    const value = raw ? (JSON.parse(raw) as Partial<StatsReset>) : null;
    if (value && Number.isFinite(value.at) && Number.isFinite(value.rowId)) {
      reset = { at: value.at!, rowId: value.rowId! };
    }
  } catch {
    // An unreadable value counts as never reset.
  }
  cachedReset = reset;
  return reset;
}

/**
 * Adds listening time to today's history row for the episode. `quiet` is for
 * the player's periodic save: growing an existing row then repaints nothing
 * (the next pause does); a new row still does.
 */
export async function addListenedSeconds(
  feedId: number,
  episodeId: number,
  seconds: number,
  options: { quiet?: boolean } = {}
): Promise<void> {
  const date = localDay(Date.now());
  const db = getDb();
  const reset = await getStatsReset();

  // Add to today's row for this episode, unless that row is from before a
  // reset: then start a new one, so the time after the reset is counted.
  const existing = await db.getFirstAsync<{ id: number; listened_seconds: number }>(
    'SELECT id, listened_seconds FROM playback_history WHERE episode_id = ? AND date = ? AND id > ?',
    episodeId,
    date,
    reset?.rowId ?? 0
  );

  if (existing) {
    if (options.quiet) quietRows.expect('playback_history', existing.id, Date.now());
    await db.runAsync(
      'UPDATE playback_history SET listened_seconds = ? WHERE id = ?',
      existing.listened_seconds + seconds,
      existing.id
    );
  } else {
    await db.runAsync(
      'INSERT INTO playback_history (feed_id, episode_id, listened_seconds, date) VALUES (?, ?, ?, ?)',
      feedId,
      episodeId,
      seconds,
      date
    );
  }
}

/**
 * Reset statistics (AntennaPod's menu item): they count from now on. The
 * history itself stays, because Home's "Check your classics" and the podcast
 * info page's "Listened" read it.
 */
export async function resetStatistics(now = Date.now()): Promise<void> {
  const db = getDb();
  const row = await db.getFirstAsync<{ rowId: number | null }>('SELECT MAX(id) AS rowId FROM playback_history');
  const reset = { at: now, rowId: row?.rowId ?? 0 };
  await setMeta(STATS_RESET_KEY, JSON.stringify(reset));
  cachedReset = reset;
}

/** The filter's date bounds and podcast as SQL conditions on the given columns. */
function conditions(filter: StatsFilter, day: string, feed: string): { sql: string[]; args: (string | number)[] } {
  const sql: string[] = [];
  const args: (string | number)[] = [];
  if (filter.from) {
    sql.push(`${day} >= ?`);
    args.push(filter.from);
  }
  if (filter.to) {
    sql.push(`${day} <= ?`);
    args.push(filter.to);
  }
  if (filter.feedId !== undefined) {
    sql.push(`${feed} = ?`);
    args.push(filter.feedId);
  }
  return { sql, args };
}

export type StatsFilter = {
  from: string | null;
  to: string | null;
  includeMarkedPlayed: boolean;
  /** The last reset: older history rows and plays don't count. */
  reset: StatsReset | null;
  feedId?: number;
};

/**
 * Listening time per podcast per month within the filter: what was heard,
 * plus, when asked, the unheard part of episodes marked played. Grouped by
 * the helpers in `src/stats/aggregate`.
 */
export async function getListenRows(filter: StatsFilter): Promise<ListenRow[]> {
  const db = getDb();
  const heardWhere = conditions(filter, 'date', 'feed_id');
  const heard = await db.getAllAsync<ListenRow>(
    `SELECT feed_id AS feedId, substr(date, 1, 7) AS month, SUM(listened_seconds) AS seconds
       FROM playback_history
      WHERE id > ? ${heardWhere.sql.map((c) => `AND ${c}`).join(' ')}
      GROUP BY feed_id, month`,
    filter.reset?.rowId ?? 0,
    ...heardWhere.args
  );
  if (!filter.includeMarkedPlayed) return heard;

  // played_at is when the episode was last played, which is also what
  // AntennaPod's statistics date "marked played" time by.
  const playedWhere = conditions(filter, "date(e.played_at / 1000, 'unixepoch', 'localtime')", 'e.feed_id');
  const played = await db.getAllAsync<PlayedEpisodeRow>(
    `SELECT e.feed_id AS feedId, strftime('%Y-%m', e.played_at / 1000, 'unixepoch', 'localtime') AS month,
            e.duration AS duration, COALESCE(h.seconds, 0) AS listened
       FROM episodes e
       LEFT JOIN (SELECT episode_id, SUM(listened_seconds) AS seconds
                    FROM playback_history GROUP BY episode_id) h ON h.episode_id = e.id
      WHERE e.is_played = 1 AND e.played_at IS NOT NULL AND e.duration > 0 AND e.played_at >= ?
        ${playedWhere.sql.map((c) => `AND ${c}`).join(' ')}`,
    filter.reset?.at ?? 0,
    ...playedWhere.args
  );
  return [...heard, ...markedPlayedRows(played)];
}

export type StatsFeed = { id: number; title: string; image_url: string | null };

/** Titles and artwork for the podcasts named in the statistics, archived ones included. */
export async function getStatsFeeds(): Promise<Map<number, StatsFeed>> {
  const rows = await getDb().getAllAsync<StatsFeed>(
    'SELECT id, COALESCE(custom_title, title) AS title, image_url FROM feeds'
  );
  return new Map(rows.map((row) => [row.id, row]));
}

export type DownloadStat = { feedId: number; count: number; bytes: number };

/** Space used by downloads, per podcast, most first. */
export async function getDownloadStats(): Promise<DownloadStat[]> {
  return getDb().getAllAsync<DownloadStat>(
    `SELECT feed_id AS feedId, COUNT(*) AS count, SUM(COALESCE(downloaded_bytes, media_size, 0)) AS bytes
       FROM episodes
      WHERE download_state = 'done'
      GROUP BY feed_id
      ORDER BY bytes DESC, feed_id ASC`
  );
}

/** The podcast's recent publish dates, for `guessReleaseSchedule`. */
export async function getPublishDates(feedId: number, limit = RELEASE_WINDOW * 3): Promise<number[]> {
  const rows = await getDb().getAllAsync<{ published_at: number }>(
    `SELECT published_at FROM episodes
      WHERE feed_id = ? AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT ?`,
    feedId,
    limit
  );
  return rows.map((row) => row.published_at);
}
