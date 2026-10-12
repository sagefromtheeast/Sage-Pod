import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useCallback, useMemo, useState, useSyncExternalStore, type ReactElement, type ReactNode } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getInboxCount,
  listDownloaded,
  listInboxEpisodes,
  listInProgressEpisodes,
  listSurpriseEpisodes,
} from '@/db/episodes';
import { listClassicFeeds, listFeeds } from '@/db/feeds';
import { listQueue } from '@/db/queue';
import { useSetting } from '@/db/settings';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { getSurpriseSeed, shuffleSurprise, subscribeSurpriseSeed } from '@/discover/surpriseSeed';
import { refreshAllFeeds } from '@/feed/sync';
import {
  classicsSince,
  continueListening,
  HOME_SECTION_TITLES,
  parseHomeSections,
  type HomeSectionId,
} from '@/home/sections';
import { player, useEpisodePlayback } from '@/player';
import { formatBytes } from '@/player/downloads';
import { Artwork } from '@/ui/Artwork';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { triggerHaptic } from '@/ui/haptics';
import { ConfigureHomeSheet } from '@/ui/home/ConfigureHomeSheet';
import { GRID_GAP, type Layout } from '@/ui/layout';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { ProgressBar } from '@/ui/ProgressBar';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useTheme } from '@/ui/useTheme';
import { formatRemaining } from '@/util/time';

/** Matches AntennaPod's Surprise section size. */
const SURPRISE_COUNT = 8;
/** Cards in the Continue listening and In progress shelves. */
const SHELF_COUNT = 5;
/** Rows in See what's new and Manage downloads (AntennaPod shows a couple). */
const ROW_COUNT = 2;
/** Rows of subscriptions shown on Home before "See all" takes over. */
const SUBSCRIPTION_ROWS = 2;
const CLASSICS_COUNT = 8;

type CardProps = {
  episode: EpisodeWithFeed;
  onPlay: () => void;
  width: number;
  artworkSize: number;
};

/*
 * Cards are a row of two sibling buttons (open, play) rather than a button
 * inside a button, which nests <button>s on the web and confuses screen readers.
 */
function ContinueCard({ episode, onPlay, width, artworkSize }: CardProps) {
  const theme = useTheme();
  const router = useRouter();
  const duration = episode.duration ?? 0;
  // The player's periodic saves no longer re-run this shelf's query, so the
  // playing episode's card follows the player, as its list row does.
  const { isCurrent, position: livePosition } = useEpisodePlayback(episode.id);
  const position = isCurrent ? livePosition : episode.position;
  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={[styles.card, { width, backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => router.push(`/episode/${episode.id}`)}
        style={styles.cardMain}
        accessibilityRole="button"
        accessibilityLabel={`${episode.title}, ${episode.feed_title}`}
      >
        <Artwork uri={episode.image_url ?? episode.feed_image_url} size={artworkSize} borderRadius={radius.sm} />
        <View style={styles.cardBody}>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
            {episode.title}
          </Text>
          <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {formatRemaining(duration - position) || episode.feed_title}
          </Text>
          <ProgressBar progress={progress} />
        </View>
      </Pressable>
      <Pressable onPress={onPlay} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Play ${episode.title}`}>
        <Ionicons name="play-circle" size={32} color={theme.accent} />
      </Pressable>
    </View>
  );
}

function SurpriseCard({ episode, onPlay, width, artworkSize }: CardProps) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.card, { width, backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Pressable
        onPress={() => router.push(`/episode/${episode.id}`)}
        style={styles.cardMain}
        accessibilityRole="button"
        accessibilityLabel={`${episode.title}, ${episode.feed_title}`}
      >
        <Artwork uri={episode.image_url ?? episode.feed_image_url} size={artworkSize} borderRadius={radius.md} />
        <View style={styles.cardBody}>
          <Text style={[styles.cardMeta, { color: theme.textMuted }]} numberOfLines={1}>
            {episode.feed_title}
          </Text>
          <Text style={[styles.cardTitle, { color: theme.text }]} numberOfLines={2}>
            {episode.title}
          </Text>
        </View>
      </Pressable>
      <Pressable onPress={onPlay} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Play ${episode.title}`}>
        <Ionicons name="play-circle" size={32} color={theme.accent} />
      </Pressable>
    </View>
  );
}

