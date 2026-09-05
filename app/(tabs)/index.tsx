import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInboxCount, listInProgressEpisodes, listRandomUnplayedEpisodes } from '@/db/episodes';
import { listFeeds } from '@/db/feeds';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { ProgressBar } from '@/ui/ProgressBar';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { formatRemaining } from '@/util/time';

function ContinueCard({ episode, onPlay }: { episode: EpisodeWithFeed; onPlay: () => void }) {
  const theme = useTheme();
  const router = useRouter();
  const duration = episode.duration ?? 0;
  const progress = duration > 0 ? episode.position / duration : 0;

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
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
      <Pressable onPress={onPlay} hitSlop={8}>
        <Ionicons name="play-circle" size={32} color={theme.accent} />
      </Pressable>
    </Pressable>
  );
}

function FeedBadge({ feed }: { feed: FeedWithCounts }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/feed/${feed.id}`)}
      style={styles.feedBadge}
    >
      <Artwork uri={feed.image_url} size={72} borderRadius={radius.md} />
      <Text style={[styles.feedBadgeText, { color: theme.text }]} numberOfLines={1}>
        {feed.title}
      </Text>
    </Pressable>
  );
}

function SurpriseCard({ episode, onPlay }: { episode: EpisodeWithFeed; onPlay: () => void }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={[styles.surpriseCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Artwork uri={episode.image_url ?? episode.feed_image_url} size={64} borderRadius={radius.md} />
      <View style={styles.surpriseCardBody}>
        <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {episode.feed_title}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
          {episode.title}
        </Text>
      </View>
      <Pressable onPress={onPlay} hitSlop={8}>
        <Ionicons name="play-circle" size={32} color={theme.accent} />
      </Pressable>
    </Pressable>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: inProgress = [] } = useQuery<EpisodeWithFeed[]>(
    () => listInProgressEpisodes(5),
    ['episodes']
  );

  const { data: inboxCount = 0 } = useQuery(
    () => getInboxCount(),
    ['episodes']
  );

  const { data: feeds = [] } = useQuery<FeedWithCounts[]>(
    () => listFeeds(),
    ['feeds']
  );

  const { data: surprise = [] } = useQuery<EpisodeWithFeed[]>(
    () => listRandomUnplayedEpisodes(3),
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

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      {/* Inbox Quick Access */}
      <Pressable 
        style={[styles.inboxBanner, { backgroundColor: theme.surfaceAlt }]} 
        onPress={() => router.push('/inbox')}
      >
        <View style={styles.inboxBannerLeft}>
          <Ionicons name="file-tray-full-outline" size={24} color={theme.accent} />
          <Text style={[styles.inboxBannerText, { color: theme.text }]}>
            Inbox
          </Text>
        </View>
        <View style={styles.inboxBannerRight}>
          {inboxCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              <Text style={styles.badgeText}>{inboxCount}</Text>
            </View>
          ) : (
            <Text style={[styles.inboxBannerSub, { color: theme.textMuted }]}>Zero</Text>
          )}
          <Ionicons name="chevron-forward" size={20} color={theme.textMuted} />
        </View>
      </Pressable>

      {/* Continue Listening */}
      {inProgress.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Continue Listening</Text>
          <FlatList
            horizontal
            data={inProgress}
            keyExtractor={(e) => `continue-${e.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfContent}
            renderItem={({ item }) => <ContinueCard episode={item} onPlay={() => play(item)} />}
          />
        </View>
      )}

      {/* Surprise Me */}
      {surprise.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Surprise Me</Text>
          <FlatList
            horizontal
            data={surprise}
            keyExtractor={(e) => `surprise-${e.id}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfContent}
            renderItem={({ item }) => <SurpriseCard episode={item} onPlay={() => play(item)} />}
          />
        </View>
      )}

      {/* Subscriptions */}
      {feeds.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Subscriptions</Text>
          <FlatList
            horizontal
            data={feeds}
            keyExtractor={(f) => String(f.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.shelfContent}
            renderItem={({ item }) => <FeedBadge feed={item} />}
          />
        </View>
      )}

      {/* Empty State Help if no feeds */}
      {feeds.length === 0 && (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Subscribe to podcasts in Discover to populate your home dashboard.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },
  inboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
    marginHorizontal: space.lg,
    borderRadius: radius.lg,
  },
  inboxBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  inboxBannerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  inboxBannerText: {
    ...typography.subheading,
  },
  inboxBannerSub: {
    ...typography.body,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    color: '#fff',
    fontWeight: 'bold',
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...typography.subheading,
    paddingHorizontal: space.lg,
  },
  shelfContent: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  card: {
    width: 260,
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
  surpriseCard: {
    width: 300,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  surpriseCardBody: {
    flex: 1,
    gap: space.xs,
  },
  feedBadge: {
    width: 72,
    alignItems: 'center',
    gap: space.xs,
  },
  feedBadgeText: {
    ...typography.caption,
    textAlign: 'center',
  },
  emptyContainer: {
    padding: space.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    textAlign: 'center',
  },
});
