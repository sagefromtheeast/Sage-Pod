import { Ionicons } from '@expo/vector-icons';
import { Redirect, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet } from 'react-native';

import { listFavorites, listHistory } from '@/db/episodes';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player } from '@/player';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { MINI_PLAYER_HEIGHT, space } from '@/ui/theme';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { useTheme } from '@/ui/useTheme';

// Downloads has its own screen (app/downloads.tsx); an old link still lands there.
type Kind = 'favorites' | 'history';

const VIEWS: Record<
  Kind,
  { title: string; load: () => Promise<EpisodeWithFeed[]>; empty: string; icon: 'heart-outline' | 'time-outline' }
> = {
  favorites: {
    title: 'Favourites',
    load: () => listFavorites(),
    empty: 'Episodes you mark with a heart collect here.',
    icon: 'heart-outline',
  },
  history: {
    title: 'History',
    load: () => listHistory(),
    empty: 'Episodes you have listened to appear here.',
    icon: 'time-outline',
  },
};

/** Shared screen for the library's saved views: Favourites and History. */
export default function ListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const dockPadding = useMiniPlayerDockPadding();
  const { kind } = useLocalSearchParams<{ kind: string }>();

  const view = VIEWS[(kind as Kind) in VIEWS ? (kind as Kind) : 'favorites'];

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(() => view.load(), ['episodes', 'feeds'], [kind]);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  if (kind === 'downloads') return <Redirect href="/downloads" />;

  return (
    <>
      <Stack.Screen
        options={{
          title: view.title,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/search')}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Ionicons name="search" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        extraData={selection.selected}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : dockPadding },
        ]}
        ListEmptyComponent={
          loading ? null : <EmptyState icon={view.icon} title={view.title} message={view.empty} />
        }
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            onPlay={play}
            actionHooks={actionHooks}
            selecting={selection.active}
            selected={selection.selected.has(item.id)}
            onToggleSelect={selection.toggle}
            onSelectRange={selection.openRangeMenu}
            trailing={
              <Pressable
                onPress={() => void enqueue(item.id)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Add to queue"
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.textMuted} />
              </Pressable>
            }
          />
        )}
      />
      <SelectionBar selection={selection} />
      <MiniPlayerDock hidden={selection.active} />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
});