function FeedBadge({ feed, size }: { feed: FeedWithCounts; size: number }) {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push(`/feed/${feed.id}`)}
      style={[styles.feedBadge, { width: size }]}
      accessibilityRole="button"
      accessibilityLabel={feed.title}
    >
      <Artwork uri={feed.image_url} size={size} borderRadius={radius.md} />
      <Text style={[styles.feedBadgeText, { color: theme.text }]} numberOfLines={1}>
        {feed.title}
      </Text>
    </Pressable>
  );
}

/** A strip of podcast tiles on phones, a grid on tablets. */
function FeedStrip({ feeds, layout }: { feeds: FeedWithCounts[]; layout: Layout }) {
  if (layout.windowClass === 'compact') {
    return (
      <FlatList
        horizontal
        data={feeds}
        keyExtractor={(feed) => String(feed.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.shelfContent, { paddingHorizontal: layout.gutter }]}
        renderItem={({ item }) => <FeedBadge feed={item} size={layout.feedTile} />}
      />
    );
  }
  // Tablets: a grid sized like the Library's, instead of a thin strip of
  // phone-sized tiles across an otherwise empty screen.
  return (
    <View style={[styles.grid, { paddingHorizontal: layout.gutter }]}>
      {feeds.map((feed) => (
        <FeedBadge key={feed.id} feed={feed} size={layout.tileSize} />
      ))}
    </View>
  );
}

/**
 * AntennaPod's home_section chrome: a title (with an optional count), a link
 * or control on the right, and an empty text when there is nothing to show.
 */
function HomeSection({
  title,
  count,
  right,
  empty,
  layout,
  children,
}: {
  title: string;
  count?: number;
  right?: ReactNode;
  /** Shown instead of `children` when set. */
  empty?: string | null;
  layout: Layout;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <View style={[styles.sectionHeader, { paddingHorizontal: layout.gutter }]}>
        <View style={styles.sectionTitleRow}>
          <Text style={[styles.sectionHeaderTitle, { color: theme.text }]} accessibilityRole="header">
            {title}
          </Text>
          {count ? (
            <View style={[styles.badge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.badgeText, { color: theme.onAccent }]}>{count > 99 ? '99+' : count}</Text>
            </View>
          ) : null}
        </View>
        {right}
      </View>
      {empty ? (
        <Text style={[styles.emptyText, { color: theme.textMuted, paddingHorizontal: layout.gutter }]}>{empty}</Text>
      ) : (
        children
      )}
    </View>
  );
}

