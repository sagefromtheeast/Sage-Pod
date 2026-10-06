import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { listEpisodesForFeed, markFeedPlayed, type EpisodeSortKey } from '@/db/episodes';
import { deleteFeed, getFeed, setFeedFlags } from '@/db/feeds';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { fetchOlderFeedEpisodes, refreshFeed } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { GlassSegmentedControl, type SegmentOption } from '@/ui/glass';
import { triggerHaptic } from '@/ui/haptics';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { useTheme } from '@/ui/useTheme';
import { excerpt } from '@/util/html';

type FeedFilterKey = 'all' | 'unplayed' | 'downloaded' | 'favorites';

const FILTER_SEGMENTS: readonly SegmentOption<FeedFilterKey>[] = [
  { key: 'all', label: 'All' },
  { key: 'unplayed', label: 'Unplayed' },
  { key: 'downloaded', label: 'Downloaded' },
  { key: 'favorites', label: 'Favorites' },
];

/** Episodes read from the database per page, as in AntennaPod. */
const PAGE_SIZE = 150;

const SORT_SEGMENTS: readonly SegmentOption<EpisodeSortKey>[] = [
  { key: 'date_desc', label: 'Newest' },
  { key: 'date_asc', label: 'Oldest' },
  { key: 'season_asc', label: 'Season' },
];

