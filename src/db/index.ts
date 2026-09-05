import {
  addDatabaseChangeListener,
  openDatabaseSync,
  type SQLiteDatabase,
} from 'expo-sqlite';

import { migrate } from './schema';

export const DATABASE_NAME = 'sagepod.db';

let database: SQLiteDatabase | null = null;
let initPromise: Promise<void> | null = null;

/**
 * The app's single database handle.
 *
 * Opened synchronously and shared by React screens and the (non-React) player
 * service alike, so both see the same connection and the same change events.
 */
export function getDb(): SQLiteDatabase {
  if (!database) {
    database = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
  }
  return database;
}

/** Runs migrations exactly once, however many callers await it. */
export function initDb(): Promise<void> {
  initPromise ??= migrate(getDb());
  return initPromise;
}

type Listener = () => void;

const listeners = new Map<string, Set<Listener>>();
let changeSubscription: { remove: () => void } | null = null;
/** Coalesces the burst of row events a single transaction produces. */
let flushHandle: ReturnType<typeof setTimeout> | null = null;
let pendingTables = new Set<string>();

function ensureChangeSubscription() {
  if (changeSubscription) return;
  changeSubscription = addDatabaseChangeListener(({ tableName }) => {
    pendingTables.add(tableName);
    if (flushHandle) return;
    flushHandle = setTimeout(() => {
      flushHandle = null;
      const tables = pendingTables;
      pendingTables = new Set();
      const notified = new Set<Listener>();
      for (const table of tables) {
        for (const listener of listeners.get(table) ?? []) notified.add(listener);
      }
      for (const listener of notified) listener();
    }, 40);
  });
}

/**
 * Subscribes to writes on the given tables.
 *
 * SQLite's own change notifications drive every list refresh in the app, which
 * means a write from anywhere — a background feed refresh, the player saving a
 * position, a download completing — repaints the relevant screens without any
 * explicit invalidation call at the write site.
 */
export function subscribeToTables(tables: readonly string[], listener: Listener): () => void {
  ensureChangeSubscription();
  for (const table of tables) {
    let set = listeners.get(table);
    if (!set) listeners.set(table, (set = new Set()));
    set.add(listener);
  }
  return () => {
    for (const table of tables) listeners.get(table)?.delete(listener);
  };
}
