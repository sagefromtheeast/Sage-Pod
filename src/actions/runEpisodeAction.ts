import { Alert } from 'react-native';

import {
  dismissFromInbox,
  getPlaybackSnapshot,
  markPlayed,
  resetPosition,
  restorePlaybackSnapshot,
  setFavorite,
  type PlaybackSnapshot,
} from '@/db/episodes';
import {
  dequeue,
  enqueue,
  enqueueFront,
  getQueueSlot,
  moveToBottom,
  restoreQueueSlot,
} from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { player } from '@/player';
import { cancelDownload, deleteDownload, queueDownload } from '@/player/downloads';
import type { IconName } from '@/ui/ActionSheet';
import { showToast } from '@/ui/UndoToast';
import { shareEpisode } from '@/util/share';

import type { EpisodeAction } from './episodeActions';

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

async function snapshots(episodes: EpisodeWithFeed[]): Promise<[number, PlaybackSnapshot][]> {
  const rows = await Promise.all(episodes.map((episode) => getPlaybackSnapshot(episode.id)));
  return episodes.flatMap((episode, index) => {
    const row = rows[index];
    return row ? [[episode.id, row] as [number, PlaybackSnapshot]] : [];
  });
}

function undoSnapshots(saved: [number, PlaybackSnapshot][]) {
  return async () => {
    for (const [id, snapshot] of saved) await restorePlaybackSnapshot(id, snapshot);
  };
}

/**
 * Carries out an action on one or more episodes. Reversible ones (inbox,
 * played state, queue removal, position reset) capture the old state first
 * and offer Undo; deleting files asks for confirmation instead.
 */
export async function runEpisodeAction(
  action: EpisodeAction,
  episodes: EpisodeWithFeed[],
  hooks: ActionHooks = {}
): Promise<void> {
  if (episodes.length === 0) return;
  const n = episodes.length;

  switch (action) {
    case 'skip':
      await player.skipToNext();
      return;

    case 'removeFromInbox': {
      const targets = episodes.filter((episode) => episode.is_new === 1);
      const saved = await snapshots(targets);
      for (const episode of targets) await dismissFromInbox(episode.id);
      showToast(count(targets.length, 'Removed from inbox', 'removed from inbox'), undoSnapshots(saved));
      return;
    }

    case 'markPlayed':
    case 'markUnplayed': {
      const played = action === 'markPlayed';
      const saved = await snapshots(episodes);
      for (const episode of episodes) await markPlayed(episode.id, played);
      showToast(
        played ? count(n, 'Marked as played', 'marked as played') : count(n, 'Marked as unplayed', 'marked as unplayed'),
        undoSnapshots(saved)
      );
      return;
    }

    case 'addToQueue': {
      for (const episode of episodes) await enqueue(episode.id);
      showToast(count(n, 'Added to queue', 'added to queue'));
      return;
    }

    case 'removeFromQueue': {
      const slots: [number, number][] = [];
      for (const episode of episodes) {
        const slot = await getQueueSlot(episode.id);
        if (slot !== null) slots.push([episode.id, slot]);
        await dequeue(episode.id);
      }
      showToast(count(slots.length, 'Removed from queue', 'removed from queue'), async () => {
        for (const [id, slot] of slots) await restoreQueueSlot(id, slot);
      });
      return;
    }

    case 'download':
      for (const episode of episodes) await queueDownload(episode.id);
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
                for (const episode of episodes) {
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
      for (const episode of episodes) await setFavorite(episode.id, action === 'addToFavorites');
      return;

    case 'resetPosition': {
      const saved = await snapshots(episodes);
      for (const episode of episodes) {
        await resetPosition(episode.id);
        if (player.getState().episode?.id === episode.id) await player.seekTo(0);
      }
      showToast(count(n, 'Position reset', 'reset'), undoSnapshots(saved));
      return;
    }

    case 'share': {
      const [episode] = episodes;
      await shareEpisode({
        title: episode.title,
        podcastTitle: episode.feed_title,
        url: episode.link ?? episode.media_url,
      });
      return;
    }

    case 'moveToTop':
      // Front-insert in reverse so the selection keeps its relative order.
      for (const episode of [...episodes].reverse()) await enqueueFront(episode.id);
      return;

    case 'moveToBottom':
      for (const episode of episodes) await moveToBottom(episode.id);
      return;

    case 'multiSelect':
      hooks.onMultiSelect?.(episodes[0]);
      return;
  }
}
