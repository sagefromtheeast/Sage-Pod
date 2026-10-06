import { createStore, useStore } from '@/util/store';

import { getDb, subscribeToTables } from './index';

/**
 * Which episodes are in the queue, shared by every episode row.
 *
 * One `SELECT episode_id FROM queue`, re-run when the queue table changes, so
 * rows can show an in-queue marker and the right menu items without every
 * list query joining the queue (and without every screen subscribing to it).
 * Rows read it through `useIsQueued(id)`, which only re-renders a row when its
 * own membership flips.
 */
const store = createStore<ReadonlySet<number>>(new Set());
let unsubscribe: (() => void) | null = null;

async function reload(): Promise<void> {
  const rows = await getDb().getAllAsync<{ episode_id: number }>('SELECT episode_id FROM queue');
  store.set(new Set(rows.map((row) => row.episode_id)));
}

function ensureLoaded(): void {
  if (unsubscribe) return;
  unsubscribe = subscribeToTables(['queue'], () => void reload());
  void reload();
}

/** Whether an episode is in the queue, kept current as the queue changes. */
export function useIsQueued(episodeId: number): boolean {
  ensureLoaded();
  return useStore(store, (queued) => queued.has(episodeId));
}

/** Snapshot for non-React code (action handlers). */
export function isQueuedNow(episodeId: number): boolean {
  ensureLoaded();
  return store.get().has(episodeId);
}
