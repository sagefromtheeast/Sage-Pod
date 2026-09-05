import { getDb } from './index';
import type { FeedRow } from './types';

export async function addListenedSeconds(
  feedId: number,
  episodeId: number,
  seconds: number
): Promise<void> {
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

export type StatRow = {
  feed_id: number;
  feed_title: string;
  feed_image_url: string | null;
  total_seconds: number;
};

export async function getListeningStats(): Promise<StatRow[]> {
  const db = getDb();
  return db.getAllAsync<StatRow>(`
    SELECT h.feed_id, f.title AS feed_title, f.image_url AS feed_image_url, SUM(h.listened_seconds) AS total_seconds
    FROM playback_history h
    JOIN feeds f ON f.id = h.feed_id
    GROUP BY h.feed_id
    ORDER BY total_seconds DESC
  `);
}
