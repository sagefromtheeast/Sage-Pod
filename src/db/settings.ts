import { getDb } from './index';

/** User preferences, mirrored in memory so the player can read them synchronously. */
export type Settings = {
  /** Seconds skipped by the "forward" control. */
  skipForward: number;
  /** Seconds rewound by the "back" control. */
  skipBackward: number;
  /** Playback rate applied to newly loaded episodes. */
  playbackRate: number;
  /** Rewind this many seconds when resuming a partially played episode. */
  resumeRewind: number;
  /** Remove an episode from the queue once it finishes. */
  removeFromQueueWhenFinished: boolean;
  /** Start the next queue item automatically when one ends. */
  continuousPlayback: boolean;
  /** Only download episode audio over un-metered networks. */
  downloadOnWifiOnly: boolean;
  /** Episodes auto-downloaded per feed that has auto-download enabled. */
  autoDownloadLimit: number;
  /** Automatically download episodes when added to the playback queue. */
  autoDownloadQueue: boolean;
  /** Maximum number of downloaded episodes to store (0 = unlimited). */
  maxDownloadedEpisodes: number;
  /** Delete a downloaded file once its episode is finished. */
  deleteAfterFinished: boolean;
  /** Refresh feeds automatically when the app opens, at most this often (minutes). */
  refreshIntervalMinutes: number;
  /** UI appearance mode: system, light, dark, or OLED true black. */
  themePreference: 'system' | 'light' | 'dark' | 'oled';
};

export const DEFAULT_SETTINGS: Settings = {
  skipForward: 30,
  skipBackward: 10,
  playbackRate: 1,
  resumeRewind: 3,
  removeFromQueueWhenFinished: true,
  continuousPlayback: true,
  downloadOnWifiOnly: true,
  autoDownloadLimit: 3,
  autoDownloadQueue: false,
  maxDownloadedEpisodes: 20,
  deleteAfterFinished: false,
  refreshIntervalMinutes: 60,
  themePreference: 'system',
};

let cache: Settings = { ...DEFAULT_SETTINGS };
let loaded = false;

/**
 * The current settings, without a database round trip.
 *
 * The player reads this on every skip and load, where an await would add
 * latency to a button press for no benefit — `loadSettings()` has already run
 * at startup.
 */
export function getSettings(): Settings {
  return cache;
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
  for (const { key, value } of rows) {
    if (key in next) {
      const typedKey = key as keyof Settings;
      (next as Record<keyof Settings, unknown>)[typedKey] = coerce(typedKey, value);
    }
  }

  cache = next;
  loaded = true;
  return cache;
}

export function settingsLoaded(): boolean {
  return loaded;
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  cache = { ...cache, [key]: value };
  const serialised = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
  await getDb().runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    serialised
  );
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
