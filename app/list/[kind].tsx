import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { DownloadSortKey, listDownloaded, listFavorites, listHistory } from '@/db/episodes';
import { enqueue } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player } from '@/player';
import { deleteDownload, formatBytes } from '@/player/downloads';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { triggerHaptic } from '@/ui/haptics';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Kind = 'favorites' | 'downloads' | 'history';

const VIEWS: Record<
  Kind,
  { title: string; load: () => Promise<EpisodeWithFeed[]>; empty: string; icon: 'heart-outline' | 'arrow-down-circle-outline' | 'time-outline' }
> = {
  favorites: {
    title: 'Favourites',
    load: () => listFavorites(),
    empty: 'Episodes you mark with a heart collect here.',
    icon: 'heart-outline',
  },
  downloads: {
    title: 'Downloads',
    load: () => listDownloaded(),
    empty: 'Downloaded episodes play without a connection and appear here.',
    icon: 'arrow-down-circle-outline',
  },
  history: {
    title: 'History',
    load: () => listHistory(),
    empty: 'Episodes you have listened to appear here.',
    icon: 'time-outline',
  },
};

/** Shared screen for the library's three saved views. */
export default function ListScreen() {
  const theme = useTheme();
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const [downloadSort, setDownloadSort] = useState<DownloadSortKey>('date');

  const view = VIEWS[(kind as Kind) in VIEWS ? (kind as Kind) : 'favorites'];

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => (kind === 'downloads' ? listDownloaded(downloadSort) : view.load()),
    ['episodes', 'feeds'],
    [kind, downloadSort]
  );

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const totalBytes =
    kind === 'downloads'
      ? episodes.reduce((acc, ep) => acc + (ep.downloaded_bytes ?? ep.media_size ?? 0), 0)
      : 0;

  return (
    <>
      <Stack.Screen options={{ title: view.title }} />
      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          kind === 'downloads' && episodes.length > 0 ? (
            <View
              style={[
                styles.downloadHeader,
                { borderBottomColor: theme.border },
              ]}
            >
              <Text style={[styles.downloadMetaText, { color: theme.textMuted }]}>
                {episodes.length} {episodes.length === 1 ? 'episode' : 'episodes'} ·{' '}
                {formatBytes(totalBytes)}
              </Text>
              <View style={styles.sortPills}>
                {(
                  [
                    { key: 'date', label: 'Date' },
                    { key: 'size', label: 'Size' },
                    { key: 'duration', label: 'Duration' },
                  ] as const
                ).map((item) => {
                  const active = downloadSort === item.key;
                  return (
                    <Pressable
                      key={item.key}
                      onPress={() => {
                        triggerHaptic('selection');
                        setDownloadSort(item.key);
                      }}
                      style={[
                        styles.sortPill,
                        { backgroundColor: active ? theme.accent : theme.surfaceAlt },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Sort by ${item.label}`}
                    >
                      <Text
                        style={[
                          styles.sortPillText,
                          { color: active ? theme.onAccent : theme.textMuted },
                        ]}
                      >
                        {item.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null
        }
        ListEmptyComponent={
          loading ? null : <EmptyState icon={view.icon} title={view.title} message={view.empty} />
        }
        renderItem={({ item }) => (
          <EpisodeRow
            episode={item}
            onPlay={play}
            trailing={
              kind === 'downloads' ? (
                <Pressable
                  onPress={() => void deleteDownload(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete download"
                >
                  <Ionicons name="trash-outline" size={19} color={theme.textFaint} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void enqueue(item.id)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Add to queue"
                >
                  <Ionicons name="add-circle-outline" size={20} color={theme.textMuted} />
                </Pressable>
              )
            }
          />
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: MINI_PLAYER_HEIGHT + space.xl,
  },
  downloadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  downloadMetaText: {
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
