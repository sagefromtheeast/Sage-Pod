import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { EPISODE_SORT_KEYS, EPISODE_SORT_LABELS, listAllEpisodes, parseEpisodeSort } from '@/db/episodes';
import { setSetting, useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { describeFilter, isFiltered, parseEpisodeFilter } from '@/feed/episodeFilter';
import { player } from '@/player';
import { ActionSheet } from '@/ui/ActionSheet';
import { EmptyState } from '@/ui/EmptyState';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { FeedFilterSheet } from '@/ui/feed/FeedFilterSheet';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { radius, space, type as typography } from '@/ui/theme';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';

/** Episodes read per page, as on the podcast page. */
const PAGE_SIZE = 150;

/**
 * AntennaPod's Episodes screen: every subscribed podcast's episodes in one
 * list, with a saved filter and order. Long-press to select several.
 */
export default function EpisodesScreen() {
  const theme = useTheme();
  const dockPadding = useMiniPlayerDockPadding();
  const sort = parseEpisodeSort(useSetting('episodesSort'));
  const filterRaw = useSetting('episodesFilter');
  const filter = useMemo(() => parseEpisodeFilter(filterRaw), [filterRaw]);
  const [sheet, setSheet] = useState<'sort' | 'filter' | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);

  // A new order or filter starts again from the first page.
  useEffect(() => setLimit(PAGE_SIZE), [sort, filterRaw]);

  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listAllEpisodes({ sort, episodeFilter: filter, limit }),
    ['episodes', 'feeds', 'queue'],
    [sort, filter, limit]
  );

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);
  const filtered = isFiltered(filter);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen
        options={{
          title: 'Episodes',
          headerRight: () => (
            <OverflowMenu
              title="Episodes"
              items={[
                { key: 'sort', label: 'Sort…', icon: 'swap-vertical', onPress: () => setSheet('sort') },
                { key: 'filter', label: 'Filter…', icon: filtered ? 'funnel' : 'funnel-outline', onPress: () => setSheet('filter') },
              ]}
            />
          ),
        }}
      />
      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        extraData={selection.selected}
        contentContainerStyle={{ paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : dockPadding }}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // A full page means there may be more.
          if (episodes.length >= limit) setLimit((value) => value + PAGE_SIZE);
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.summary, { color: theme.textMuted }]}>{EPISODE_SORT_LABELS[sort]}</Text>
            {filtered ? (
              <Pressable
                onPress={() => setSheet('filter')}
                style={[styles.filtered, { backgroundColor: theme.surfaceAlt }]}
                accessibilityRole="button"
              >
                <Ionicons name="funnel" size={14} color={theme.accent} />
                <Text style={[styles.filteredLabel, { color: theme.text }]} numberOfLines={1}>
                  {describeFilter(filter)}
                </Text>
                <Text
                  style={[styles.filteredLink, { color: theme.accent }]}
                  onPress={() => void setSetting('episodesFilter', '')}
                >
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              icon={filtered ? 'funnel-outline' : 'albums-outline'}
              title={filtered ? 'No matching episodes' : 'No episodes yet'}
              message={
                filtered
                  ? 'None of your episodes match the filter.'
                  : 'Episodes of the podcasts you follow appear here.'
              }
              action={filtered ? { label: 'Clear filter', onPress: () => void setSetting('episodesFilter', '') } : undefined}
            />
          )
        }
        renderItem={({ item }) => (
          <SwipeableEpisodeRow
            episode={item}
            screen="episodes"
            onPlay={play}
            swipeEnabled={!selection.active}
            actionHooks={actionHooks}
            selecting={selection.active}
            selected={selection.selected.has(item.id)}
            onToggleSelect={selection.toggle}
            onSelectRange={selection.openRangeMenu}
          />
        )}
      />
      <SelectionBar selection={selection} />
      <MiniPlayerDock hidden={selection.active} />

      <FeedFilterSheet
        visible={sheet === 'filter'}
        subtitle="Saved for this screen"
        value={filterRaw}
        onChange={(value) => void setSetting('episodesFilter', value)}
        onClose={() => setSheet(null)}
      />
      <ActionSheet
        visible={sheet === 'sort'}
        title="Sort episodes"
        items={EPISODE_SORT_KEYS.filter((key) => key !== 'season_asc').map((key) => ({
          key,
          label: EPISODE_SORT_LABELS[key],
          icon: 'swap-vertical',
          selected: key === sort,
          onPress: () => void setSetting('episodesSort', key),
        }))}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  summary: { ...typography.caption },
  filtered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  filteredLabel: { ...typography.caption, flex: 1 },
  filteredLink: { ...typography.caption, fontWeight: '700' },
});
