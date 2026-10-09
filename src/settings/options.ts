// Relative, not '@/': the node test runner resolves this file too.
import { CLEANUP_OPTIONS } from '../player/cleanup';
import { SMART_MARK_OPTIONS } from '../player/playedRules';

/**
 * The choices each multiple-choice setting offers on the Settings screens,
 * in one place so a test can check that every default is one of them.
 */
export const SETTING_OPTIONS = {
  themePreference: ['system', 'light', 'dark', 'oled'],
  skipForward: [10, 15, 30, 45, 60],
  skipBackward: [5, 10, 15, 30],
  refreshIntervalMinutes: [15, 30, 60, 180, 720],
  autoDownloadLimit: [0, 1, 3, 5, 10],
  maxDownloadedEpisodes: [10, 20, 50, 100, 0],
  enqueueLocation: ['back', 'front', 'afterCurrent', 'random'],
  newEpisodesAction: ['inbox', 'queue', 'nothing'],
  smartMarkSeconds: SMART_MARK_OPTIONS,
  episodeCleanup: CLEANUP_OPTIONS,
} as const;

export const ENQUEUE_LOCATION_LABELS: Record<(typeof SETTING_OPTIONS.enqueueLocation)[number], string> = {
  back: 'Back',
  front: 'Front',
  afterCurrent: 'After current',
  random: 'Random',
};

export const NEW_EPISODE_LABELS: Record<(typeof SETTING_OPTIONS.newEpisodesAction)[number], string> = {
  inbox: 'Inbox',
  queue: 'Add to queue',
  nothing: 'Nothing',
};

export const formatTheme = (theme: string) => (theme === 'oled' ? 'OLED' : theme[0].toUpperCase() + theme.slice(1));
export const formatRefresh = (minutes: number) => (minutes >= 60 ? `${minutes / 60}h` : `${minutes}m`);
