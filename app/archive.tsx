import { Stack, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { listLibraryFeeds } from '@/db/feeds';
import type { LibraryFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { EmptyState } from '@/ui/EmptyState';
import { FeedListRow } from '@/ui/library/FeedListRow';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { useLayout } from '@/ui/useLayout';
import { useTheme } from '@/ui/useTheme';

/**
 * Podcasts unsubscribed with "Archive" (AntennaPod's archive): kept with
 * their episodes and progress, not refreshed. Open one to subscribe again
 * or delete it.
 */
export default function ArchiveScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const dockPadding = useMiniPlayerDockPadding();
  const { data: feeds = [], loading } = useQuery<LibraryFeed[]>(() => listLibraryFeeds('archived'), ['feeds', 'episodes']);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Archived podcasts' }} />
      <FlatList
        data={feeds}
        keyExtractor={(feed) => String(feed.id)}
        contentContainerStyle={{ paddingHorizontal: layout.gutter, paddingBottom: dockPadding }}
        ListEmptyComponent={
          loading ? undefined : (
            <EmptyState
              icon="archive-outline"
              title="Nothing archived"
              message="When you unsubscribe and choose Archive, the podcast waits here with its episodes and your progress."
            />
          )
        }
        renderItem={({ item }) => (
          <FeedListRow feed={item} counter="none" onPress={() => router.push(`/feed/${item.id}`)} />
        )}
      />
      <MiniPlayerDock />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
