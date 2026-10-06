import { Alert } from 'react-native';

import {
  dismissManyFromInbox,
  getEpisode,
  getPlaybackSnapshots,
  markPlayedMany,
  resetPositionMany,
  restorePlaybackSnapshots,
  setFavoriteMany,
  type PlaybackSnapshot,
} from '@/db/episodes';
import { dequeue, enqueue, enqueueFront, getQueueSlots, moveToBottom, restoreQueueSlots } from '@/db/queue';
import { isQueuedNow } from '@/db/queueMembership';
import type { EpisodeWithFeed } from '@/db/types';
import { player } from '@/player';
import { cancelDownload, deleteDownload, queueDownload } from '@/player/downloads';
import type { IconName } from '@/ui/ActionSheet';
import { showToast } from '@/ui/UndoToast';
import { shareEpisode } from '@/util/share';

import { appliesTo, subjectFor, type EpisodeAction } from './episodeActions';

/** Label and icon for every action; a Record so a new action can't ship unlabelled. */
export const ACTION_META: Record<EpisodeAction, { label: string; icon: IconName; destructive?: boolean }> = {
  skip: { label: 'Skip episode', icon: 'play-skip-forward-outline' },
  removeFromInbox: { label: 'Remove from inbox', icon: 'file-tray-outline' },
  markPlayed: { label: 'Mark as played', icon: 'checkmark-done-outline' },
  markUnplayed: { label: 'Mark as unplayed', icon: 'arrow-undo-outline' },
  addToQueue: { label: 'Add to queue', icon: 'add-circle-outline' },
  removeFromQueue: { label: 'Remove from queue', icon: 'remove-circle-outline' },
  download: { label: 'Download', icon: 'arrow-down-circle-outline' },
  delete: { label: 'Delete download', icon: 'trash-outline', destructive: true },
  addToFavorites: { label: 'Add to favourites', icon: 'heart-outline' },
  removeFromFavorites: { label: 'Remove from favourites', icon: 'heart-dislike-outline' },
  resetPosition: { label: 'Reset playback position', icon: 'refresh-outline' },
  share: { label: 'Share…', icon: 'share-outline' },
  moveToTop: { label: 'Move to top', icon: 'arrow-up-outline' },
  moveToBottom: { label: 'Move to bottom', icon: 'arrow-down-outline' },
  multiSelect: { label: 'Select multiple', icon: 'checkbox-outline' },
};

