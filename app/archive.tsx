import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { listLibraryFeeds } from '@/db/feeds';
import type { LibraryFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { radius, space, type as typography } from '@/ui/theme';
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
          loading ? null : (
            <EmptyState
              icon="archive-outline"
              title="Nothing archived"
              message="When you unsubscribe and choose Archive, the podcast waits here with its episodes and your progress."
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/feed/${item.id}`)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: pressed ? theme.surfaceAlt : 'transparent', borderBottomColor: theme.border },
            ]}
            accessibilityRole="button"
          >
            <Artwork uri={item.image_url} size={52} borderRadius={radius.md} />
            <View style={styles.body}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.meta, { color: theme.textMuted }]} numberOfLines={1}>
                {[item.author, `${item.episode_count} episode${item.episode_count === 1 ? '' : 's'}`]
                  .filter(Boolean)
                  .join(' · ')}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
          </Pressable>
        )}
      />
      <MiniPlayerDock />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: { flex: 1, gap: 2 },
  title: { ...typography.body, fontWeight: '600' },
  meta: { ...typography.caption },
});
