import { getDb } from '@/db';
import { listAutoDownloadCandidates } from '@/db/episodes';
import { getFeedByUrl, listFeedsToRefresh, subscribeFeed } from '@/db/feeds';
import { getSettings } from '@/db/settings';
import { notifyNewEpisodes, notifyRefreshFailed } from '@/notify';
import type { FeedRow } from '@/db/types';
import { enqueueMany } from '@/db/queue';
import { onCellular, queueDownload } from '@/player/downloads';

import {
  boolOverride,
  parseNewEpisodesAction,
  parseWords,
  resolveOverride,
  shouldAutoDownload,
  type DownloadRules,
} from './feedPrefs';

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
): Promise<{ count: number; guids: string[] }> {
  const db = getDb();
  if (episodes.length === 0) return { count: 0, guids: [] };

  // Pre-fetch all existing GUIDs in a single query rather than querying per episode.
  const existingRows = await db.getAllAsync<{ id: number; guid: string }>(
    'SELECT id, guid FROM episodes WHERE feed_id = ?',
    feedId
  );
  const existingMap = new Map(existingRows.map((r) => [r.guid, r.id]));

  const toInsert: ParsedEpisode[] = [];
  const toUpdate: { id: number; ep: ParsedEpisode }[] = [];

  for (const ep of episodes) {
    const existingId = existingMap.get(ep.guid);
    if (existingId !== undefined) {
      toUpdate.push({ id: existingId, ep });
    } else {
      toInsert.push(ep);
    }
  }

  let inserted = 0;
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    // Multi-row batch inserts: 40 episodes * 16 parameters = 640 parameters,
    // safely below SQLite's parameter limits while cutting bridge trips 40x.
    const BATCH_SIZE = 40;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const chunk = toInsert.slice(i, i + BATCH_SIZE);
      const placeholders = chunk
        .map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .join(', ');
      const params: (string | number | null)[] = [];
      for (const ep of chunk) {
        params.push(
          feedId,
          ep.guid,
          ep.title,
          ep.description,
          ep.link,
          ep.publishedAt,
          ep.duration,
          ep.mediaUrl,
          ep.mediaType,
          ep.mediaSize,
          ep.imageUrl,
          ep.season,
          ep.episodeNumber,
          ep.chaptersUrl,
          markAsNew ? 1 : 0,
          now
        );
      }
      await db.runAsync(
        `INSERT INTO episodes
           (feed_id, guid, title, description, link, published_at, duration,
            media_url, media_type, media_size, image_url, season, episode_number,
            chapters_url, is_new, created_at)
         VALUES ${placeholders}`,
        ...params
      );
      inserted += chunk.length;
    }

    for (const { id, ep } of toUpdate) {
      await db.runAsync(
        `UPDATE episodes
            SET title = ?, description = ?, link = ?, published_at = ?,
                duration = COALESCE(?, duration), media_url = ?, media_type = ?,
                media_size = ?, image_url = ?, season = ?, episode_number = ?,
                chapters_url = ?
          WHERE id = ?`,
        ep.title,
        ep.description,
        ep.link,
        ep.publishedAt,
        ep.duration,
        ep.mediaUrl,
        ep.mediaType,
        ep.mediaSize,
        ep.imageUrl,
        ep.season,
        ep.episodeNumber,
        ep.chaptersUrl,
        id
      );
    }
  });

  return { count: inserted, guids: toInsert.map((ep) => ep.guid) };
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
            language = ?, explicit = ?, etag = ?, last_modified = ?, last_refreshed_at = ?,
            next_page_url = COALESCE(?, next_page_url), funding = ?, last_refresh_error = NULL
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
    parsed.nextPageUrl ?? null,
    fundingJson(parsed),
    feedId
  );
}

const fundingJson = (feed: ParsedFeed) => (feed.funding.length > 0 ? JSON.stringify(feed.funding) : null);

