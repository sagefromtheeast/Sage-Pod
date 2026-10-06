import { useSyncExternalStore } from 'react';

import { episodeActionsFor, subjectFor } from '@/actions/episodeActions';
import { ACTION_META, runEpisodeAction, type ActionHooks } from '@/actions/runEpisodeAction';
import { isQueuedNow } from '@/db/queueMembership';
import type { EpisodeWithFeed } from '@/db/types';
import { player } from '@/player';

import { ActionSheet, type SheetItem } from './ActionSheet';

/**
 * The long-press menu for an episode, shared by every list. Rows call
 * `openEpisodeActions(episode, hooks)`; one host at the root renders the sheet.
 */
type Request = { episode: EpisodeWithFeed; hooks: ActionHooks };

let current: Request | null = null;
const listeners = new Set<() => void>();

function set(request: Request | null): void {
  current = request;
  for (const listener of listeners) listener();
}

export function openEpisodeActions(episode: EpisodeWithFeed, hooks: ActionHooks = {}): void {
  set({ episode, hooks });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function EpisodeActionsHost() {
  const request = useSyncExternalStore(subscribe, () => current);

  let items: SheetItem[] = [];
  if (request) {
    const { episode, hooks } = request;
    const state = player.getState();
    const subject = subjectFor(episode, {
      queued: isQueuedNow(episode.id),
      playing: state.episode?.id === episode.id && state.playing,
    });
    items = episodeActionsFor([subject], { kind: 'menu', canMultiSelect: Boolean(hooks.onMultiSelect) }).map(
      (action) => ({
        key: action,
        ...ACTION_META[action],
        onPress: () => void runEpisodeAction(action, [episode], hooks),
      })
    );
  }

  return (
    <ActionSheet
      visible={request !== null}
      title={request?.episode.title}
      subtitle={request?.episode.feed_title}
      items={items}
      onClose={() => set(null)}
    />
  );
}
