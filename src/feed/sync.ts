import { getDb } from '@/db';
import { listAutoDownloadCandidates } from '@/db/episodes';
import { getFeedByUrl, listFeedsToRefresh } from '@/db/feeds';
import { getSettings } from '@/db/settings';
import type { FeedRow } from '@/db/types';
import { queueDownload } from '@/player/downloads';

import { fetchFeed, normalizeFeedUrl } from './fetch';
import type { ParsedEpisode, ParsedFeed } from './parser';

export type SyncResult = {
  feedId: number;
  /** Episodes inserted by this sync — what "3 new episodes" is counted from. */
  newEpisodes: number;
  /** True when the server reported the feed unchanged. */
  unchanged: boolean;
};

/**
 * Writes a parsed feed's episodes, inserting new ones and refreshing the
 * metadata of ones already stored.
 *
 * Playback state (position, played, favourite, downloads) is deliberately left
 * alone on update: a publisher re-uploading an episode must never wipe the
 * listener's progress.
 */
async function upsertEpisodes(
  feedId: number,
  episodes: ParsedEpisode[],
  markAsNew: boolean
): Promise<number> {
  const db = getDb();
  let inserted = 0;

  await db.withTransactionAsync(async () => {
    for (const episode of episodes) {
      const existing = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM episodes WHERE feed_id = ? AND guid = ?',
        feedId,
        episode.guid
      );

      if (existing) {
        await db.runAsync(
          `UPDATE episodes
              SET title = ?, description = ?, link = ?, published_at = ?,
                  duration = COALESCE(?, duration), media_url = ?, media_type = ?,
                  media_size = ?, image_url = ?, season = ?, episode_number = ?,
                  chapters_url = ?
            WHERE id = ?`,
          episode.title,
          episode.description,
          episode.link,
          episode.publishedAt,
          episode.duration,
          episode.mediaUrl,
          episode.mediaType,
          episode.mediaSize,
          episode.imageUrl,
          episode.season,
          episode.episodeNumber,
          episode.chaptersUrl,
          existing.id
        );
        continue;
      }

      await db.runAsync(
        `INSERT INTO episodes
           (feed_id, guid, title, description, link, published_at, duration,
            media_url, media_type, media_size, image_url, season, episode_number,
            chapters_url, is_new, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        feedId,
        episode.guid,
        episode.title,
        episode.description,
        episode.link,
        episode.publishedAt,
        episode.duration,
        episode.mediaUrl,
        episode.mediaType,
        episode.mediaSize,
        episode.imageUrl,
        episode.season,
        episode.episodeNumber,
        episode.chaptersUrl,
        markAsNew ? 1 : 0,
        Date.now()
      );
      inserted += 1;
    }
  });

  return inserted;
}

async function updateFeedRow(
  feedId: number,
  parsed: ParsedFeed,
  etag: string | null,
  lastModified: string | null
): Promise<void> {
  await getDb().runAsync(
    `UPDATE feeds
        SET title = ?, author = ?, description = ?, image_url = ?, link = ?,
            language = ?, explicit = ?, etag = ?, last_modified = ?, last_refreshed_at = ?
      WHERE id = ?`,
    parsed.title,
    parsed.author,
    parsed.description,
    parsed.imageUrl,
    parsed.link,
    parsed.language,
    parsed.explicit ? 1 : 0,
    etag,
    lastModified,
    Date.now(),
    feedId
  );
}

/**
 * Subscribes to a feed URL, or returns the existing subscription if the user
 * already has it.
 *
 * Episodes that exist at subscribe time are *not* marked new — otherwise a
 * fresh subscription would announce a 400-episode back catalogue as unread.
 */
export async function subscribe(rawUrl: string): Promise<{ feedId: number; alreadySubscribed: boolean }> {
  const feedUrl = normalizeFeedUrl(rawUrl);

  const existing = await getFeedByUrl(feedUrl);
  if (existing) {
    await refreshFeed(existing);
    return { feedId: existing.id, alreadySubscribed: true };
  }

  const { feed, etag, lastModified } = await fetchFeed(feedUrl);
  const db = getDb();

  const result = await db.runAsync(
    `INSERT INTO feeds
       (feed_url, title, author, description, image_url, link, language, explicit,
        etag, last_modified, last_refreshed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    feedUrl,
    feed.title,
    feed.author,
    feed.description,
    feed.imageUrl,
    feed.link,
    feed.language,
    feed.explicit ? 1 : 0,
    etag,
    lastModified,
    Date.now(),
    Date.now()
  );

  const feedId = result.lastInsertRowId;
  await upsertEpisodes(feedId, feed.episodes, false);
  return { feedId, alreadySubscribed: false };
}

/** Re-fetches one feed. Returns without writing if the server says 304. */
export async function refreshFeed(feed: FeedRow): Promise<SyncResult> {
  const { feed: parsed, etag, lastModified, notModified } = await fetchFeed(feed.feed_url, {
    etag: feed.etag,
    lastModified: feed.last_modified,
  });

  if (notModified) {
    await getDb().runAsync('UPDATE feeds SET last_refreshed_at = ? WHERE id = ?', Date.now(), feed.id);
    return { feedId: feed.id, newEpisodes: 0, unchanged: true };
  }

  const newEpisodes = await upsertEpisodes(feed.id, parsed.episodes, true);
  await updateFeedRow(feed.id, parsed, etag, lastModified);

  if (feed.auto_download === 1 && newEpisodes > 0) {
    for (const episodeId of await autoDownloadCandidates(feed.id)) {
      // Fire and forget: the download manager queues and throttles these, and
      // a refresh should not block waiting for audio to arrive.
      void queueDownload(episodeId);
    }
  }

  return { feedId: feed.id, newEpisodes, unchanged: false };
}

export type RefreshAllResult = {
  refreshed: number;
  newEpisodes: number;
  failures: { feedId: number; title: string; message: string }[];
};

/**
 * Refreshes every subscription that is due.
 *
 * Feeds are refreshed a few at a time rather than all at once: a listener with
 * 80 subscriptions would otherwise open 80 sockets on a phone radio, and one
 * slow host would stall the batch.
 */
export async function refreshAllFeeds(
  options: { force?: boolean; concurrency?: number; onProgress?: (done: number, total: number) => void } = {}
): Promise<RefreshAllResult> {
  const { force = false, concurrency = 4, onProgress } = options;
  const staleAfterMs = force ? 0 : getSettings().refreshIntervalMinutes * 60_000;

  const feeds = await listFeedsToRefresh(staleAfterMs);
  const result: RefreshAllResult = { refreshed: 0, newEpisodes: 0, failures: [] };
  if (feeds.length === 0) return result;

  let cursor = 0;
  let completed = 0;

  async function worker() {
    while (cursor < feeds.length) {
      const feed = feeds[cursor++];
      try {
        const synced = await refreshFeed(feed);
        result.refreshed += 1;
        result.newEpisodes += synced.newEpisodes;
      } catch (error) {
        // One unreachable feed must not abort the whole refresh.
        result.failures.push({
          feedId: feed.id,
          title: feed.title,
          message: error instanceof Error ? error.message : String(error),
        });
      } finally {
        onProgress?.(++completed, feeds.length);
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, feeds.length) }, () => worker())
  );

  return result;
}

/** Episode IDs a feed's auto-download setting says should be fetched. */
export async function autoDownloadCandidates(feedId: number): Promise<number[]> {
  const limit = getSettings().autoDownloadLimit;
  if (limit <= 0) return [];
  const rows = await listAutoDownloadCandidates(feedId, limit);
  return rows.map((row) => row.id);
}
