/**
 * Which actions an episode (or a selection of episodes) offers, and what its
 * row button does — as pure functions, so every screen agrees and the rules
 * can be tested.
 *
 * Mirrors AntennaPod: `FeedItemMenuHandler.onPrepareMenu` (an action shows if
 * it applies to at least one selected episode; share is single-item only) and
 * `ItemActionButton.forItem` (the row button).
 */

/** Everything the rules need to know about one episode. */
export type ActionSubject = {
  hasMedia: boolean;
  isNew: boolean;
  isPlayed: boolean;
  isFavorite: boolean;
  /** Seconds into the episode. */
  position: number;
  downloaded: boolean;
  /** Queued for download or downloading now. */
  downloading: boolean;
  queued: boolean;
  /** Loaded in the player and actually playing. */
  playing: boolean;
};

export type EpisodeAction =
  | 'skip'
  | 'removeFromInbox'
  | 'markPlayed'
  | 'markUnplayed'
  | 'addToQueue'
  | 'removeFromQueue'
  | 'download'
  | 'delete'
  | 'addToFavorites'
  | 'removeFromFavorites'
  | 'resetPosition'
  | 'share'
  | 'moveToTop'
  | 'moveToBottom'
  | 'multiSelect';

/** Long-press menu order (AntennaPod `feeditemlist_context.xml`). */
const MENU_ORDER: readonly EpisodeAction[] = [
  'skip',
  'removeFromInbox',
  'markPlayed',
  'markUnplayed',
  'addToQueue',
  'removeFromQueue',
  'delete',
  'addToFavorites',
  'removeFromFavorites',
  'resetPosition',
  'share',
  'multiSelect',
];

/** Multi-select bar order (AntennaPod `episodes_apply_action_speeddial.xml`). */
const SELECTION_ORDER: readonly EpisodeAction[] = [
  'delete',
  'download',
  'markUnplayed',
  'markPlayed',
  'removeFromQueue',
  'addToQueue',
  'removeFromInbox',
  'addToFavorites',
  'removeFromFavorites',
  'resetPosition',
  'moveToTop',
  'moveToBottom',
];

export type ActionSurface =
  /** Long-press menu on one episode. */
  | { kind: 'menu'; canMultiSelect: boolean }
  /** Bottom bar while several episodes are selected. */
  | { kind: 'selection'; inQueue: boolean };

/**
 * Whether one action makes sense for one episode. The menu shows an action if
 * it applies to any selected episode; running it acts only on those it applies
 * to (so "Delete" on a mixed selection deletes just the downloaded ones).
 */
export function appliesTo(action: EpisodeAction, item: ActionSubject): boolean {
  switch (action) {
    case 'skip':
      return item.hasMedia && item.playing;
    case 'removeFromQueue':
    case 'moveToTop':
    case 'moveToBottom':
      return item.queued;
    case 'addToQueue':
      return item.hasMedia && !item.queued;
    case 'removeFromInbox':
      return item.isNew;
    case 'markPlayed':
      return !item.isPlayed;
    case 'markUnplayed':
      return item.isPlayed;
    case 'resetPosition':
      return item.hasMedia && item.position !== 0;
    case 'delete':
      return item.hasMedia && (item.downloaded || item.downloading);
    case 'download':
      return item.hasMedia && !item.downloaded && !item.downloading;
    case 'addToFavorites':
      return !item.isFavorite;
    case 'removeFromFavorites':
      return item.isFavorite;
    case 'share':
    case 'multiSelect':
      return true;
  }
}

/** Actions decided per item (everything except the surface-level extras). */
const PER_ITEM: readonly EpisodeAction[] = [
  'skip',
  'removeFromQueue',
  'addToQueue',
  'removeFromInbox',
  'markPlayed',
  'markUnplayed',
  'resetPosition',
  'delete',
  'download',
  'addToFavorites',
  'removeFromFavorites',
];

function applicable(items: readonly ActionSubject[], multiple: boolean): Set<EpisodeAction> {
  const can = new Set<EpisodeAction>(
    PER_ITEM.filter((action) => items.some((item) => appliesTo(action, item)))
  );
  if (!multiple) can.add('share');
  // With a mixed selection, one "Add to favourites" covers everyone.
  if (multiple && can.has('addToFavorites')) can.delete('removeFromFavorites');
  return can;
}

/** The actions to offer, in display order. Empty for an empty selection. */
export function episodeActionsFor(
  items: readonly ActionSubject[],
  surface: ActionSurface
): EpisodeAction[] {
  if (items.length === 0) return [];
  const can = applicable(items, items.length > 1);

  if (surface.kind === 'menu') {
    if (surface.canMultiSelect) can.add('multiSelect');
    return MENU_ORDER.filter((action) => can.has(action));
  }

  if (surface.inQueue) {
    can.add('moveToTop');
    can.add('moveToBottom');
  }
  return SELECTION_ORDER.filter((action) => can.has(action));
}

/** What the button at the end of an episode row does. */
export type RowButton = 'pause' | 'play' | 'cancel' | 'stream' | 'download' | 'markPlayed';

/**
 * AntennaPod's ItemActionButton.forItem. `preferStreaming` picks Stream over
 * Download for episodes that aren't on the device (AntennaPod's "Prefer
 * streaming"; Sage Pod defaults it on, see docs/DECISIONS.md D-010).
 */
export function rowButtonFor(item: ActionSubject, preferStreaming: boolean): RowButton {
  if (!item.hasMedia) return 'markPlayed';
  if (item.playing) return 'pause';
  if (item.downloaded) return 'play';
  if (item.downloading) return 'cancel';
  return preferStreaming ? 'stream' : 'download';
}

/** The rules' view of a stored episode plus its live queue/player state. */
export function subjectFor(
  episode: {
    media_url: string | null;
    is_new: number;
    is_played: number;
    is_favorite: number;
    position: number;
    download_state: string;
  },
  live: { queued: boolean; playing: boolean }
): ActionSubject {
  return {
    hasMedia: Boolean(episode.media_url),
    isNew: episode.is_new === 1,
    isPlayed: episode.is_played === 1,
    isFavorite: episode.is_favorite === 1,
    position: episode.position,
    downloaded: episode.download_state === 'done',
    downloading: episode.download_state === 'queued' || episode.download_state === 'downloading',
    queued: live.queued,
    playing: live.playing,
  };
}