export type ActionHooks = {
  /** The screen's way into selection mode, starting from this episode. */
  onMultiSelect?: (episode: EpisodeWithFeed) => void;
};

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} episodes ${many}`);

/** The episodes an action actually applies to, judged with live queue/player state. */
function targetsFor(action: EpisodeAction, episodes: EpisodeWithFeed[]): EpisodeWithFeed[] {
  const state = player.getState();
  return episodes.filter((episode) =>
    appliesTo(
      action,
      subjectFor(episode, {
        queued: isQueuedNow(episode.id),
        playing: state.episode?.id === episode.id && state.playing,
      })
    )
  );
}

/**
 * Undo that restores only the fields the action changed. The episode loaded
 * in the player keeps its live position: the player owns it, and restoring
 * an older saved value would rewind it. Only undoing "reset position" moves
 * the player, since there the position is the thing being undone.
 */
function undoSnapshots(
  saved: Map<number, PlaybackSnapshot>,
  fields: readonly (keyof PlaybackSnapshot)[],
  options: { seekPlayer?: boolean } = {}
) {
  return async () => {
    const loadedId = player.getState().episode?.id;
    const restoresPosition = fields.includes('position');
    if (restoresPosition && loadedId !== undefined && saved.has(loadedId) && !options.seekPlayer) {
      // Restore the loaded episode's other fields, but leave its position alone.
      const rest = new Map(saved);
      const loaded = rest.get(loadedId)!;
      rest.delete(loadedId);
      await restorePlaybackSnapshots(rest, fields);
      await restorePlaybackSnapshots(new Map([[loadedId, loaded]]), fields.filter((field) => field !== 'position'));
      // Re-save its live position now: the action may have zeroed the stored one,
      // and a paused player won't save again until it next plays or pauses.
      await player.flushPosition();
      return;
    }
    await restorePlaybackSnapshots(saved, fields);
    const snapshot = loadedId !== undefined ? saved.get(loadedId) : undefined;
    if (options.seekPlayer && snapshot) await player.seekTo(snapshot.position);
  };
}

const ids = (episodes: EpisodeWithFeed[]) => episodes.map((episode) => episode.id);

/**
 * Carries out an action on one or more episodes — only those it applies to.
 * Reversible ones (inbox, played state, queue removal, position reset) capture
 * the old state first and offer Undo; deleting files asks for confirmation.
 */
export async function runEpisodeAction(
  action: EpisodeAction,
  episodes: EpisodeWithFeed[],
  hooks: ActionHooks = {}
): Promise<void> {
  const targets = targetsFor(action, episodes);
  if (targets.length === 0) return;
  const n = targets.length;

  switch (action) {
    case 'skip':
      await player.skipToNext();
      return;

    case 'removeFromInbox': {
      const saved = await getPlaybackSnapshots(ids(targets));
      await dismissManyFromInbox(ids(targets));
      showToast(count(n, 'Removed from inbox', 'removed from inbox'), undoSnapshots(saved, ['is_new']));
      return;
    }

    case 'markPlayed':
    case 'markUnplayed': {
      const played = action === 'markPlayed';
      const saved = await getPlaybackSnapshots(ids(targets));
      await markPlayedMany(ids(targets), played);
      showToast(
        played ? count(n, 'Marked as played', 'marked as played') : count(n, 'Marked as unplayed', 'marked as unplayed'),
        // Marking played also clears is_new and the saved position.
        undoSnapshots(saved, ['is_played', 'is_new', 'played_at', 'position'])
      );
      return;
    }

    case 'addToQueue':
      for (const episode of targets) await enqueue(episode.id);
      showToast(count(n, 'Added to queue', 'added to queue'));
      return;

    case 'removeFromQueue': {
      const slots = await getQueueSlots(ids(targets));
      for (const episode of targets) await dequeue(episode.id);
      showToast(count(n, 'Removed from queue', 'removed from queue'), () => restoreQueueSlots(slots));
      return;
    }

    case 'download':
      for (const episode of targets) await queueDownload(episode.id);
      showToast(count(n, 'Downloading', 'downloading'));
      return;

    case 'delete':
      Alert.alert(
        n === 1 ? 'Delete download?' : `Delete ${n} downloads?`,
        'The audio file is removed from this device. You can download it again later.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () =>
              void (async () => {
                for (const { id } of targets) {
                  // Re-read: a download may have finished while the dialog was
                  // open, and cancelling a finished one would orphan its file.
                  const fresh = await getEpisode(id);
                  if (fresh?.download_state === 'done') await deleteDownload(id);
                  else if (fresh?.download_state === 'queued' || fresh?.download_state === 'downloading') {
                    await cancelDownload(id);
                  }
                }
              })(),
          },
        ]
      );
      return;

    case 'addToFavorites':
    case 'removeFromFavorites':
      await setFavoriteMany(ids(targets), action === 'addToFavorites');
      return;

    case 'resetPosition': {
      const saved = await getPlaybackSnapshots(ids(targets));
      await resetPositionMany(ids(targets));
      if (targets.some((episode) => episode.id === player.getState().episode?.id)) await player.seekTo(0);
      showToast(count(n, 'Position reset', 'reset'), undoSnapshots(saved, ['position'], { seekPlayer: true }));
      return;
    }

    case 'share': {
      const [episode] = targets;
      await shareEpisode({
        title: episode.title,
        podcastTitle: episode.feed_title,
        url: episode.link ?? episode.media_url,
      });
      return;
    }

    case 'moveToTop':
    case 'moveToBottom': {
      const slots = await getQueueSlots(ids(targets));
      if (action === 'moveToTop') {
        // Front-insert in reverse so the selection keeps its relative order.
        for (const episode of [...targets].reverse()) await enqueueFront(episode.id);
      } else {
        for (const episode of targets) await moveToBottom(episode.id);
      }
      showToast(
        action === 'moveToTop' ? count(n, 'Moved to top', 'moved to top') : count(n, 'Moved to bottom', 'moved to bottom'),
        () => restoreQueueSlots(slots)
      );
      return;
    }

    case 'multiSelect':
      hooks.onMultiSelect?.(targets[0]);
      return;
  }
}
