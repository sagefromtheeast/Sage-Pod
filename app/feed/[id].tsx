import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listEpisodesForFeed, markFeedPlayed, type EpisodeSortKey } from '@/db/episodes';
import { deleteFeed, getFeed, setFeedFlags } from '@/db/feeds';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshFeed } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { triggerHaptic } from '@/ui/haptics';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { excerpt } from '@/util/html';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);

  const [sort, setSort] = useState<EpisodeSortKey>('date_desc');
  const [unplayedOnly, setUnplayedOnly] = useState(false);
  const [downloadedOnly, setDownloadedOnly] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasActiveFilters = unplayedOnly || downloadedOnly || favoritesOnly;

  const clearFilters = useCallback(() => {
    triggerHaptic('selection');
    setUnplayedOnly(false);
    setDownloadedOnly(false);
    setFavoritesOnly(false);
  }, []);

  const { data: feed } = useQuery<FeedWithCounts | null>(
    () => getFeed(feedId),
    ['feeds', 'episodes'],
    [feedId]
  );

  const { data: episodes = [] } = useQuery<EpisodeWithFeed[]>(
    () =>
      listEpisodesForFeed(feedId, {
        sort,
        filters: { unplayedOnly, downloadedOnly, favoritesOnly },
      }),
    ['episodes'],
    [feedId, sort, unplayedOnly, downloadedOnly, favoritesOnly]
  );

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
              <Pressable
                onPress={confirmUnsubscribe}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Unsubscribe"
              >
                <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
              </Pressable>
            </View>
          ),
        }}
      />

      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        contentContainerStyle={styles.content}
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

            <View style={styles.filterBar}>
              <View style={styles.filterPills}>
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    setUnplayedOnly((v) => !v);
                  }}
                  style={[
                    styles.filterPill,
                    { backgroundColor: unplayedOnly ? theme.accent : theme.surfaceAlt },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: unplayedOnly ? theme.onAccent : theme.textMuted },
                    ]}
                  >
                    Unplayed
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    setDownloadedOnly((v) => !v);
                  }}
                  style={[
                    styles.filterPill,
                    { backgroundColor: downloadedOnly ? theme.accent : theme.surfaceAlt },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: downloadedOnly ? theme.onAccent : theme.textMuted },
                    ]}
                  >
                    Downloaded
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    setFavoritesOnly((v) => !v);
                  }}
                  style={[
                    styles.filterPill,
                    { backgroundColor: favoritesOnly ? theme.accent : theme.surfaceAlt },
                  ]}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.filterPillText,
                      { color: favoritesOnly ? theme.onAccent : theme.textMuted },
                    ]}
                  >
                    Favorites
                  </Text>
                </Pressable>
              </View>

              <View style={styles.sortPills}>
                {([
                  { key: 'date_desc', label: 'Newest' },
                  { key: 'date_asc', label: 'Oldest' },
                  { key: 'season_asc', label: 'Season' },
                ] as const).map((s) => {
                  const active = sort === s.key;
                  return (
                    <Pressable
                      key={s.key}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSort(s.key);
                      }}
                      style={[
                        styles.sortPill,
                        { backgroundColor: active ? theme.surfaceAlt : 'transparent' },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.sortPillText,
                          { color: active ? theme.accent : theme.textFaint },
                        ]}
                      >
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
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
  filterBar: {
    gap: space.sm,
    paddingTop: space.xs,
  },
  filterPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  filterPill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  filterPillText: {
    ...typography.caption,
    fontWeight: '600',
  },
  sortPills: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  sortPill: {
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sortPillText: {
    ...typography.caption,
    fontWeight: '600',
    fontSize: 11,
  },
});
