import { EPISODE_WITH_FEED_COLUMNS } from './columns';
import { getDb } from './index';
import type { EpisodeWithFeed } from './types';

const QUEUE_JOIN = `
  SELECT ${EPISODE_WITH_FEED_COLUMNS}
    FROM queue q
    JOIN episodes e ON e.id = q.episode_id
    JOIN feeds f    ON f.id = e.feed_id
   ORDER BY q.sort_order ASC
`;

export async function listQueue(): Promise<EpisodeWithFeed[]> {
  return getDb().getAllAsync<EpisodeWithFeed>(QUEUE_JOIN);
}

export async function queueLength(): Promise<number> {
  const row = await getDb().getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM queue');
  return row?.n ?? 0;
}

export async function isQueued(episodeId: number): Promise<boolean> {
  const row = await getDb().getFirstAsync<{ episode_id: number }>(
    'SELECT episode_id FROM queue WHERE episode_id = ?',
    episodeId
  );
  return row != null;
}

async function bounds(): Promise<{ min: number; max: number }> {
  const row = await getDb().getFirstAsync<{ lo: number | null; hi: number | null }>(
    'SELECT MIN(sort_order) AS lo, MAX(sort_order) AS hi FROM queue'
  );
  return { min: row?.lo ?? 0, max: row?.hi ?? 0 };
}

type QueueListener = (episodeId: number) => void;
const queueListeners = new Set<QueueListener>();

/** Subscribes to episodes being added to the play queue. */
export function onEpisodeQueued(listener: QueueListener): () => void {
  queueListeners.add(listener);
  return () => {
    queueListeners.delete(listener);
  };
}

/**
 * Queueing an episode takes it out of the inbox, wherever it was queued from
 * (as in AntennaPod). Only touches rows still marked new, so it costs no
 * write — and wakes no screens — for the common case.
 */
async function leaveInbox(episodeId: number): Promise<void> {
  await getDb().runAsync('UPDATE episodes SET is_new = 0 WHERE id = ? AND is_new = 1', episodeId);
}

function notifyEpisodeQueued(episodeId: number): void {
  for (const listener of queueListeners) {
    try {
      listener(episodeId);
    } catch {
      // Best effort notification
    }
  }
}

/** Appends to the end of the queue. No-op if already queued. */
export async function enqueue(episodeId: number): Promise<void> {
  await leaveInbox(episodeId);
  if (await isQueued(episodeId)) return;
  const { max } = await bounds();
  await getDb().runAsync(
    'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
    episodeId,
    max + 1,
    Date.now()
  );
  notifyEpisodeQueued(episodeId);
}

/** Puts an episode next without disturbing what is currently playing. */
export async function enqueueNext(episodeId: number): Promise<void> {
  const db = getDb();
  await leaveInbox(episodeId);
  await db.runAsync('DELETE FROM queue WHERE episode_id = ?', episodeId);

  // Slot between the head and the item after it; if the queue has fewer than
  // two entries there is nothing to slot between, so go to the front.
  const head = await db.getAllAsync<{ sort_order: number }>(
    'SELECT sort_order FROM queue ORDER BY sort_order ASC LIMIT 2'
  );
  const order =
    head.length === 0
      ? 0
      : head.length === 1
        ? head[0].sort_order + 1
        : (head[0].sort_order + head[1].sort_order) / 2;

  await db.runAsync(
    'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
    episodeId,
    order,
    Date.now()
  );
  notifyEpisodeQueued(episodeId);
}

/** Moves an episode to the very front — used when the user hits play. */
export async function enqueueFront(episodeId: number): Promise<void> {
  const db = getDb();
  await leaveInbox(episodeId);
  await db.runAsync('DELETE FROM queue WHERE episode_id = ?', episodeId);
  const { min } = await bounds();
  await db.runAsync(
    'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
    episodeId,
    min - 1,
    Date.now()
  );
  notifyEpisodeQueued(episodeId);
}

export async function dequeue(episodeId: number): Promise<void> {
  await getDb().runAsync('DELETE FROM queue WHERE episode_id = ?', episodeId);
}

export async function clearQueue(): Promise<void> {
  await getDb().runAsync('DELETE FROM queue');
}

/** The episode after `episodeId` in queue order, or the head if it isn't queued. */
export async function nextInQueue(episodeId: number | null): Promise<EpisodeWithFeed | null> {
  const db = getDb();

  if (episodeId != null) {
    const current = await db.getFirstAsync<{ sort_order: number }>(
      'SELECT sort_order FROM queue WHERE episode_id = ?',
      episodeId
    );
    if (current) {
      return db.getFirstAsync<EpisodeWithFeed>(
        `SELECT ${EPISODE_WITH_FEED_COLUMNS}
           FROM queue q
           JOIN episodes e ON e.id = q.episode_id
           JOIN feeds f    ON f.id = e.feed_id
          WHERE q.sort_order > ?
          ORDER BY q.sort_order ASC
          LIMIT 1`,
        current.sort_order
      );
    }
  }

  return db.getFirstAsync<EpisodeWithFeed>(`${QUEUE_JOIN} LIMIT 1`);
}

/**
 * Reorders the queue to exactly `episodeIds`.
 *
 * Called after a drag-and-drop, where the UI already knows the final order and
 * a full rewrite is simpler (and, at queue sizes, cheaper) than diffing.
 */
export async function reorderQueue(episodeIds: number[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (let index = 0; index < episodeIds.length; index++) {
      await db.runAsync('UPDATE queue SET sort_order = ? WHERE episode_id = ?', index, episodeIds[index]);
    }
  });
}

export { sortQueueEpisodes, type QueueSortCriterion } from '@/player/queueSorting';
