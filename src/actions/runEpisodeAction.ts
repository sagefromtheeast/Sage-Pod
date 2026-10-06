import { Alert } from 'react-native';

import {
  dismissManyFromInbox,
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

/** Undo for playback-field changes; also moves the player back if the episode is loaded. */
function undoSnapshots(saved: Map<number, PlaybackSnapshot>) {
  return async () => {
    await restorePlaybackSnapshots(saved);
    const current = player.getState().episode;
    const snapshot = current ? saved.get(current.id) : undefined;
    if (snapshot) await player.seekTo(snapshot.position);
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
      showToast(count(n, 'Removed from inbox', 'removed from inbox'), undoSnapshots(saved));
      return;
    }

    case 'markPlayed':
    case 'markUnplayed': {
      const played = action === 'markPlayed';
      const saved = await getPlaybackSnapshots(ids(targets));
      await markPlayedMany(ids(targets), played);
      showToast(
        played ? count(n, 'Marked as played', 'marked as played') : count(n, 'Marked as unplayed', 'marked as unplayed'),
        undoSnapshots(saved)
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
                for (const episode of targets) {
                  if (episode.download_state === 'done') await deleteDownload(episode.id);
                  else await cancelDownload(episode.id);
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
      showToast(count(n, 'Position reset', 'reset'), undoSnapshots(saved));
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
      // Front-insert in reverse so the selection keeps its relative order.
      for (const episode of [...targets].reverse()) await enqueueFront(episode.id);
      return;

    case 'moveToBottom':
      for (const episode of targets) await moveToBottom(episode.id);
      return;

    case 'multiSelect':
      hooks.onMultiSelect?.(targets[0]);
      return;
  }
}
