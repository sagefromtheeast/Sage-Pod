// Relative, not '@/': the node test runner resolves this file too.
import { appliesTo, type ActionSubject, type EpisodeAction } from '../actions/episodeActions';

/**
 * Configurable swipe actions, as in AntennaPod's Settings › User interface ›
 * Swipe actions (`SwipeActionsDialog`): each list has its own right/left pair,
 * chosen from the actions that make sense on that list. The toggles pick their
 * direction from the episode (in the queue → remove, otherwise add).
 */
export type SwipeAction =
  | 'none'
  | 'toggleQueue'
  | 'removeFromQueue'
  | 'moveToTop'
  | 'moveToBottom'
  | 'removeFromInbox'
  | 'togglePlayed'
  | 'toggleFavorite'
  | 'download'
  | 'delete'
  | 'share';

export type SwipeScreen = 'inbox' | 'queue' | 'episodes' | 'downloads';

/** `right` runs on a swipe to the right (revealing the row's left edge). */
export type SwipePair = { right: SwipeAction; left: SwipeAction };

export const SWIPE_LABELS: Record<SwipeAction, string> = {
  none: 'Nothing',
  toggleQueue: 'Add to / remove from queue',
  removeFromQueue: 'Remove from queue',
  moveToTop: 'Move to top of queue',
  moveToBottom: 'Move to bottom of queue',
  removeFromInbox: 'Remove from inbox',
  togglePlayed: 'Mark played / unplayed',
  toggleFavorite: 'Add to / remove from favourites',
  download: 'Download',
  delete: 'Delete download',
  share: 'Share',
};

/** Ionicons names for the strip revealed behind the row. */
export const SWIPE_ICONS: Record<SwipeAction, string> = {
  none: 'ellipse-outline',
  toggleQueue: 'add-circle-outline',
  removeFromQueue: 'remove-circle-outline',
  moveToTop: 'arrow-up-circle-outline',
  moveToBottom: 'arrow-down-circle-outline',
  removeFromInbox: 'checkmark-done-outline',
  togglePlayed: 'checkmark-circle-outline',
  toggleFavorite: 'heart-outline',
  download: 'arrow-down-circle-outline',
  delete: 'trash-outline',
  share: 'share-social-outline',
};

export const SWIPE_SCREENS: Record<
  SwipeScreen,
  {
    label: string;
    setting: 'swipeInbox' | 'swipeQueue' | 'swipeEpisodes' | 'swipeDownloads';
    actions: readonly SwipeAction[];
    defaults: SwipePair;
  }
> = {
  // AntennaPod's defaults: right queues, left removes from the inbox (D-003.2).
  inbox: {
    label: 'Inbox',
    setting: 'swipeInbox',
    actions: ['none', 'toggleQueue', 'removeFromInbox', 'togglePlayed', 'toggleFavorite', 'download', 'share'],
    defaults: { right: 'toggleQueue', left: 'removeFromInbox' },
  },
  // Sage Pod's original queue swipes.
  queue: {
    label: 'Queue',
    setting: 'swipeQueue',
    // Move to bottom and Share: AntennaPod 3.13's queue swipes.
    actions: ['none', 'moveToTop', 'moveToBottom', 'removeFromQueue', 'togglePlayed', 'toggleFavorite', 'download', 'delete', 'share'],
    defaults: { right: 'moveToTop', left: 'removeFromQueue' },
  },
  episodes: {
    label: 'Episodes',
    setting: 'swipeEpisodes',
    actions: ['none', 'toggleQueue', 'togglePlayed', 'toggleFavorite', 'download', 'delete', 'share'],
    defaults: { right: 'toggleQueue', left: 'togglePlayed' },
  },
  downloads: {
    label: 'Downloads',
    setting: 'swipeDownloads',
    actions: ['none', 'toggleQueue', 'togglePlayed', 'toggleFavorite', 'delete', 'share'],
    defaults: { right: 'toggleQueue', left: 'delete' },
  },
};

export const SWIPE_SCREEN_KEYS = Object.keys(SWIPE_SCREENS) as SwipeScreen[];

/** A list's saved pair, 'right|left'; anything unknown or not offered on that list falls back to its default. */
export function parseSwipes(screen: SwipeScreen, raw: string | null | undefined): SwipePair {
  const { actions, defaults } = SWIPE_SCREENS[screen];
  const [right, left] = (raw ?? '').split('|');
  const valid = (value: string | undefined): value is SwipeAction =>
    value !== undefined && actions.includes(value as SwipeAction);
  return {
    right: valid(right) ? right : defaults.right,
    left: valid(left) ? left : defaults.left,
  };
}

export function serializeSwipes(pair: SwipePair): string {
  return `${pair.right}|${pair.left}`;
}

/** The episode action a swipe runs on this episode, or null when it doesn't apply. */
export function resolveSwipe(action: SwipeAction, item: ActionSubject): EpisodeAction | null {
  const pick = (yes: EpisodeAction, no: EpisodeAction, when: boolean) => (when ? yes : no);
  let resolved: EpisodeAction | null;
  switch (action) {
    case 'none':
      resolved = null;
      break;
    case 'toggleQueue':
      resolved = pick('removeFromQueue', 'addToQueue', item.queued);
      break;
    case 'togglePlayed':
      resolved = pick('markUnplayed', 'markPlayed', item.isPlayed);
      break;
    case 'toggleFavorite':
      resolved = pick('removeFromFavorites', 'addToFavorites', item.isFavorite);
      break;
    default:
      resolved = action;
  }
  return resolved !== null && appliesTo(resolved, item) ? resolved : null;
}
