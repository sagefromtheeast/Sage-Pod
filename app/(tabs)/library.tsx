import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
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
import { EmptyState } from '@/ui/EmptyState';
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

export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [refreshing, setRefreshing] = useState(false);

  const { data: feeds = [], loading } = useQuery<FeedWithCounts[]>(
    () => listFeeds(),
    ['feeds', 'episodes']
  );

  // Derive the tile size from the viewport so the grid works on phones and
  // tablets alike without hard-coded breakpoints.
  const cardSize = (width - space.lg * 2 - space.md * (COLUMNS - 1)) / COLUMNS;

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
      data={feeds}
      numColumns={COLUMNS}
      keyExtractor={(feed) => String(feed.id)}
      contentContainerStyle={styles.content}
      columnWrapperStyle={styles.column}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />
      }
      ListHeaderComponent={
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
      renderItem={({ item }) => (
        <PodcastCard
          title={item.title}
          subtitle={item.author}
          artworkUrl={item.image_url}
          badge={item.unplayed_count}
          size={cardSize}
          onPress={() => router.push(`/feed/${item.id}`)}
        />
      )}
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
    gap: space.lg,
  },
  column: {
    gap: space.md,
  },
  shortcuts: {
    flexDirection: 'row',
    gap: space.sm,
    paddingTop: space.md,
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
});
