import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listEpisodesForFeed, markFeedPlayed } from '@/db/episodes';
import { deleteFeed, getFeed, setFeedFlags } from '@/db/feeds';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshFeed } from '@/feed/sync';
import { player } from '@/player';
import { Artwork } from '@/ui/Artwork';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { excerpt } from '@/util/html';

export default function FeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);

  const [showPlayed, setShowPlayed] = useState(true);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { data: feed } = useQuery<FeedWithCounts | null>(
    () => getFeed(feedId),
    ['feeds', 'episodes'],
    [feedId]
  );

  const { data: episodes = [] } = useQuery<EpisodeWithFeed[]>(
    () => listEpisodesForFeed(feedId, { includePlayed: showPlayed }),
    ['episodes'],
    [feedId, showPlayed]
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
            <Pressable
              onPress={confirmUnsubscribe}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Unsubscribe"
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
            </Pressable>
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

            <Pressable
              onPress={() => setShowPlayed((value) => !value)}
              style={styles.filterRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: !showPlayed }}
            >
              <Ionicons
                name={showPlayed ? 'square-outline' : 'checkbox'}
                size={18}
                color={showPlayed ? theme.textFaint : theme.accent}
              />
              <Text style={[styles.filterLabel, { color: theme.textMuted }]}>
                Hide played episodes
              </Text>
            </Pressable>
          </View>
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
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  filterLabel: {
    ...typography.caption,
  },
});