/** Fetches a feed and stores it with its episodes, as a subscription or a preview. */
async function insertFeed(feedUrl: string, state: 'subscribed' | 'preview'): Promise<number> {
  const { feed, etag, lastModified } = await fetchFeed(feedUrl);
  const result = await getDb().runAsync(
    `INSERT INTO feeds
       (feed_url, title, author, description, image_url, link, language, explicit,
        etag, last_modified, last_refreshed_at, created_at, next_page_url, funding, state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    Date.now(),
    feed.nextPageUrl ?? null,
    fundingJson(feed),
    state
  );
  const feedId = result.lastInsertRowId;
  // Existing episodes are *not* marked new, or a fresh subscription would
  // announce a 400-episode back catalogue as unread.
  await upsertEpisodes(feedId, feed.episodes, false);
  return feedId;
}

/**
 * Subscribes to a feed URL. An existing preview becomes a subscription; an
 * existing subscription is just refreshed.
 *
 * Subscribing a preview never fails: its episodes are already stored, so the
 * state flips first and the refresh is best effort. A failed refresh shows on
 * the podcast page's "Last refresh failed" banner instead of undoing (or
 * misreporting) the subscription.
 */
export async function subscribe(rawUrl: string): Promise<{ feedId: number; alreadySubscribed: boolean }> {
  const feedUrl = normalizeFeedUrl(rawUrl);

  const existing = await getFeedByUrl(feedUrl);
  if (existing) {
    if (existing.state === 'subscribed') {
      await refreshFeed(existing);
      return { feedId: existing.id, alreadySubscribed: true };
    }
    await subscribeFeed(existing.id);
    // Coming back from the archive: what came out meanwhile is back catalogue,
    // not new, so it doesn't flood the Inbox, the queue or the downloads.
    await refreshFeed(
      { ...existing, state: 'subscribed' },
      { quiet: existing.state === 'archived' }
    ).catch(() => undefined);
    return { feedId: existing.id, alreadySubscribed: false };
  }

  return { feedId: await insertFeed(feedUrl, 'subscribed'), alreadySubscribed: false };
}

/**
 * Opens a podcast without subscribing (AntennaPod's preview, D-003.4): it is
 * stored so its page and episodes work, but kept out of Library, the Inbox,
 * refreshes and search until the listener taps Subscribe. Unsubscribed
 * previews are cleared at the next start (`removeStalePreviews`).
 */
export async function previewFeed(rawUrl: string): Promise<{ feedId: number; subscribed: boolean }> {
  const feedUrl = normalizeFeedUrl(rawUrl);
  const existing = await getFeedByUrl(feedUrl);
  if (existing) return { feedId: existing.id, subscribed: existing.state === 'subscribed' };
  return { feedId: await insertFeed(feedUrl, 'preview'), subscribed: false };
}

/**
 * Re-fetches one feed. Returns without writing if the server says 304.
 * `quiet` stores new episodes without the new-episodes action (Inbox, queue)
 * or auto-download.
 */
let refreshesRunning = 0;

/** Whether a feed refresh is writing; a database restore waits for none. */
export function isRefreshing(): boolean {
  return refreshesRunning > 0;
}

export async function refreshFeed(
  feed: FeedRow,
  options: { full?: boolean; quiet?: boolean } = {}
): Promise<SyncResult> {
  refreshesRunning += 1;
  try {
    return await refreshFeedNow(feed, options);
  } finally {
    refreshesRunning -= 1;
  }
}

async function refreshFeedNow(feed: FeedRow, options: { full?: boolean; quiet?: boolean }): Promise<SyncResult> {
  let fetched: Awaited<ReturnType<typeof fetchFeed>>;
  try {
    // A full refresh ignores the cache validators, so the server can't answer 304.
    fetched = await fetchFeed(
      feed.feed_url,
      options.full ? {} : { etag: feed.etag, lastModified: feed.last_modified }
    );
  } catch (error) {
    // Remembered for the podcast page's "Last refresh failed" banner.
    await getDb().runAsync(
      'UPDATE feeds SET last_refresh_error = ? WHERE id = ?',
      error instanceof Error ? error.message : String(error),
      feed.id
    );
    throw error;
  }
  const { feed: parsed, etag, lastModified, notModified } = fetched;

  if (notModified) {
    await getDb().runAsync(
      'UPDATE feeds SET last_refreshed_at = ?, last_refresh_error = NULL WHERE id = ?',
      Date.now(),
      feed.id
    );
    return { feedId: feed.id, newEpisodes: 0, unchanged: true };
  }

  // What new episodes do (AntennaPod's "New episodes" setting, per podcast or
  // global): land in the Inbox, join the queue, or nothing. A preview's or an
  // archived podcast's new episodes are never "new": only subscriptions feed
  // the Inbox (D-016, D-019).
  const settings = getSettings();
  const subscribed = feed.state === 'subscribed' && !options.quiet;
  const action = parseNewEpisodesAction(feed.new_episodes_action) ?? settings.newEpisodesAction;
  const { count: newEpisodes, guids } = await upsertEpisodes(
    feed.id,
    parsed.episodes,
    subscribed && action === 'inbox'
  );
  await updateFeedRow(feed.id, parsed, etag, lastModified);

  const addToQueue = subscribed && action === 'queue';
  // AntennaPod's per-podcast "Episode notifications".
  const notify = subscribed && feed.notify === 1;
  if ((addToQueue || notify) && guids.length > 0) {
    const rows = await getDb().getAllAsync<{ id: number; title: string }>(
      `SELECT id, title FROM episodes WHERE feed_id = ? AND guid IN (${guids.map(() => '?').join(', ')})
        ORDER BY published_at ASC, id ASC`,
      feed.id,
      ...guids
    );
    if (addToQueue) await enqueueMany(rows.map((row) => row.id));
    if (notify) {
      const newestFirst = rows.map((row) => row.title).reverse();
      void notifyNewEpisodes(feed.id, feed.custom_title ?? (parsed.title || feed.title), newestFirst);
    }
  }

  const autoDownload = resolveOverride(boolOverride(feed.auto_download_override), settings.autoDownloadNew).value;
  if (subscribed && autoDownload && newEpisodes > 0) {
    for (const episodeId of await autoDownloadCandidates(feed)) {
      // Fire and forget: the download manager queues and throttles these, and
      // a refresh should not block waiting for audio to arrive.
      void queueDownload(episodeId, { isAuto: true });
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
  const result: RefreshAllResult = { refreshed: 0, newEpisodes: 0, failures: [] };
  // Automatic refreshes respect "Refresh over mobile data"; one the listener
  // asks for (force) always runs.
  if (!force && !getSettings().mobileRefresh && (await onCellular())) return result;

  const feeds = await listFeedsToRefresh(staleAfterMs);
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
          title: feed.custom_title ?? feed.title,
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

  // An automatic refresh has no one watching it, so failures become a
  // notification; one the listener started shows its own result.
  if (!force && result.failures.length > 0 && getSettings().notifyRefreshErrors) {
    void notifyRefreshFailed(result.failures);
  }

  return result;
}

/** Episode IDs a feed's auto-download setting says should be fetched. */
export async function autoDownloadCandidates(feed: FeedRow): Promise<number[]> {
  const limit = getSettings().autoDownloadLimit;
  if (limit <= 0) return [];
  const rules: DownloadRules = {
    include: parseWords(feed.download_include),
    exclude: parseWords(feed.download_exclude),
    minMinutes: feed.download_min_minutes ?? 0,
  };
  // Pages through the unplayed episodes, newest first, so selective rules
  // still find matches further back.
  const pageSize = Math.max(limit * 3, 50);
  const candidates: number[] = [];
  for (let offset = 0; candidates.length < limit; offset += pageSize) {
    const rows = await listAutoDownloadCandidates(feed.id, pageSize, offset);
    for (const row of rows) {
      if (shouldAutoDownload(row, rules)) {
        candidates.push(row.id);
        if (candidates.length >= limit) break;
      }
    }
    if (rows.length < pageSize) break;
  }
  return candidates;
}

/**
 * Loads the next page of episodes for a paged feed (RFC 5005).
 */
export async function fetchOlderFeedEpisodes(
  feedId: number
): Promise<{ newEpisodes: number; hasMore: boolean }> {
  const db = getDb();
  const feed = await db.getFirstAsync<FeedRow>(
    'SELECT * FROM feeds WHERE id = ?',
    feedId
  );
  if (!feed || !feed.next_page_url) {
    return { newEpisodes: 0, hasMore: false };
  }

  const { feed: parsed } = await fetchFeed(feed.next_page_url);
  const { count: inserted } = await upsertEpisodes(feedId, parsed.episodes, false);
  await db.runAsync(
    'UPDATE feeds SET next_page_url = ? WHERE id = ?',
    parsed.nextPageUrl ?? null,
    feedId
  );

  return {
    newEpisodes: inserted,
    hasMore: Boolean(parsed.nextPageUrl),
  };
}

/**
 * "Refresh complete podcast": re-reads the feed ignoring the cache, then
 * fetches every older page of a paged feed (RFC 5005).
 */
export async function refreshFeedCompletely(feed: FeedRow): Promise<number> {
  let total = (await refreshFeed(feed, { full: true })).newEpisodes;
  // Bounded, in case a broken feed links its pages in a loop.
  for (let page = 0; page < 50; page++) {
    const { newEpisodes, hasMore } = await fetchOlderFeedEpisodes(feed.id);
    total += newEpisodes;
    if (!hasMore) break;
  }
  return total;
}
