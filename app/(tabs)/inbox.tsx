import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';

import { listInProgressEpisodes, listRecentEpisodes } from '@/db/episodes';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { ProgressBar } from '@/ui/ProgressBar';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { formatRemaining } from '@/util/time';

const CONTINUE_CARD_WIDTH = 260;

/**
 * The Inbox: newest episodes across every subscription, with a
 * "continue listening" shelf for anything already started.
 */
export default function InboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listRecentEpisodes(120),
    ['episodes', 'feeds']
  );

  const { data: inProgress = [] } = useQuery<EpisodeWithFeed[]>(
    () => listInProgressEpisodes(10),
    ['episodes']
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

  if (!loading && episodes.length === 0) {
    return (
      <EmptyState
        icon="file-tray-outline"
        title="No episodes yet"
        message="Subscribe to a podcast and its newest episodes will collect here."
        action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
      />
    );
  }

  return (
    <FlatList
      data={episodes}
      keyExtractor={(episode) => String(episode.id)}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
      }
      ListHeaderComponent={
        inProgress.length > 0 ? (
          <View style={styles.shelf}>
            <Text style={[styles.shelfTitle, { color: theme.text }]}>Continue listening</Text>
            <FlatList
              horizontal
              data={inProgress}
              keyExtractor={(episode) => `continue-${episode.id}`}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shelfContent}
              renderItem={({ item }) => (
                <ContinueCard episode={item} onPlay={() => play(item)} />
              )}
            />
          </View>
        ) : null
      }
      renderItem={({ item }) => (
        <EpisodeRow
          episode={item}
          onPlay={play}
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
  );
}

function ContinueCard({ episode, onPlay }: { episode: EpisodeWithFeed; onPlay: () => void }) {
  const theme = useTheme();
  const router = useRouter();

  const duration = episode.duration ?? 0;
  const progress = duration > 0 ? episode.position / duration : 0;

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
      accessibilityRole="button"
    >
      <Artwork uri={episode.image_url ?? episode.feed_image_url} size={48} borderRadius={radius.sm} />

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {episode.title}
        </Text>
        <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {formatRemaining(duration - episode.position) || episode.feed_title}
        </Text>
        <ProgressBar progress={progress} />
      </View>

      <Pressable
        onPress={onPlay}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Resume"
      >
        <Ionicons name="play-circle" size={32} color={theme.accent} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
  shelf: {
    paddingTop: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  shelfTitle: {
    ...typography.subheading,
    paddingHorizontal: space.lg,
  },
  shelfContent: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  card: {
    width: CONTINUE_CARD_WIDTH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardBody: {
    flex: 1,
    gap: space.xs,
  },
  cardTitle: {
    ...typography.label,
    fontWeight: '600',
    lineHeight: 17,
  },
  cardMeta: {
    ...typography.caption,
  },
});
