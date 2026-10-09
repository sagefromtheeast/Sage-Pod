import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchEpisodes } from '@/db/episodes';
import { searchFeeds } from '@/db/feeds';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player } from '@/player';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { PodcastCard } from '@/ui/PodcastCard';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';

/** AntennaPod's local search shows up to 300 episodes. */
const EPISODE_LIMIT = 300;

/**
 * Searches your own library (AntennaPod's local search): podcasts whose title
 * or author match, then episodes whose title or show notes contain every word.
 * "Search online" hands the words to Discover. Long-press an episode to
 * select several.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const dockPadding = useMiniPlayerDockPadding();
  // Screens with their own search ("Search everywhere") pass their words in.
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [term, setTerm] = useState(q ?? '');
  const query = term.trim();

  const { data: feeds = [] } = useQuery<FeedWithCounts[]>(
    () => (query ? searchFeeds(query) : Promise.resolve([])),
    ['feeds'],
    [query]
  );
  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => (query ? searchEpisodes(query, EPISODE_LIMIT) : Promise.resolve([])),
    ['episodes', 'feeds'],
    [query]
  );

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Search' }} />
      <View style={[styles.search, { backgroundColor: theme.surfaceAlt, marginHorizontal: layout.gutter }]}>
        <Ionicons name="search" size={16} color={theme.textMuted} />
        <TextInput
          value={term}
          onChangeText={setTerm}
          autoFocus
          placeholder="Search podcasts and episodes"
          placeholderTextColor={theme.textFaint}
          style={[styles.searchInput, { color: theme.text }]}
          returnKeyType="search"
          accessibilityLabel="Search podcasts and episodes"
        />
      </View>

      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        keyboardShouldPersistTaps="handled"
        extraData={selection.selected}
        contentContainerStyle={{
          paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : dockPadding,
        }}
        ListHeaderComponent={
          <>
            {query ? (
              <Pressable
                onPress={() =>
                  router.navigate({
                    pathname: '/discover',
                    params: { q: query },
                  })
                }
                style={({ pressed }) => [
                  styles.online,
                  {
                    paddingHorizontal: layout.gutter,
                    backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name="globe-outline" size={20} color={theme.accent} />
                <Text style={[styles.onlineLabel, { color: theme.text }]} numberOfLines={1}>
                  Search online for “{query}”
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
              </Pressable>
            ) : null}
            {feeds.length > 0 ? (
              <View style={styles.section}>
                <Text
                  style={[
                    styles.heading,
                    {
                      color: theme.textMuted,
                      paddingHorizontal: layout.gutter,
                    },
                  ]}
                >
                  PODCASTS
                </Text>
                <FlatList
                  horizontal
                  data={feeds}
                  keyExtractor={(feed) => String(feed.id)}
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={[styles.feeds, { paddingHorizontal: layout.gutter }]}
                  renderItem={({ item }) => (
                    <PodcastCard
                      title={item.title}
                      subtitle={item.author}
                      artworkUrl={item.image_url}
                      size={layout.feedTile}
                      onPress={() => router.push(`/feed/${item.id}`)}
                    />
                  )}
                />
                {episodes.length > 0 ? (
                  <Text
                    style={[
                      styles.heading,
                      {
                        color: theme.textMuted,
                        paddingHorizontal: layout.gutter,
                      },
                    ]}
                  >
                    EPISODES
                  </Text>
                ) : null}
              </View>
            ) : null}
            {feeds.length === 0 && episodes.length > 0 ? (
              <Text style={[styles.heading, { color: theme.textMuted, paddingHorizontal: layout.gutter }]}>
                EPISODES
              </Text>
            ) : null}
          </>
        }
        ListEmptyComponent={
          !query ? (
            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Search titles, authors and show notes in the podcasts you follow.
            </Text>
          ) : loading || feeds.length > 0 ? null : (
            <Text style={[styles.hint, { color: theme.textMuted }]}>Nothing in your library matches “{query}”.</Text>
          )
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
          />
        )}
      />
      <SelectionBar selection={selection} />
      <MiniPlayerDock hidden={selection.active} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: space.sm,
  },
  section: {
    gap: space.sm,
    paddingBottom: space.sm,
  },
  heading: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: space.sm,
  },
  feeds: {
    gap: space.md,
  },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  onlineLabel: {
    ...typography.body,
    flex: 1,
  },
  hint: {
    ...typography.body,
    textAlign: 'center',
    padding: space.xl,
  },
});