export default function FeedScreen() {
  const theme = useTheme();
  const dockPadding = useMiniPlayerDockPadding();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);

  const [filter, setFilter] = useState<FeedFilterKey>('all');
  const [sort, setSort] = useState<EpisodeSortKey>('date_desc');
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const hasActiveFilters = filter !== 'all';

  const clearFilters = useCallback(() => {
    triggerHaptic('selection');
    setFilter('all');
  }, []);

  const { data: feed } = useQuery<FeedWithCounts | null>(
    () => getFeed(feedId),
    ['feeds', 'episodes'],
    [feedId]
  );

  const { data: episodes = [], loading: episodesLoading } = useQuery<EpisodeWithFeed[]>(
    () =>
      listEpisodesForFeed(feedId, {
        sort,
        filters: {
          unplayedOnly: filter === 'unplayed',
          downloadedOnly: filter === 'downloaded',
          favoritesOnly: filter === 'favorites',
        },
        limit,
      }),
    ['episodes'],
    [feedId, sort, filter, limit]
  );

  // A different podcast, filter or sort is a new list: start from one page.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [feedId, sort, filter]);

  // A full page means there may be more stored episodes; a short one means the
  // database is exhausted and only the feed's older pages (if any) remain.
  const moreStored = episodes.length >= limit;
  const showMoreStored = useCallback(() => {
    if (moreStored) setLimit((value) => value + PAGE_SIZE);
  }, [moreStored]);

  const loadOlder = useCallback(async () => {
    setLoadingOlder(true);
    try {
      await fetchOlderFeedEpisodes(feedId);
    } catch (error) {
      Alert.alert(
        "Couldn't load older episodes",
        error instanceof Error ? error.message : 'Check your connection and try again.'
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [feedId]);

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const refresh = useCallback(async () => {
    if (!feed) return;
    setRefreshing(true);
    try {
      await refreshFeed(feed);
    } catch (error) {
      Alert.alert('Refresh failed', error instanceof Error ? error.message : String(error));
    } finally {
      setRefreshing(false);
    }
  }, [feed]);

  const confirmUnsubscribe = useCallback(() => {
    if (!feed) return;
    Alert.alert(
      `Unsubscribe from ${feed.title}?`,
      'Its episodes, your progress, and any downloads are removed from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unsubscribe',
          style: 'destructive',
          onPress: async () => {
            await deleteFeed(feed.id);
            router.back();
          },
        },
      ]
    );
  }, [feed, router]);

  if (!feed) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const description = excerpt(feed.description, descriptionExpanded ? 4000 : 180);

  return (
    <>
      <Stack.Screen
        options={{
          title: feed.title,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Pressable
                onPress={() => router.push(`/feed/settings/${feed.id}`)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Settings"
              >
                <Ionicons name="settings-outline" size={22} color={theme.text} />
              </Pressable>
              {/* AntennaPod-style overflow menu; Unsubscribe is no longer one tap away. */}
              <OverflowMenu
                title={feed.title}
                items={[
                  { key: 'refresh', label: 'Refresh', icon: 'refresh', onPress: () => void refresh() },
                  {
                    key: 'played',
                    label: 'Mark all as played',
                    icon: 'checkmark-done-outline',
                    onPress: () =>
                      Alert.alert('Mark all as played?', `All ${feed.episode_count} episodes.`, [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Mark all', onPress: () => void markFeedPlayed(feed.id) },
                      ]),
                  },
                  ...(feed.link
                    ? [
                        {
                          key: 'website',
                          label: 'Visit website',
                          icon: 'globe-outline' as const,
                          onPress: () => void Linking.openURL(feed.link!),
                        },
                      ]
                    : []),
                  {
                    key: 'settings',
                    label: 'Podcast settings',
                    icon: 'settings-outline',
                    onPress: () => router.push(`/feed/settings/${feed.id}`),
                  },
                  {
                    key: 'unsubscribe',
                    label: 'Unsubscribe',
                    icon: 'trash-outline',
                    destructive: true,
                    onPress: confirmUnsubscribe,
                  },
                ]}
              />
            </View>
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
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Artwork uri={feed.image_url} size={104} />
              <View style={styles.headerMeta}>
                <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
                  {feed.title}
                </Text>
                {feed.author ? (
                  <Text style={[styles.author, { color: theme.textMuted }]} numberOfLines={1}>
                    {feed.author}
                  </Text>
                ) : null}
                <Text style={[styles.counts, { color: theme.textFaint }]}>
                  {feed.episode_count} episodes · {feed.unplayed_count} unplayed
                </Text>
              </View>
            </View>

            {description ? (
              <Pressable onPress={() => setDescriptionExpanded((value) => !value)}>
                <Text style={[styles.description, { color: theme.textMuted }]}>{description}</Text>
                <Text style={[styles.more, { color: theme.accent }]}>
                  {descriptionExpanded ? 'Show less' : 'Show more'}
                </Text>
              </Pressable>
            ) : null}

            <View style={styles.actions}>
              <ActionChip
                icon="refresh"
                label={refreshing ? 'Refreshing…' : 'Refresh'}
                onPress={() => void refresh()}
                disabled={refreshing}
              />
              <ActionChip
                icon={feed.auto_download ? 'arrow-down-circle' : 'arrow-down-circle-outline'}
                label="Auto-download"
                active={feed.auto_download === 1}
                onPress={() =>
                  void setFeedFlags(feed.id, { autoDownload: feed.auto_download !== 1 })
                }
              />
              <ActionChip
                icon="checkmark-done"
                label="Mark all played"
                onPress={() =>
                  Alert.alert('Mark all as played?', `All ${feed.episode_count} episodes.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Mark all', onPress: () => void markFeedPlayed(feed.id) },
                  ])
                }
              />
            </View>

            <View style={styles.segmentedControls}>
              <GlassSegmentedControl<FeedFilterKey>
                segments={FILTER_SEGMENTS}
                selectedKey={filter}
                onSelect={setFilter}
                accessibilityLabel="Filter episodes"
              />
              <GlassSegmentedControl<EpisodeSortKey>
                segments={SORT_SEGMENTS}
                selectedKey={sort}
                onSelect={setSort}
                accessibilityLabel="Sort episodes"
              />
            </View>
          </View>
        }
        onEndReached={showMoreStored}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          !episodesLoading && !moreStored && feed.next_page_url ? (
            // Paged feeds (RFC 5005) only ship their newest page; older
            // episodes are fetched on request, like AntennaPod's load-more footer.
            <Pressable
              onPress={() => void loadOlder()}
              disabled={loadingOlder}
              style={[styles.loadOlder, { borderColor: theme.border }]}
              accessibilityRole="button"
            >
              <Ionicons name="time-outline" size={16} color={theme.accent} />
              <Text style={[styles.chipLabel, { color: theme.accent }]}>
                {loadingOlder ? 'Loading older episodes…' : 'Load older episodes'}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={
          hasActiveFilters ? (
            <EmptyState
              icon="filter-outline"
              title="No matching episodes"
              message="None of the episodes match your active filters."
              action={{ label: 'Clear filters', onPress: clearFilters }}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            onPlay={play}
            hideFeedTitle
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

function ActionChip({
  icon,
  label,
  onPress,
  active = false,
  disabled = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: active ? theme.accent : theme.surfaceAlt,
          opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
        },
      ]}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={15} color={active ? theme.onAccent : theme.textMuted} />
      <Text style={[styles.chipLabel, { color: active ? theme.onAccent : theme.textMuted }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
  header: {
    padding: space.lg,
    gap: space.md,
  },
  headerTop: {
    flexDirection: 'row',
    gap: space.lg,
  },
  headerMeta: {
    flex: 1,
    gap: space.xs,
    justifyContent: 'center',
  },
  title: {
    ...typography.heading,
    lineHeight: 25,
  },
  author: {
    ...typography.label,
  },
  counts: {
    ...typography.caption,
  },
  description: {
    ...typography.body,
    lineHeight: 21,
  },
  more: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: space.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  loadOlder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginTop: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentedControls: {
    gap: space.sm,
    paddingTop: space.xs,
  },
});
