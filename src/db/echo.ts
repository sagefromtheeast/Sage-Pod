import { ECHO_TOP_COUNT, medianDelay, type EchoYear } from '@/echo/echo';
import { totalsByFeed } from '@/stats/aggregate';

import { getDb } from './index';
import { getMeta, setMeta } from './settings';
import { getListenRows, getStatsFeeds, getStatsReset } from './stats';

const ECHO_HIDDEN_KEY = 'echoHiddenYear';

/**
 * Everything Echo's cards show for `year`. Listening time is what was heard
 * (not marked played) since the last statistics reset, as AntennaPod's Echo
 * counts it.
 */
export async function getEchoYear(year: number): Promise<EchoYear> {
  const db = getDb();
  const from = `${year}-01-01`;
  const yearStart = new Date(year, 0, 1).getTime();
  const yearEnd = new Date(year + 1, 0, 1).getTime();

  const [rows, feeds] = await Promise.all([
    getStatsReset().then((reset) => getListenRows({ from, to: `${year}-12-31`, includeMarkedPlayed: false, reset })),
    getStatsFeeds(),
  ]);
  const totals = totalsByFeed(rows);
  const listened = new Set(totals.map((t) => t.feedId));

  // Unknown durations count as nothing left, not as the whole episode.
  const queue = await db.getFirstAsync<{ episodes: number; seconds: number | null }>(
    `SELECT COUNT(*) AS episodes, SUM(MAX(COALESCE(e.duration, 0) - e.position, 0)) AS seconds
       FROM queue q JOIN episodes e ON e.id = q.episode_id`
  );

  // Episodes released and finished this year (AntennaPod's release-to-play query).
  const delays = await db.getAllAsync<{ delay: number }>(
    `SELECT played_at - published_at AS delay FROM episodes
      WHERE is_played = 1 AND played_at >= ? AND played_at < ? AND published_at >= ?`,
    yearStart,
    yearEnd,
    yearStart
  );

  // Podcasts that refresh automatically, and whether they have this year's episodes unplayed.
  const active = await db.getAllAsync<{ id: number; title: string; fresh: number }>(
    `SELECT f.id, COALESCE(f.custom_title, f.title) AS title,
            EXISTS (SELECT 1 FROM episodes e
                     WHERE e.feed_id = f.id AND e.is_played = 0 AND e.published_at >= ?) AS fresh
       FROM feeds f
      WHERE f.keep_updated = 1 AND f.state = 'subscribed'`,
    yearStart
  );

  const first = await db.getFirstAsync<{ day: string | null }>('SELECT MIN(date) AS day FROM playback_history');

  return {
    year,
    listenedSeconds: totals.reduce((sum, t) => sum + t.seconds, 0),
    podcastsPlayed: totals.length,
    queueSeconds: queue?.seconds ?? 0,
    queueEpisodes: queue?.episodes ?? 0,
    medianDelayMs: medianDelay(delays.map((row) => row.delay)),
    activeFeeds: active.length,
    playedActiveFeeds: active.filter((feed) => listened.has(feed.id)).length,
    unplayedActiveTitles: active.filter((feed) => !listened.has(feed.id) && feed.fresh).map((feed) => feed.title),
    firstDay: first?.day ?? null,
    top: totals.slice(0, ECHO_TOP_COUNT).map((t) => {
      const feed = feeds.get(t.feedId);
      return {
        id: t.feedId,
        title: feed?.title ?? 'Unknown podcast',
        imageUrl: feed?.image_url ?? null,
        seconds: t.seconds,
      };
    }),
  };
}

/** Seconds heard in `year`, for deciding whether Home offers Echo. */
export async function getEchoListenedSeconds(year: number): Promise<number> {
  const reset = await getStatsReset();
  const rows = await getListenRows({ from: `${year}-01-01`, to: `${year}-12-31`, includeMarkedPlayed: false, reset });
  return rows.reduce((sum, row) => sum + row.seconds, 0);
}

/** The year the Home card was closed for, or null. */
export async function getEchoHiddenYear(): Promise<number | null> {
  const raw = await getMeta(ECHO_HIDDEN_KEY);
  const year = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(year) ? year : null;
}

/** Closes the Home card until next year's Echo. */
export async function hideEchoForYear(year: number): Promise<void> {
  await setMeta(ECHO_HIDDEN_KEY, String(year));
}
