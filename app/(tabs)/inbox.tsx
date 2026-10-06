import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  InboxFeedInfo,
  dismissAllFromInbox,
  dismissFromInbox,
  listInboxEpisodes,
  listInboxFeeds,
} from '@/db/episodes';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function InboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);

  const { data: inboxFeeds = [] } = useQuery<InboxFeedInfo[]>(
    () => listInboxFeeds(),
    ['episodes', 'feeds']
  );

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listInboxEpisodes({ feedId: selectedFeedId, limit: 500 }),
    ['episodes', 'feeds'],
    [selectedFeedId]
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

  // enqueue() takes the episode out of the inbox itself.
  const handleQueue = async (episode: EpisodeWithFeed) => {
    await enqueue(episode.id);
  };

  const clearCurrent = async () => {
    if (selectedFeedId !== null) {
      for (const ep of episodes) {
        await dismissFromInbox(ep.id);
      }
    } else {
      await dismissAllFromInbox();
    }
  };

  if (!loading && inboxFeeds.length === 0 && episodes.length === 0) {
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

  const totalInboxCount = inboxFeeds.reduce((acc, f) => acc + f.unplayed_count, 0);

  return (
    <>
      <Tabs.Screen 
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => void clearCurrent()}
              hitSlop={12}
              style={{ marginRight: 16 }}
              accessibilityRole="button"
              accessibilityLabel={selectedFeedId ? 'Dismiss all for this podcast' : 'Dismiss all'}
            >
              <Ionicons name="checkmark-done-outline" size={24} color={theme.text} />
            </Pressable>
          )
        }}
      />
      {inboxFeeds.length > 1 ? (
        <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRack}
          >
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setSelectedFeedId(null);
              }}
              style={[
                styles.chip,
                { backgroundColor: selectedFeedId === null ? theme.accent : theme.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`All podcasts, ${totalInboxCount} episodes`}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: selectedFeedId === null ? theme.onAccent : theme.textMuted },
                ]}
              >
                All ({totalInboxCount})
              </Text>
            </Pressable>

            {inboxFeeds.map((feed) => {
              const active = selectedFeedId === feed.id;
              return (
                <Pressable
                  key={feed.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedFeedId(active ? null : feed.id);
                  }}
                  style={[
                    styles.chip,
                    { backgroundColor: active ? theme.accent : theme.surfaceAlt },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${feed.title}, ${feed.unplayed_count} episodes`}
                >
                  <Text
                    style={[
                      styles.chipText,
                      { color: active ? theme.onAccent : theme.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {feed.title} ({feed.unplayed_count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon="filter-outline"
              title="No episodes"
              message="No episodes from this podcast in your inbox."
              action={{
                label: 'Show all episodes',
                onPress: () => {
                  triggerHaptic('selection');
                  setSelectedFeedId(null);
                },
              }}
            />
          )
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
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  chipRack: {
    paddingHorizontal: space.lg,
    gap: space.xs,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    maxWidth: 200,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
});
