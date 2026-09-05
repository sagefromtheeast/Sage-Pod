import { getDb } from './index';
import type { FeedRow, FeedWithCounts } from './types';

/** Columns shared by every feed select, so joins and plain reads stay in sync. */
const FEED_COLUMNS = `
  f.id, f.feed_url, f.title, f.author, f.description, f.image_url, f.link,
  f.language, f.explicit, f.etag, f.last_modified, f.last_refreshed_at,
  f.auto_download, f.keep_updated, f.created_at,
  f.playback_speed, f.skip_intro_seconds
`;

export async function listFeeds(): Promise<FeedWithCounts[]> {
  return getDb().getAllAsync<FeedWithCounts>(
    `SELECT ${FEED_COLUMNS},
            COUNT(e.id) AS episode_count,
            COALESCE(SUM(CASE WHEN e.is_played = 0 THEN 1 ELSE 0 END), 0) AS unplayed_count,
            MAX(e.published_at) AS latest_published_at
       FROM feeds f
       LEFT JOIN episodes e ON e.feed_id = f.id
      GROUP BY f.id
      ORDER BY f.title COLLATE NOCASE ASC`
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
      WHERE keep_updated = 1
        AND (last_refreshed_at IS NULL OR last_refreshed_at < ?)
      ORDER BY COALESCE(last_refreshed_at, 0) ASC`,
    cutoff
  );
}

export async function deleteFeed(id: number): Promise<void> {
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
      'UPDATE feeds SET auto_download = ? WHERE id = ?',
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
export async function listFeedUrls(): Promise<Pick<FeedRow, 'title' | 'feed_url' | 'link'>[]> {
  return getDb().getAllAsync('SELECT title, feed_url, link FROM feeds ORDER BY title COLLATE NOCASE');
}
