import { createStore, useStore } from '@/util/store';

import { getDb } from './index';
import { DEFAULT_SETTINGS, type Settings } from './settingsSchema';

export { DEFAULT_SETTINGS, SKIP_AMOUNTS, type Settings } from './settingsSchema';

const store = createStore<Settings>({ ...DEFAULT_SETTINGS });
let loaded = false;

/**
 * The current settings, without a database round trip.
 *
 * The player reads this on every skip and load, where an await would add
 * latency to a button press for no benefit — `loadSettings()` has already run
 * at startup.
 */
export function getSettings(): Settings {
  return store.get();
}

/** One setting, re-rendering the component when it changes. */
export function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useStore(store, (settings) => settings[key]);
}

function coerce<K extends keyof Settings>(key: K, raw: string): Settings[K] {
  const fallback = DEFAULT_SETTINGS[key];
  if (typeof fallback === 'boolean') return (raw === '1' || raw === 'true') as Settings[K];
  if (typeof fallback === 'string') return raw as Settings[K];
  const num = Number(raw);
  return (Number.isFinite(num) ? num : fallback) as Settings[K];
}

/** Reads persisted settings into the in-memory cache. Run once at startup. */
export async function loadSettings(): Promise<Settings> {
  const rows = await getDb().getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings'
  );

  const next = { ...DEFAULT_SETTINGS };

  // Pre-0.4 builds stored a fixed rewind in seconds; 0 meant off.
  const legacyRewind = rows.find((row) => row.key === 'resumeRewind');
  if (legacyRewind && !rows.some((row) => row.key === 'rewindOnResume')) {
    next.rewindOnResume = legacyRewind.value !== '0';
  }

  for (const { key, value } of rows) {
    if (key in next) {
      const typedKey = key as keyof Settings;
      (next as Record<keyof Settings, unknown>)[typedKey] = coerce(typedKey, value);
    }
  }

  store.set(next);
  loaded = true;
  return next;
}

/** Called after any setting changes, for code outside React (the player). */
export function subscribeSettings(listener: () => void): () => void {
  return store.subscribe(listener);
}

export function settingsLoaded(): boolean {
  return loaded;
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  store.set({ ...store.get(), [key]: value });
  const serialised = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  await getDb().runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    serialised
  );
}

/**
 * Every preference back to its default: one transaction and one store update,
 * so screens re-render once rather than once per key.
 */
export async function resetSettings(): Promise<void> {
  const db = getDb();
  // 'resumeRewind' is the pre-0.4 key loadSettings still reads when the new one is missing.
  const keys = [...Object.keys(DEFAULT_SETTINGS), 'resumeRewind'];
  await db.withTransactionAsync(async () => {
    for (const key of keys) await db.runAsync('DELETE FROM settings WHERE key = ?', key);
  });
  store.set({ ...DEFAULT_SETTINGS });
}

/** Non-preference key/value storage (last-played episode, refresh timestamps). */
export async function getMeta(key: string): Promise<string | null> {
  const row = await getDb().getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    `meta:${key}`
  );
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await getDb().runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    `meta:${key}`,
    value
  );
}
