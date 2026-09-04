import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { dismissAllFromInbox, dismissFromInbox, listInboxEpisodes } from '@/db/episodes';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { EmptyState } from '@/ui/EmptyState';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MINI_PLAYER_HEIGHT, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function InboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listInboxEpisodes(500),
    ['episodes', 'feeds']
  );

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllFeeds({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const handleDismiss = async (episode: EpisodeWithFeed) => {
    await dismissFromInbox(episode.id);
  };

  const handleQueue = async (episode: EpisodeWithFeed) => {
    await enqueue(episode.id);
    await dismissFromInbox(episode.id);
  };

  const clearAll = async () => {
    await dismissAllFromInbox();
  };

  if (!loading && episodes.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Tabs.Screen options={{ headerRight: () => null }} />
        <EmptyState
          icon="file-tray-outline"
          title="Inbox Zero!"
          message="You're all caught up on your subscriptions."
          action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
        />
      </View>
    );
  }

  return (
    <>
      <Tabs.Screen 
        options={{
          headerRight: () => (
            <Pressable onPress={clearAll} hitSlop={12} style={{ marginRight: 16 }}>
              <Ionicons name="checkmark-done-outline" size={24} color={theme.text} />
            </Pressable>
          )
        }}
      />
      <View style={styles.header}>
        <Text style={[styles.headerText, { color: theme.textMuted }]}>
          Swipe right to queue, swipe left to dismiss.
        </Text>
      </View>
      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }
        renderItem={({ item }) => (
          <SwipeableEpisodeRow
            episode={item}
            onPlay={play}
            onDismiss={handleDismiss}
            onQueue={handleQueue}
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  emptyContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  headerText: {
    ...typography.caption,
    textAlign: 'center',
  },
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
});
