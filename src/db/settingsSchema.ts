/**
 * Every preference, its type and default, in a module with no imports so tests
 * can check the defaults (src/settings/__tests__/settings.test.ts).
 * src/db/settings.ts keeps them in memory and in SQLite.
 */

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
  /** Translucent glass tab bar and mini player (off: solid, docked bars, as AntennaPod draws them). */
  glassEffects: boolean;
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
  /** Player times divided by the playback speed, so they say how long listening takes. */
  adjustTimesToSpeed: boolean;
  /** Swipe actions per list, 'right|left' ('' = that list's defaults; src/settings/swipes.ts). */
  swipeInbox: string;
  swipeQueue: string;
  swipeEpisodes: string;
  swipeDownloads: string;
  /** A podcast page's episode order unless the podcast saves its own (an EpisodeSortKey). */
  defaultEpisodeSort: string;
  /** Stopping or skipping with this many seconds left counts as finished (0 = off). */
  smartMarkSeconds: number;
  /** Skipping an episode leaves it unplayed and queued; off marks it played and removes it. */
  keepSkippedEpisodes: boolean;
  /** Which played downloads may be deleted automatically (src/player/cleanup.ts). */
  episodeCleanup: string;
  /** Deleting a download also takes the episode out of the queue. */
  deleteRemovesFromQueue: boolean;
  /** Automatic feed refresh may use mobile data. */
  mobileRefresh: boolean;
  /** Stream over mobile data without asking first. */
  mobileStreaming: boolean;
  /** Statistics › Subscriptions: the date range shown (a StatsRange). */
  statsRange: string;
  /** Statistics count episodes marked played as listened to in full. */
  statsIncludeMarkedPlayed: boolean;
  /** Notify when an automatic refresh can't reach a podcast. */
  notifyRefreshErrors: boolean;
  /** Notify when a download fails. */
  notifyDownloadErrors: boolean;
  /** Automatic downloads wait until the phone is charging. */
  autoDownloadOnlyCharging: boolean;
  /** AntennaPod's automatic database backup: every 3 days, keeping the newest 5. */
  autoBackup: boolean;
  /** Skip the silent parts of episodes (Android; AntennaPod keeps it in the speed dialog). */
  skipSilence: boolean;
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
  glassEffects: false,
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
  adjustTimesToSpeed: false,
  swipeInbox: '',
  swipeQueue: '',
  swipeEpisodes: '',
  swipeDownloads: '',
  defaultEpisodeSort: 'date_desc',
  smartMarkSeconds: 30,
  keepSkippedEpisodes: true,
  episodeCleanup: 'queue',
  deleteRemovesFromQueue: false,
  mobileRefresh: true,
  mobileStreaming: true,
  statsRange: 'all',
  statsIncludeMarkedPlayed: false,
  notifyRefreshErrors: true,
  notifyDownloadErrors: true,
  autoDownloadOnlyCharging: false,
  autoBackup: false,
  skipSilence: false,
};
