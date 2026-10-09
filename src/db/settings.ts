import { createStore, useStore } from '@/util/store';

import { getDb } from './index';

/** User preferences, mirrored in memory so the player can read them synchronously. */
export type Settings = {
  /** Seconds skipped by the "forward" control. */
  skipForward: number;
  /** Seconds rewound by the "back" control. */
  skipBackward: number;
  /** Playback rate applied to newly loaded episodes. */
  playbackRate: number;
  /**
   * Back up a little on resume, scaled by how long playback was paused
   * (AntennaPod's rule: 0.8s, 3s, 10s or 20s). See src/player/resumeRewind.ts.
   */
  rewindOnResume: boolean;
  /** Remove an episode from the queue once it finishes. */
  removeFromQueueWhenFinished: boolean;
  /** Start the next queue item automatically when one ends. */
  continuousPlayback: boolean;
  /**
   * The button on an episode row streams episodes that aren't downloaded.
   * Off makes it a Download button (AntennaPod's default). See D-010.
   */
  streamOverDownload: boolean;
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
  /** Speed preset chips in the speed sheet, comma-separated (see src/player/speed.ts). */
  speedPresets: string;
  /** Player's right-hand time shows time remaining (true) or total length (false). */
  showRemainingTime: boolean;
  /** Last minutes chosen for the sleep timer, offered again (AntennaPod default 15). */
  sleepMinutes: number;
  /** Shake the phone in the timer's last 10 s to restart it. */
  sleepShakeToReset: boolean;
  /** Vibrate when the timer enters its last 10 s. */
  sleepVibrate: boolean;
  /** Start the sleep timer automatically when playback starts inside the window. */
  sleepAutoEnable: boolean;
  /** Auto-enable window, hours 0–23; may wrap midnight (default 22 → 6). */
  sleepAutoFrom: number;
  sleepAutoTo: number;
  /** Where "Add to queue" inserts: 'back' | 'front' | 'afterCurrent' | 'random' (see enqueueIndex). */
  enqueueLocation: 'back' | 'front' | 'afterCurrent' | 'random';
  /** The order the queue is kept in after every enqueue ('' = off, e.g. 'date:desc'). Disables dragging. */
  queueKeepSorted: string;
  /** Locked queue: no dragging or swiping, so a pocketed phone can't reorder it. */
  queueLocked: boolean;
  /** Whether the first-time "queue locked" explanation has been shown. */
  queueLockExplained: boolean;
  /** Inbox order: 'date:desc' | 'date:asc' | 'duration:asc' | 'duration:desc' (see InboxSort). */
  inboxSort: 'date:desc' | 'date:asc' | 'duration:asc' | 'duration:desc';
  /** Ask before "Remove all" empties the inbox (until "Don't ask again"). */
  confirmInboxRemoveAll: boolean;
  /** Home's sections in order, hidden ones prefixed with '-' ('' = default; see src/home/sections.ts). */
  homeSections: string;
  /** Where new episodes of a podcast go unless it says otherwise: 'inbox' | 'queue' | 'nothing'. */
  newEpisodesAction: 'inbox' | 'queue' | 'nothing';
  /** Auto-download new episodes of podcasts that don't set their own choice. */
  autoDownloadNew: boolean;
  /** Discover's chart and search country (ISO 3166 code, lower case; see src/discover/providers.ts). */
  discoverCountry: string;
  /** Library order: 'title' | 'updated' | 'unplayed' | 'played' (src/library/libraryView.ts). */
  librarySort: string;
  /** The number on Library tiles: 'unplayed' | 'inbox' | 'downloaded' | 'downloaded_unplayed' | 'none'. */
  libraryCounter: string;
  /** Library grid columns; 0 follows the window width. */
  libraryColumns: number;
  /** Titles under the Library's cover tiles. */
  libraryShowTitles: boolean;
  /** Library layout: 'grid' | 'list'. */
  libraryView: string;
  /** Library filter, e.g. 'updated,-autoDownload' (libraryView.ts). */
  libraryFilter: string;
  /** The Episodes screen's order (an EpisodeSortKey) and filter (episodeFilter.ts). */
  episodesSort: string;
  episodesFilter: string;
  /** The Downloads screen's order, e.g. 'date:desc' (src/player/downloadView.ts). */
  downloadsSort: string;
};

/** Skip amounts offered by long-pressing the player's rewind / forward buttons (AntennaPod's list). */
export const SKIP_AMOUNTS = [5, 10, 15, 20, 30, 45, 60] as const;

export const DEFAULT_SETTINGS: Settings = {
  skipForward: 30,
  skipBackward: 10,
  playbackRate: 1,
  rewindOnResume: true,
  removeFromQueueWhenFinished: true,
  continuousPlayback: true,
  streamOverDownload: true,
  downloadOnWifiOnly: true,
  autoDownloadLimit: 3,
  autoDownloadQueue: false,
  maxDownloadedEpisodes: 20,
  deleteAfterFinished: false,
  refreshIntervalMinutes: 60,
  themePreference: 'system',
  speedPresets: '0.8,1,1.2,1.5,1.75,2,2.5,3',
  showRemainingTime: true,
  sleepMinutes: 15,
  sleepShakeToReset: true,
  sleepVibrate: false,
  sleepAutoEnable: false,
  sleepAutoFrom: 22,
  sleepAutoTo: 6,
  enqueueLocation: 'back',
  queueKeepSorted: '',
  queueLocked: false,
  queueLockExplained: false,
  inboxSort: 'date:desc',
  confirmInboxRemoveAll: true,
  homeSections: '',
  newEpisodesAction: 'inbox',
  autoDownloadNew: false,
  discoverCountry: 'us',
  librarySort: 'title',
  libraryCounter: 'unplayed',
  libraryColumns: 0,
  libraryShowTitles: true,
  libraryView: 'grid',
  libraryFilter: '',
  episodesSort: 'date_desc',
  episodesFilter: '',
  downloadsSort: 'date:desc',
};

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
