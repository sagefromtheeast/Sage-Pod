import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { runEpisodeAction } from '@/actions/runEpisodeAction';
import type { SheetItem } from '@/ui/ActionSheet';
import { getEpisode, listFeedEpisodeIds } from '@/db/episodes';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player, useCurrentEpisodeId } from '@/player';
import { EpisodeDetails } from '@/ui/episode/EpisodeDetails';
import { MiniPlayerDock } from '@/ui/MiniPlayerDock';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { useTheme } from '@/ui/useTheme';
import { shareEpisode } from '@/util/share';

/**
 * Episode details, swipeable sideways to the podcast's other episodes (newest
 * on the left, as on the podcast page), like AntennaPod's episode pager.
 */
export default function EpisodeScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const openedId = Number(id);
  const [currentId, setCurrentId] = useState(openedId);

  const { data: opened } = useQuery<EpisodeWithFeed | null>(() => getEpisode(openedId), ['episodes'], [openedId]);
  const feedId = opened?.feed_id ?? null;
  const { data: feedIds } = useQuery<number[] | null>(
    () => (feedId === null ? Promise.resolve(null) : listFeedEpisodeIds(feedId)),
    ['episodes'],
    [feedId]
  );
  // Freeze the page list once loaded, so a refresh adding episodes doesn't
  // shift the page under the reader's thumb.
  const frozen = useRef<number[] | null>(null);
  if (!frozen.current && feedIds && feedIds.includes(openedId)) frozen.current = feedIds;
  const ids = frozen.current;
  // The page on screen when the list (re)mounts: rotating remounts it at the
  // new width, so it reopens on the same episode instead of between pages.
  const initialIndex = ids ? Math.max(0, ids.indexOf(currentId)) : 0;

  // Follows the page on screen from the scroll offset (momentum events don't
  // fire on every platform), so the header menu acts on the visible episode.
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!ids) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    const next = ids[Math.max(0, Math.min(ids.length - 1, index))];
    if (next !== undefined && next !== currentId) setCurrentId(next);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: '', headerRight: () => <EpisodeMenu episodeId={currentId} /> }} />
      {ids && ids.length > 1 ? (
        <FlatList
          key={`pager-${width}`}
          data={ids}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => String(item)}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          windowSize={3}
          initialNumToRender={1}
          maxToRenderPerBatch={2}
          onScroll={onScroll}
          scrollEventThrottle={100}
          renderItem={({ item }) => (
            <View style={{ width }}>
              <EpisodeDetails episodeId={item} />
            </View>
          )}
        />
      ) : (
        <EpisodeDetails episodeId={openedId} />
      )}
      <MiniPlayerDock />
    </View>
  );
}

/** The header ⋯ menu (AntennaPod's episode toolbar), for the page on screen. */
function EpisodeMenu({ episodeId }: { episodeId: number }) {
  const router = useRouter();
  const loadedId = useCurrentEpisodeId();
  const { data: episode } = useQuery<EpisodeWithFeed | null>(() => getEpisode(episodeId), ['episodes'], [episodeId]);

  const items = useMemo<SheetItem[]>(() => {
    if (!episode) return [];
    const loaded = loadedId === episode.id;
    const position = loaded ? player.getState().position : episode.position;
    const link = episode.link ?? episode.media_url;
    return [
      ...(loaded
        ? [{ key: 'skip', label: 'Skip episode', icon: 'play-skip-forward-outline' as const, onPress: () => void player.skipToNext() }]
        : []),
      ...(episode.is_new
        ? [
            {
              key: 'inbox',
              label: 'Remove from inbox',
              icon: 'file-tray-outline' as const,
              onPress: () => void runEpisodeAction('removeFromInbox', [episode]),
            },
          ]
        : []),
      // Any saved position, played or not: a replayed episode keeps is_played.
      ...(episode.position > 0
        ? [
            {
              key: 'reset',
              label: 'Reset playback position',
              icon: 'refresh-outline' as const,
              onPress: () => void runEpisodeAction('resetPosition', [episode]),
            },
          ]
        : []),
      {
        key: 'podcast',
        label: 'Open podcast',
        icon: 'albums-outline',
        onPress: () => router.push(`/feed/${episode.feed_id}`),
      },
      ...(episode.link
        ? [
            {
              key: 'website',
              label: 'Visit website',
              icon: 'globe-outline' as const,
              onPress: () => void WebBrowser.openBrowserAsync(episode.link!),
            },
          ]
        : []),
      {
        key: 'share',
        label: 'Share episode',
        icon: 'share-outline',
        onPress: () => void shareEpisode({ title: episode.title, podcastTitle: episode.feed_title, url: link }),
      },
      ...(position > 15
        ? [
            {
              key: 'shareAt',
              label: 'Share from current position',
              icon: 'time-outline' as const,
              onPress: () =>
                void shareEpisode({
                  title: episode.title,
                  podcastTitle: episode.feed_title,
                  url: link,
                  positionSeconds: position,
                }),
            },
          ]
        : []),
      {
        key: 'shareMedia',
        label: 'Share audio file link',
        icon: 'musical-notes-outline',
        onPress: () =>
          void shareEpisode({ title: episode.title, podcastTitle: episode.feed_title, url: episode.media_url }),
      },
    ];
  }, [episode, loadedId, router]);

  if (!episode) return null;
  return <OverflowMenu title={episode.title} items={items} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
