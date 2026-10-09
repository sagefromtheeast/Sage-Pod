import type { DownloadLogRow } from '@/player/downloadView';

import { getDb } from './index';

/** Entries kept; older ones are dropped as new ones arrive. */
const MAX_ENTRIES = 200;

export type NewDownloadLogEntry = Omit<DownloadLogRow, 'id' | 'created_at'> & { created_at?: number };

/** Records one finished or failed download (AntennaPod's download log). */
export async function addDownloadLog(entry: NewDownloadLogEntry): Promise<void> {
  const db = getDb();
  await db.runAsync(
    `INSERT INTO download_log (episode_id, episode_title, feed_title, url, status, error_code, error_message, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    entry.episode_id,
    entry.episode_title,
    entry.feed_title,
    entry.url,
    entry.status,
    entry.error_code,
    entry.error_message,
    entry.created_at ?? Date.now()
  );
  await db.runAsync(
    `DELETE FROM download_log WHERE id NOT IN (SELECT id FROM download_log ORDER BY created_at DESC, id DESC LIMIT ?)`,
    MAX_ENTRIES
  );
}

/** Newest first. */
export async function listDownloadLog(limit = MAX_ENTRIES): Promise<DownloadLogRow[]> {
  return getDb().getAllAsync<DownloadLogRow>(
    'SELECT * FROM download_log ORDER BY created_at DESC, id DESC LIMIT ?',
    limit
  );
}

export async function clearDownloadLog(): Promise<void> {
  await getDb().runAsync('DELETE FROM download_log');
}
