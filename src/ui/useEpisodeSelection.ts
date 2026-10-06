import { useCallback, useEffect, useMemo, useState } from 'react';

import { pruneSelection, selectRange, toggleSelected } from '@/actions/selection';
import type { EpisodeWithFeed } from '@/db/types';

export type EpisodeSelection = {
  active: boolean;
  selected: ReadonlySet<number>;
  selectedEpisodes: EpisodeWithFeed[];
  /** Enters selection mode with this episode selected (the "Select multiple" menu item). */
  start: (episode: EpisodeWithFeed) => void;
  toggle: (episodeId: number) => void;
  selectAll: () => void;
  /** Leaves selection mode. */
  clear: () => void;
  /** Row whose "select above / below" menu is open, if any. */
  rangeAnchor: number | null;
  openRangeMenu: (episodeId: number) => void;
  closeRangeMenu: () => void;
  selectRangeFromAnchor: (direction: 'above' | 'below') => void;
};

/** Selection mode for a list of episodes, in display order. */
export function useEpisodeSelection(episodes: EpisodeWithFeed[]): EpisodeSelection {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const [rangeAnchor, setRangeAnchor] = useState<number | null>(null);

  const orderedIds = useMemo(() => episodes.map((episode) => episode.id), [episodes]);

  // An action can remove rows (e.g. "remove from queue" on the Queue): drop
  // them from the selection rather than acting on invisible episodes.
  useEffect(() => {
    setSelected((current) => pruneSelection(orderedIds, current));
  }, [orderedIds]);

  const start = useCallback((episode: EpisodeWithFeed) => {
    setActive(true);
    setSelected(new Set([episode.id]));
  }, []);
  const toggle = useCallback((id: number) => setSelected((current) => toggleSelected(current, id)), []);
  const selectAll = useCallback(() => setSelected(new Set(orderedIds)), [orderedIds]);
  const clear = useCallback(() => {
    setActive(false);
    setSelected(new Set());
    setRangeAnchor(null);
  }, []);
  const selectRangeFromAnchor = useCallback(
    (direction: 'above' | 'below') => {
      if (rangeAnchor !== null) setSelected((current) => selectRange(orderedIds, current, rangeAnchor, direction));
      setRangeAnchor(null);
    },
    [orderedIds, rangeAnchor]
  );

  const selectedEpisodes = useMemo(
    () => episodes.filter((episode) => selected.has(episode.id)),
    [episodes, selected]
  );

  return {
    active,
    selected,
    selectedEpisodes,
    start,
    toggle,
    selectAll,
    clear,
    rangeAnchor,
    openRangeMenu: setRangeAnchor,
    closeRangeMenu: () => setRangeAnchor(null),
    selectRangeFromAnchor,
  };
}
