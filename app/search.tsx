import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { searchEpisodes } from '@/db/episodes';
import { searchFeeds } from '@/db/feeds';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player } from '@/player';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { PodcastCard } from '@/ui/PodcastCard';
import { radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useTheme } from '@/ui/useTheme';

/**
 * Searches your own library (AntennaPod's local search): podcasts whose title
 * or author match, then episodes whose title or show notes contain every word.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const dockPadding = useMiniPlayerDockPadding();
  const [term, setTerm] = useState('');
  const query = term.trim();

  const { data: feeds = [] } = useQuery<FeedWithCounts[]>(
    () => (query ? searchFeeds(query) : Promise.resolve([])),
    ['feeds'],
    [query]
  );
  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => (query ? searchEpisodes(query, 100) : Promise.resolve([])),
    ['episodes', 'feeds'],
    [query]
  );

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

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
        contentContainerStyle={{ paddingBottom: dockPadding }}
        ListHeaderComponent={
          feeds.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.heading, { color: theme.textMuted, paddingHorizontal: layout.gutter }]}>
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
                <Text style={[styles.heading, { color: theme.textMuted, paddingHorizontal: layout.gutter }]}>
                  EPISODES
                </Text>
              ) : null}
            </View>
          ) : null
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
        renderItem={({ item }) => <EpisodeRow episode={item} onPlay={play} />}
      />
      <MiniPlayerDock />
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
  hint: {
    ...typography.body,
    textAlign: 'center',
    padding: space.xl,
  },
});
