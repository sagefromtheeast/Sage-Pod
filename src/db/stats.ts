import { isoDay, markedPlayedRows, type ListenRow, type PlayedEpisodeRow } from '@/stats/aggregate';

import { getDb } from './index';
import { getMeta, setMeta } from './settings';

const STATS_RESET_KEY = 'statsResetAt';

export async function addListenedSeconds(feedId: number, episodeId: number, seconds: number): Promise<void> {
  const date = new Date().toISOString().split('T')[0];
  const db = getDb();

  // Try to update existing record for this episode today
  const existing = await db.getFirstAsync<{ id: number; listened_seconds: number }>(
    'SELECT id, listened_seconds FROM playback_history WHERE episode_id = ? AND date = ?',
    episodeId,
    date
  );

  if (existing) {
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

/** When statistics were last reset (ms), or null. Set by `resetStatistics`. */
export async function getStatsResetAt(): Promise<number | null> {
  const raw = await getMeta(STATS_RESET_KEY);
  const value = raw === null ? NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Reset statistics (AntennaPod's menu item). Statistics count from now on; the
 * history itself stays, because Home's "Check your classics" reads it. Today's
 * rows go, so the statistics read zero straight after a reset.
 */
export async function resetStatistics(now = Date.now()): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM playback_history WHERE date >= ?', isoDay(now));
    await setMeta(STATS_RESET_KEY, String(now));
  });
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
  /** Only played_at at or after this counts as "marked played" (the last reset). */
  resetAt: number | null;
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
      ${heardWhere.sql.length ? `WHERE ${heardWhere.sql.join(' AND ')}` : ''}
      GROUP BY feed_id, month`,
    ...heardWhere.args
  );
  if (!filter.includeMarkedPlayed) return heard;

  const playedWhere = conditions(filter, "date(e.played_at / 1000, 'unixepoch')", 'e.feed_id');
  const played = await db.getAllAsync<PlayedEpisodeRow>(
    `SELECT e.feed_id AS feedId, strftime('%Y-%m', e.played_at / 1000, 'unixepoch') AS month,
            e.duration AS duration, COALESCE(h.seconds, 0) AS listened
       FROM episodes e
       LEFT JOIN (SELECT episode_id, SUM(listened_seconds) AS seconds
                    FROM playback_history GROUP BY episode_id) h ON h.episode_id = e.id
      WHERE e.is_played = 1 AND e.played_at IS NOT NULL AND e.duration > 0 AND e.played_at >= ?
        ${playedWhere.sql.map((c) => `AND ${c}`).join(' ')}`,
    filter.resetAt ?? 0,
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
export async function getPublishDates(feedId: number, limit = 20): Promise<number[]> {
  const rows = await getDb().getAllAsync<{ published_at: number }>(
    `SELECT published_at FROM episodes
      WHERE feed_id = ? AND published_at IS NOT NULL
      ORDER BY published_at DESC LIMIT ?`,
    feedId,
    limit
  );
  return rows.map((row) => row.published_at);
}
