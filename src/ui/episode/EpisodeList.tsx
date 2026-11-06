import { useRouter } from 'expo-router';
import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';

import { rememberPagerList } from '@/episode/pagerList';

type ListRef = { current: readonly number[] | null };

/**
 * The ids of the list a screen shows, for the episode pager. A ref, so rows
 * don't re-render when the list changes; they read it only when tapped.
 */
const EpisodeListContext = createContext<ListRef>({ current: null });

/**
 * Wrap a screen's list so episodes opened from it swipe through `ids`, in its
 * order. Null leaves the pager to its fallback, the podcast's episodes.
 */
export function EpisodeList({ ids, children }: { ids: readonly number[] | null; children: ReactNode }) {
  const ref = useRef<readonly number[] | null>(ids);
  ref.current = ids;
  return <EpisodeListContext.Provider value={ref}>{children}</EpisodeListContext.Provider>;
}

/** Opens an episode's details, paging through the surrounding list if there is one. */
export function useOpenEpisode(): (episodeId: number) => void {
  const router = useRouter();
  const list = useContext(EpisodeListContext);
  return useCallback(
    (episodeId: number) => {
      const ids = list.current;
      router.push(
        ids && ids.includes(episodeId)
          ? `/episode/${episodeId}?list=${rememberPagerList(ids)}`
          : `/episode/${episodeId}`
      );
    },
    [list, router]
  );
}
