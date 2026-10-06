import { useEffect, useState, useSyncExternalStore } from 'react';

import { player, type PlayerState } from './service';

/**
 * Subscribes a component to the full playback state.
 *
 * Use this only in components that genuinely render everything — the mini
 * player and the full player screen. It re-renders on every status tick, so
 * list rows should use `useEpisodePlayback` instead.
 */
export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    (onChange) => player.subscribe(onChange),
    () => player.getState(),
    () => player.getState()
  );
}

/** Just the loaded episode's id: re-renders when the episode changes, not on every tick. */
export function useCurrentEpisodeId(): number | null {
  return useSyncExternalStore(
    (onChange) => player.subscribe(onChange),
    () => player.getState().episode?.id ?? null,
    () => player.getState().episode?.id ?? null
  );
}

export type EpisodePlayback = {
  /** True when this episode is the one loaded in the player. */
  isCurrent: boolean;
  /** True when this episode is the one loaded *and* playing. */
  playing: boolean;
  /** Live position in whole seconds; 0 for any episode that isn't current. */
  position: number;
};

/** Shared, referentially stable snapshot for every episode that isn't playing. */
const IDLE: EpisodePlayback = { isCurrent: false, playing: false, position: 0 };

function select(state: PlayerState, episodeId: number): EpisodePlayback {
  if (state.episode?.id !== episodeId) return IDLE;
  return {
    isCurrent: true,
    playing: state.playing,
    // Whole seconds: the engine reports twice a second but a list row can only
    // show second-level detail, so rounding halves the re-render rate.
    position: Math.floor(state.position),
  };
}

/**
 * Playback state for one episode, scoped so unrelated rows never re-render.
 *
 * Every non-current episode gets the same frozen `IDLE` object, so a list of
 * fifty rows re-renders exactly one row per tick instead of all fifty.
 */
export function useEpisodePlayback(episodeId: number): EpisodePlayback {
  const [snapshot, setSnapshot] = useState(() => select(player.getState(), episodeId));

  useEffect(() => {
    setSnapshot(select(player.getState(), episodeId));
    return player.subscribe((state) => {
      const next = select(state, episodeId);
      setSnapshot((previous) =>
        previous.isCurrent === next.isCurrent &&
        previous.playing === next.playing &&
        previous.position === next.position
          ? previous
          : next
      );
    });
  }, [episodeId]);

  return snapshot;
}
