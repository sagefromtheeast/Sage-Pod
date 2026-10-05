import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useState, useSyncExternalStore, type ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getInboxCount, listInProgressEpisodes, listSurpriseEpisodes } from '@/db/episodes';
import { listFeeds } from '@/db/feeds';
import { getSurpriseSeed, shuffleSurprise, subscribeSurpriseSeed } from '@/discover/surpriseSeed';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { triggerHaptic } from '@/ui/haptics';
import { GRID_GAP, type Layout } from '@/ui/layout';
import { ProgressBar } from '@/ui/ProgressBar';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useTheme } from '@/ui/useTheme';
import { formatRemaining } from '@/util/time';

/** Matches AntennaPod's Surprise section size. */
const SURPRISE_COUNT = 8;
/** Rows of subscriptions shown on Home before "See all" takes over. */
const SUBSCRIPTION_ROWS = 2;

type CardProps = {
  episode: EpisodeWithFeed;
  onPlay: () => void;
  width: number;
  artworkSize: number;
};

function ContinueCard({ episode, onPlay, width, artworkSize }: CardProps) {
  const theme = useTheme();
  const router = useRouter();
  const duration = episode.duration ?? 0;
  const progress = duration > 0 ? episode.position / duration : 0;

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={[styles.card, { width, backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Artwork uri={episode.image_url ?? episode.feed_image_url} size={artworkSize} borderRadius={radius.sm} />
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

function FeedBadge({ feed, size }: { feed: FeedWithCounts; size: number }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/feed/${feed.id}`)}
      style={[styles.feedBadge, { width: size }]}
    >
      <Artwork uri={feed.image_url} size={size} borderRadius={radius.md} />
      <Text style={[styles.feedBadgeText, { color: theme.text }]} numberOfLines={1}>
        {feed.title}
      </Text>
    </Pressable>
  );
}

function SurpriseCard({ episode, onPlay, width, artworkSize }: CardProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={[styles.surpriseCard, { width, backgroundColor: theme.surface, borderColor: theme.border }]}
    >
      <Artwork uri={episode.image_url ?? episode.feed_image_url} size={artworkSize} borderRadius={radius.md} />
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

/**
 * A row of cards: a horizontal scroller on phones and medium tablets, a
 * wrapping grid on expanded windows where there is room to show them all.
 */
function Shelf<T>({
  data,
  keyPrefix,
  getKey,
  layout,
  minCardWidth,
  resetKey,
  renderCard,
}: {
  data: T[];
  keyPrefix: string;
  getKey: (item: T) => number;
  layout: Layout;
  minCardWidth: number;
  /** Changing this scrolls the shelf back to its start. */
  resetKey?: number;
  renderCard: (item: T, width: number) => ReactElement;
}) {
  if (layout.windowClass === 'expanded') {
    const perRow = Math.max(1, Math.floor((layout.usableWidth + GRID_GAP) / (minCardWidth + GRID_GAP)));
    const width = Math.floor((layout.usableWidth - GRID_GAP * (perRow - 1)) / perRow);
    return (
      <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
        {data.map((item) => (
          <View key={`${keyPrefix}-${getKey(item)}`}>{renderCard(item, width)}</View>
        ))}
      </View>
    );
  }

  return (
    <FlatList
      key={resetKey}
      horizontal
      data={data}
      keyExtractor={(item) => `${keyPrefix}-${getKey(item)}`}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.shelfContent, { paddingHorizontal: layout.gutter }]}
      renderItem={({ item }) => renderCard(item, minCardWidth)}
    />
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const [refreshing, setRefreshing] = useState(false);
  const surpriseSeed = useSyncExternalStore(subscribeSurpriseSeed, getSurpriseSeed);

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

  // Seeded, so the shelf holds still while the player saves positions (which
  // touches the episodes table every few seconds); only shuffling changes it.
  const { data: surprise = [] } = useQuery<EpisodeWithFeed[]>(
    () => listSurpriseEpisodes(SURPRISE_COUNT, surpriseSeed),
    ['episodes', 'feeds'],
    [surpriseSeed]
  );

  const shuffle = useCallback(() => {
    triggerHaptic('selection');
    shuffleSurprise();
  }, []);

  const compactFeeds = layout.windowClass === 'compact';
  const homeFeeds = compactFeeds ? feeds : feeds.slice(0, layout.columns * SUBSCRIPTION_ROWS);

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
      contentContainerStyle={[styles.content, { maxWidth: layout.contentWidth }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
    >
      {/* Inbox Quick Access */}
      <Pressable 
        style={[styles.inboxBanner, { marginHorizontal: layout.gutter, backgroundColor: theme.surfaceAlt }]}
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
          <Text style={[styles.sectionTitle, { paddingHorizontal: layout.gutter, color: theme.text }]}>
            Continue Listening
          </Text>
          <Shelf
            data={inProgress}
            keyPrefix="continue"
            getKey={(e) => e.id}
            layout={layout}
            minCardWidth={layout.continueCardWidth}
            renderCard={(item, width) => (
              <ContinueCard
                episode={item}
                onPlay={() => play(item)}
                width={width}
                artworkSize={layout.continueArtwork}
              />
            )}
          />
        </View>
      )}

      {/* Surprise Me */}
      {surprise.length > 0 && (
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { paddingHorizontal: layout.gutter }]}>
            <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>Surprise Me</Text>
            <Pressable
              onPress={shuffle}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Shuffle suggestions"
            >
              <Ionicons name="shuffle" size={22} color={theme.accent} />
            </Pressable>
          </View>
          <Shelf
            data={surprise}
            keyPrefix="surprise"
            getKey={(e) => e.id}
            layout={layout}
            minCardWidth={layout.shelfCardWidth}
            resetKey={surpriseSeed}
            renderCard={(item, width) => (
              <SurpriseCard
                episode={item}
                onPlay={() => play(item)}
                width={width}
                artworkSize={layout.shelfArtwork}
              />
            )}
          />
        </View>
      )}

      {/* Subscriptions */}
      {feeds.length > 0 && (
        <View style={styles.section}>
          <View style={[styles.sectionHeader, { paddingHorizontal: layout.gutter }]}>
            <Text style={[styles.sectionHeaderTitle, { color: theme.text }]}>Subscriptions</Text>
            {homeFeeds.length < feeds.length && (
              <Pressable onPress={() => router.push('/library')} hitSlop={8} accessibilityRole="link">
                <Text style={[styles.seeAll, { color: theme.accent }]}>See all</Text>
              </Pressable>
            )}
          </View>
          {compactFeeds ? (
            <FlatList
              horizontal
              data={feeds}
              keyExtractor={(f) => String(f.id)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.shelfContent, { paddingHorizontal: layout.gutter }]}
              renderItem={({ item }) => <FeedBadge feed={item} size={layout.feedTile} />}
            />
          ) : (
            // Tablets: a grid sized like the Library's, instead of a thin strip
            // of phone-sized tiles across an otherwise empty screen.
            <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
              {homeFeeds.map((feed) => (
                <FeedBadge key={feed.id} feed={feed} size={layout.tileSize} />
              ))}
            </View>
          )}
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
    width: '100%',
    alignSelf: 'center',
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
    paddingTop: space.md,
    gap: space.lg,
  },
  inboxBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.lg,
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
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionHeaderTitle: {
    ...typography.subheading,
  },
  seeAll: {
    ...typography.label,
  },
  shelfContent: {
    gap: space.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  },
  card: {
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
