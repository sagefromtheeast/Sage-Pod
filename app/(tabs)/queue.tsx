import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { useQuery } from '@/db/useQuery';
import { clearQueue, dequeue, listQueue, reorderQueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { player, usePlayerState } from '@/player';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { SwipeableQueueRow } from '@/ui/SwipeableQueueRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { formatDuration } from '@/util/time';

export default function QueueScreen() {
  const theme = useTheme();
  const router = useRouter();

  const { data: queue = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listQueue(),
    ['queue', 'episodes', 'feeds']
  );

  const { episode: currentEpisode } = usePlayerState();
  const listRef = useRef<FlatList>(null);
  const activeIndex = queue.findIndex((e) => e.id === currentEpisode?.id);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.load(episode, { autoPlay: true });
  }, []);

  /** Moves an episode one slot up or down by rewriting the whole order. */
  const move = useCallback(
    (episodeId: number, direction: -1 | 1) => {
      const ids = queue.map((episode) => episode.id);
      const from = ids.indexOf(episodeId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return;

      [ids[from], ids[to]] = [ids[to], ids[from]];
      void reorderQueue(ids);
    },
    [queue]
  );

  const moveToTop = useCallback(
    (episode: EpisodeWithFeed) => {
      const ids = queue.map((e) => e.id);
      const from = ids.indexOf(episode.id);
      if (from <= 0) return;
      ids.splice(from, 1);
      ids.unshift(episode.id);
      void reorderQueue(ids);
    },
    [queue]
  );

  const confirmClear = useCallback(() => {
    Alert.alert('Clear queue?', 'This removes every episode from the queue. Downloads are kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => void clearQueue() },
    ]);
  }, []);

  const totalSeconds = queue.reduce((sum, episode) => {
    const remaining = (episode.duration ?? 0) - episode.position;
    return sum + Math.max(0, remaining);
  }, 0);

  if (!loading && queue.length === 0) {
    return (
      <EmptyState
        icon="list-outline"
        title="Your queue is empty"
        message="Add episodes from a podcast or your inbox and they will line up here, ready to play back to back."
        action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
      />
    );
  }

  return (
    <FlatList
      ref={listRef}
      data={queue}
      keyExtractor={(episode) => String(episode.id)}
      contentContainerStyle={styles.content}
      onScrollToIndexFailed={(info) => {
        listRef.current?.scrollToOffset({
          offset: info.averageItemLength * info.index,
          animated: true,
        });
      }}
      ListHeaderComponent={
        queue.length > 0 ? (
          <View style={styles.header}>
            <Text style={[styles.headerText, { color: theme.textMuted }]}>
              {queue.length} episode{queue.length === 1 ? '' : 's'} ·{' '}
              {formatDuration(totalSeconds)} left
            </Text>
            <View style={styles.headerRight}>
              {activeIndex >= 0 ? (
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    listRef.current?.scrollToIndex({
                      index: activeIndex,
                      animated: true,
                      viewPosition: 0.2,
                    });
                  }}
                  hitSlop={8}
                  style={[styles.jumpBadge, { backgroundColor: theme.surfaceAlt }]}
                  accessibilityRole="button"
                  accessibilityLabel="Scroll to playing episode"
                >
                  <Ionicons name="play" size={10} color={theme.accent} />
                  <Text style={[styles.jumpBadgeText, { color: theme.accent }]}>
                    #{activeIndex + 1}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable onPress={confirmClear} hitSlop={8} accessibilityRole="button">
                <Text style={[styles.clear, { color: theme.danger }]}>Clear</Text>
              </Pressable>
            </View>
          </View>
        ) : null
      }
      renderItem={({ item, index }) => (
        <SwipeableQueueRow
          episode={item}
          onPlay={play}
          onRemove={(ep) => void dequeue(ep.id)}
          onMoveToTop={moveToTop}
          trailing={
            <View style={styles.trailing}>
              <Pressable
                onPress={() => move(item.id, -1)}
                disabled={index === 0}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Move up"
              >
                <Ionicons
                  name="chevron-up"
                  size={18}
                  color={index === 0 ? theme.textFaint : theme.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => move(item.id, 1)}
                disabled={index === queue.length - 1}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Move down"
              >
                <Ionicons
                  name="chevron-down"
                  size={18}
                  color={index === queue.length - 1 ? theme.textFaint : theme.textMuted}
                />
              </Pressable>
              <Pressable
                onPress={() => void dequeue(item.id)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Remove from queue"
              >
                <Ionicons name="close" size={18} color={theme.textFaint} />
              </Pressable>
            </View>
          }
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    // Clears the mini player so the last row is never hidden behind it.
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
  },
  headerText: {
    ...typography.caption,
  },
  clear: {
    ...typography.caption,
    fontWeight: '600',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  jumpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  jumpBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  trailing: {
    alignItems: 'center',
    gap: space.sm,
  },
});