function SectionLink({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="link">
      <Text style={[styles.seeAll, { color: theme.accent }]}>{label}</Text>
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
  const [configuring, setConfiguring] = useState(false);
  const surpriseSeed = useSyncExternalStore(subscribeSurpriseSeed, getSurpriseSeed);
  const sections = parseHomeSections(useSetting('homeSections'));
  const inboxSort = useSetting('inboxSort');

  const { data: queue = [] } = useQuery<EpisodeWithFeed[]>(() => listQueue(), ['queue', 'episodes', 'feeds']);
  const { data: inProgress = [] } = useQuery<EpisodeWithFeed[]>(
    // Started episodes that aren't queued: Continue listening already shows those.
    () => listInProgressEpisodes(SHELF_COUNT, { excludeQueued: true }),
    ['episodes', 'queue']
  );
  const { data: inboxCount = 0 } = useQuery(() => getInboxCount(), ['episodes']);
  const { data: newEpisodes = [] } = useQuery<EpisodeWithFeed[]>(
    () => listInboxEpisodes({ limit: ROW_COUNT, sort: inboxSort }),
    ['episodes', 'feeds'],
    [inboxSort]
  );
  const { data: feeds = [] } = useQuery<FeedWithCounts[]>(() => listFeeds(), ['feeds']);
  const { data: classics = [] } = useQuery<FeedWithCounts[]>(
    () => listClassicFeeds(classicsSince(Date.now()), CLASSICS_COUNT),
    ['playback_history', 'feeds']
  );
  const { data: downloads = [] } = useQuery<EpisodeWithFeed[]>(() => listDownloaded('size'), ['episodes']);
  // Seeded, so the shelf holds still while the player saves positions (which
  // touches the episodes table every few seconds); only shuffling changes it.
  const { data: surprise = [] } = useQuery<EpisodeWithFeed[]>(
    () => listSurpriseEpisodes(SURPRISE_COUNT, surpriseSeed),
    ['episodes', 'feeds'],
    [surpriseSeed]
  );

  const continuing = useMemo(() => continueListening(queue, SHELF_COUNT), [queue]);
  const downloadedBytes = downloads.reduce((sum, episode) => sum + (episode.downloaded_bytes ?? episode.media_size ?? 0), 0);

  const shuffle = useCallback(() => {
    triggerHaptic('selection');
    shuffleSurprise();
  }, []);

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

  const homeFeeds = layout.windowClass === 'compact' ? feeds : feeds.slice(0, layout.columns * SUBSCRIPTION_ROWS);

  const renderSection = (id: HomeSectionId): ReactElement | null => {
    const title = HOME_SECTION_TITLES[id];
    switch (id) {
      case 'queue':
        return (
          <HomeSection
            key={id}
            title={title}
            layout={layout}
            right={<SectionLink label="Queue" onPress={() => router.push('/queue')} />}
            empty={continuing.length === 0 ? 'Your queue is empty. Add episodes from the inbox or a podcast.' : null}
          >
            <Shelf
              data={continuing}
              keyPrefix="continue"
              getKey={(e) => e.id}
              layout={layout}
              minCardWidth={layout.continueCardWidth}
              renderCard={(item, width) => (
                <ContinueCard episode={item} onPlay={() => play(item)} width={width} artworkSize={layout.continueArtwork} />
              )}
            />
          </HomeSection>
        );
      case 'new':
        return (
          <HomeSection
            key={id}
            title={title}
            count={inboxCount}
            layout={layout}
            right={<SectionLink label="Inbox" onPress={() => router.push('/inbox')} />}
            empty={newEpisodes.length === 0 ? 'No new episodes. New episodes from your podcasts show up here.' : null}
          >
            <View>
              {newEpisodes.map((episode) => (
                <SwipeableEpisodeRow key={episode.id} episode={episode} screen="inbox" onPlay={play} />
              ))}
            </View>
          </HomeSection>
        );
      case 'surprise':
        return (
          <HomeSection
            key={id}
            title={title}
            layout={layout}
            right={
              <Pressable onPress={shuffle} hitSlop={8} accessibilityRole="button" accessibilityLabel="Shuffle suggestions">
                <Ionicons name="shuffle" size={22} color={theme.accent} />
              </Pressable>
            }
            empty={surprise.length === 0 ? 'Nothing to suggest yet. Subscribe to a few podcasts.' : null}
          >
            <Shelf
              data={surprise}
              keyPrefix="surprise"
              getKey={(e) => e.id}
              layout={layout}
              minCardWidth={layout.shelfCardWidth}
              resetKey={surpriseSeed}
              renderCard={(item, width) => (
                <SurpriseCard episode={item} onPlay={() => play(item)} width={width} artworkSize={layout.shelfArtwork} />
              )}
            />
          </HomeSection>
        );
      case 'classics':
        return (
          <HomeSection
            key={id}
            title={title}
            layout={layout}
            right={<SectionLink label="Library" onPress={() => router.push('/library')} />}
            empty={classics.length === 0 ? 'The podcasts you listen to most will show up here.' : null}
          >
            <FeedStrip feeds={classics} layout={layout} />
          </HomeSection>
        );
      case 'downloads':
        return (
          <HomeSection
            key={id}
            title={title}
            layout={layout}
            right={<SectionLink label="Downloads" onPress={() => router.push('/downloads')} />}
            empty={downloads.length === 0 ? 'No downloaded episodes.' : null}
          >
            <Text style={[styles.sectionNote, { color: theme.textMuted, paddingHorizontal: layout.gutter }]}>
              {downloads.length} episode{downloads.length === 1 ? '' : 's'} · {formatBytes(downloadedBytes)}
            </Text>
            <View>
              {downloads.slice(0, ROW_COUNT).map((episode) => (
                <EpisodeRow key={episode.id} episode={episode} onPlay={play} />
              ))}
            </View>
          </HomeSection>
        );
      case 'inProgress':
        if (inProgress.length === 0) return null;
        return (
          <HomeSection key={id} title={title} layout={layout}>
            <Shelf
              data={inProgress}
              keyPrefix="progress"
              getKey={(e) => e.id}
              layout={layout}
              minCardWidth={layout.continueCardWidth}
              renderCard={(item, width) => (
                <ContinueCard episode={item} onPlay={() => play(item)} width={width} artworkSize={layout.continueArtwork} />
              )}
            />
          </HomeSection>
        );
      case 'subscriptions':
        if (feeds.length === 0) return null;
        return (
          <HomeSection
            key={id}
            title={title}
            layout={layout}
            right={
              homeFeeds.length < feeds.length || layout.windowClass === 'compact' ? (
                <SectionLink label="See all" onPress={() => router.push('/library')} />
              ) : null
            }
          >
            <FeedStrip feeds={homeFeeds} layout={layout} />
          </HomeSection>
        );
    }
  };

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => router.push('/search')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Search"
              >
                <Ionicons name="search" size={22} color={theme.text} />
              </Pressable>
              <OverflowMenu
                title="Home"
                items={[
                  { key: 'refresh', label: 'Refresh podcasts', icon: 'refresh', onPress: () => void refresh() },
                  {
                    key: 'configure',
                    label: 'Configure home screen',
                    icon: 'options-outline',
                    onPress: () => setConfiguring(true),
                  },
                  { key: 'settings', label: 'Settings', icon: 'settings-outline', onPress: () => router.push('/settings') },
                ]}
              />
            </View>
          ),
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { maxWidth: layout.contentWidth }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
      >
        {feeds.length === 0 ? (
          <View style={[styles.welcome, { marginHorizontal: layout.gutter, backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.emptyText, { color: theme.text }]}>
              Subscribe to podcasts in Discover to fill your home screen.
            </Text>
            <SectionLink label="Find podcasts" onPress={() => router.push('/discover')} />
          </View>
        ) : null}
        {sections.filter((section) => section.visible).map((section) => renderSection(section.id))}
      </ScrollView>
      <ConfigureHomeSheet visible={configuring} onClose={() => setConfiguring(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignSelf: 'center',
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
    paddingTop: space.md,
    gap: space.xl,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginRight: space.lg,
  },
  welcome: {
    padding: space.lg,
    borderRadius: radius.lg,
    gap: space.sm,
    alignItems: 'center',
  },
  section: {
    gap: space.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  sectionHeaderTitle: {
    ...typography.subheading,
  },
  sectionNote: {
    ...typography.caption,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  badgeText: {
    ...typography.caption,
    fontWeight: '700',
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
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
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
  feedBadge: {
    alignItems: 'center',
    gap: space.xs,
  },
  feedBadgeText: {
    ...typography.caption,
    textAlign: 'center',
  },
  emptyText: {
    ...typography.body,
  },
});
