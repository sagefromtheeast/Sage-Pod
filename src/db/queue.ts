import { EPISODE_WITH_FEED_COLUMNS } from './columns';
import { dismissFromInbox, dismissManyFromInbox } from './episodes';
import { getDb } from './index';
import { getMeta, getSettings } from './settings';
import type { EpisodeWithFeed } from './types';
import {
  enqueueIndex,
  parseQueueSort,
  sortOrdersAt,
  sortQueue,
  type QueueSort,
} from '@/player/queueSorting';

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

function notifyEpisodeQueued(episodeId: number): void {
  for (const listener of queueListeners) {
    try {
      listener(episodeId);
    } catch {
      // Best effort notification
    }
  }
}

/**
 * "Add to queue": inserts where the Enqueue location setting says (the back,
 * by default). No-op if already queued.
 */
export async function enqueue(episodeId: number): Promise<void> {
  await enqueueMany([episodeId]);
}

/**
 * Adds several episodes, in the given order, together at the Enqueue location
 * (so "Front" doesn't reverse a multi-selection). Already-queued ones are skipped.
 */
export async function enqueueMany(episodeIds: readonly number[]): Promise<void> {
  // Queueing takes an episode out of the inbox, wherever it was queued from (as in AntennaPod).
  await dismissManyFromInbox(episodeIds);
  const db = getDb();
  const rows = await db.getAllAsync<{ episode_id: number; sort_order: number }>(
    'SELECT episode_id, sort_order FROM queue ORDER BY sort_order ASC'
  );
  const queued = new Set(rows.map((row) => row.episode_id));
  const adding = [...new Set(episodeIds)].filter((id) => !queued.has(id));
  if (adding.length === 0) return;

  const loaded = await getMeta('lastEpisodeId');
  const index = enqueueIndex(
    getSettings().enqueueLocation,
    rows.map((row) => row.episode_id),
    loaded ? Number(loaded) : null
  );
  const orders = sortOrdersAt(
    rows.map((row) => row.sort_order),
    index,
    adding.length
  );
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < adding.length; i++) {
      await db.runAsync(
        'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
        adding[i],
        orders[i],
        now
      );
    }
  });
  await applyKeptSort();
  for (const id of adding) notifyEpisodeQueued(id);
}

/** Re-sorts the whole queue in this order. */
export async function sortQueueBy(sort: QueueSort): Promise<void> {
  await reorderQueue(sortQueue(await listQueue(), sort));
}

/** With "Keep sorted" on, every insertion puts the queue back in that order. */
async function applyKeptSort(): Promise<void> {
  const sort = parseQueueSort(getSettings().queueKeepSorted);
  if (sort) await sortQueueBy(sort);
}

/** Puts an episode next without disturbing what is currently playing. */
export async function enqueueNext(episodeId: number): Promise<void> {
  const db = getDb();
  await dismissFromInbox(episodeId);
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
  await applyKeptSort();
  notifyEpisodeQueued(episodeId);
}

/** Moves an episode to the very front — used when the user hits play. */
export async function enqueueFront(episodeId: number): Promise<void> {
  const db = getDb();
  await dismissFromInbox(episodeId);
  await db.runAsync('DELETE FROM queue WHERE episode_id = ?', episodeId);
  const { min } = await bounds();
  await db.runAsync(
    'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
    episodeId,
    min - 1,
    Date.now()
  );
  await applyKeptSort();
  notifyEpisodeQueued(episodeId);
}

/** Moves an episode to the end of the queue (adding it if needed). */
export async function moveToBottom(episodeId: number): Promise<void> {
  const db = getDb();
  await dismissFromInbox(episodeId);
  await db.runAsync('DELETE FROM queue WHERE episode_id = ?', episodeId);
  const { max } = await bounds();
  await db.runAsync(
    'INSERT INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
    episodeId,
    max + 1,
    Date.now()
  );
  await applyKeptSort();
  notifyEpisodeQueued(episodeId);
}

/** Where an episode sat in the queue, saved so Undo can put it back. */
export type QueueSlot = { episodeId: number; sortOrder: number; addedAt: number };

export async function getQueueSlots(episodeIds: readonly number[]): Promise<QueueSlot[]> {
  if (episodeIds.length === 0) return [];
  return getDb().getAllAsync<QueueSlot>(
    `SELECT episode_id AS episodeId, sort_order AS sortOrder, added_at AS addedAt FROM queue
      WHERE episode_id IN (${episodeIds.map(() => '?').join(', ')})`,
    ...episodeIds
  );
}

/**
 * Puts episodes back where they were (Undo for "remove from queue"), keeping
 * their original "date added". If another episode has taken a slot since, the
 * restored one goes just before it, so no two share a position.
 */
export async function restoreQueueSlots(slots: readonly QueueSlot[]): Promise<void> {
  const db = getDb();
  await db.withTransactionAsync(async () => {
    for (const slot of slots) {
      const taken = await db.getFirstAsync<{ episode_id: number }>(
        'SELECT episode_id FROM queue WHERE sort_order = ? AND episode_id != ?',
        slot.sortOrder,
        slot.episodeId
      );
      let order = slot.sortOrder;
      if (taken) {
        const before = await db.getFirstAsync<{ prev: number | null }>(
          'SELECT MAX(sort_order) AS prev FROM queue WHERE sort_order < ?',
          slot.sortOrder
        );
        order = ((before?.prev ?? slot.sortOrder - 1) + slot.sortOrder) / 2;
      }
      await db.runAsync(
        'INSERT OR REPLACE INTO queue (episode_id, sort_order, added_at) VALUES (?, ?, ?)',
        slot.episodeId,
        order,
        slot.addedAt
      );
    }
  });
  await applyKeptSort();
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

