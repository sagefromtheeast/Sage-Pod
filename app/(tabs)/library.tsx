import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { listFeeds } from '@/db/feeds';
import type { FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { PodcastCard } from '@/ui/PodcastCard';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const COLUMNS = 3;

type Shortcut = { label: string; icon: 'heart' | 'arrow-down-circle' | 'time' | 'bar-chart'; href: Href };

const SHORTCUTS: Shortcut[] = [
  { label: 'Favourites', icon: 'heart', href: '/list/favorites' },
  { label: 'Downloads', icon: 'arrow-down-circle', href: '/list/downloads' },
  { label: 'History', icon: 'time', href: '/list/history' },
  { label: 'Stats', icon: 'bar-chart', href: '/stats' as any },
];

type SortOption = 'title' | 'updated' | 'unplayed';
type ViewMode = 'grid' | 'list';

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('title');

  const { data: feeds = [], loading } = useQuery<FeedWithCounts[]>(
    () => listFeeds(),
    ['feeds', 'episodes']
  );

  // Derive the tile size from the viewport so the grid works on phones and
  // tablets alike without hard-coded breakpoints.
  const cardSize = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

  const sortedFeeds = useMemo(() => {
    const list = [...feeds];
    if (sortOption === 'updated') {
      return list.sort((a, b) => (b.latest_published_at ?? 0) - (a.latest_published_at ?? 0));
    }
    if (sortOption === 'unplayed') {
      return list.sort((a, b) => b.unplayed_count - a.unplayed_count);
    }
    return list.sort((a, b) => a.title.localeCompare(b.title));
  }, [feeds, sortOption]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllFeeds({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  return (
    <FlatList
      key={viewMode}
      data={sortedFeeds}
      numColumns={viewMode === 'grid' ? COLUMNS : 1}
      keyExtractor={(feed) => String(feed.id)}
      contentContainerStyle={styles.content}
      columnWrapperStyle={viewMode === 'grid' ? styles.column : undefined}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.shortcuts}>
            {SHORTCUTS.map((shortcut) => (
              <Pressable
                key={shortcut.label}
                onPress={() => router.push(shortcut.href)}
                style={({ pressed }) => [
                  styles.shortcut,
                  {
                    backgroundColor: pressed ? theme.surfaceAlt : theme.surface,
                    borderColor: theme.border,
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name={shortcut.icon} size={18} color={theme.accent} />
                <Text style={[styles.shortcutLabel, { color: theme.text }]}>{shortcut.label}</Text>
              </Pressable>
            ))}
          </View>

          {feeds.length > 0 ? (
            <View style={styles.toolbar}>
              <View style={styles.sortChips}>
                {(['title', 'updated', 'unplayed'] as const).map((opt) => {
                  const active = sortOption === opt;
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSortOption(opt);
                      }}
                      style={[
                        styles.sortChip,
                        { backgroundColor: active ? theme.accent : theme.surfaceAlt },
                      ]}
                      accessibilityRole="button"
                    >
                      <Text
                        style={[
                          styles.sortChipLabel,
                          { color: active ? theme.onAccent : theme.textMuted },
                        ]}
                      >
                        {opt === 'title' ? 'A–Z' : opt === 'updated' ? 'Updated' : 'Unplayed'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  setViewMode((mode) => (mode === 'grid' ? 'list' : 'grid'));
                }}
                hitSlop={8}
                style={[styles.viewToggle, { backgroundColor: theme.surfaceAlt }]}
                accessibilityRole="button"
                accessibilityLabel={viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
              >
                <Ionicons
                  name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'}
                  size={18}
                  color={theme.text}
                />
              </Pressable>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? null : (
          <EmptyState
            icon="library-outline"
            title="No subscriptions yet"
            message="Podcasts you subscribe to appear here, with a badge showing what you haven't heard."
            action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
          />
        )
      }
      renderItem={({ item }) =>
        viewMode === 'grid' ? (
          <PodcastCard
            title={item.title}
            subtitle={item.author}
            artworkUrl={item.image_url}
            badge={item.unplayed_count}
            size={cardSize}
            onPress={() => router.push(`/feed/${item.id}`)}
          />
        ) : (
          <FeedListRow
            feed={item}
            onPress={() => router.push(`/feed/${item.id}`)}
          />
        )
      }
    />
  );
}

function FeedListRow({ feed, onPress }: { feed: FeedWithCounts; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: pressed ? theme.surfaceAlt : 'transparent',
          borderBottomColor: theme.border,
        },
      ]}
      accessibilityRole="button"
    >
      <Artwork uri={feed.image_url} size={52} borderRadius={radius.md} />
      <View style={styles.listRowBody}>
        <Text style={[styles.listRowTitle, { color: theme.text }]} numberOfLines={1}>
          {feed.title}
        </Text>
        {feed.author ? (
          <Text style={[styles.listRowSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
            {feed.author}
          </Text>
        ) : null}
        <Text style={[styles.listRowMeta, { color: theme.textFaint }]}>
          {feed.unplayed_count > 0 ? `${feed.unplayed_count} unplayed · ` : ''}
          {feed.episode_count} episode{feed.episode_count === 1 ? '' : 's'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
    gap: space.lg,
  },
  header: {
    gap: space.md,
    paddingTop: space.md,
  },
  column: {
    gap: space.md,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: space.sm,
  },
  shortcut: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shortcutLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  sortChips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
  sortChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  sortChipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listRowBody: {
    flex: 1,
    gap: 2,
  },
  listRowTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  listRowSubtitle: {
    ...typography.caption,
  },
  listRowMeta: {
    ...typography.caption,
    fontSize: 11,
    marginTop: 2,
  },
});
