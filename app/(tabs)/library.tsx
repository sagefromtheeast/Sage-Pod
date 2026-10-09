import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { listLibraryFeeds, renameTag } from '@/db/feeds';
import { setSetting, useSetting } from '@/db/settings';
import type { LibraryFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import {
  allTags,
  columnsFor,
  counterValue,
  filterFeeds,
  isLibraryFiltered,
  LIBRARY_SORTS,
  parseCounter,
  parseLibraryFilter,
  parseSort,
  sortFeeds,
  type LibraryCounter,
} from '@/library/libraryView';
import { ActionSheet } from '@/ui/ActionSheet';
import { Artwork } from '@/ui/Artwork';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { gridTileSize } from '@/ui/layout';
import { FEED_SELECTION_BAR_HEIGHT, FeedSelectionBar } from '@/ui/library/FeedSelectionBar';
import { LibraryDisplaySheet, LibraryFilterSheet } from '@/ui/library/LibrarySheets';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { PodcastCard } from '@/ui/PodcastCard';
import { TextPromptSheet } from '@/ui/TextPromptSheet';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useLayout } from '@/ui/useLayout';
import { useTheme } from '@/ui/useTheme';

type Shortcut = {
  label: string;
  icon: 'heart' | 'arrow-down-circle' | 'time' | 'albums';
  href: Href;
};

const SHORTCUTS: Shortcut[] = [
  { label: 'Favourites', icon: 'heart', href: '/list/favorites' },
  { label: 'Downloads', icon: 'arrow-down-circle', href: '/list/downloads' },
  { label: 'History', icon: 'time', href: '/list/history' },
  { label: 'Episodes', icon: 'albums', href: '/episodes' as Href },
];

type Sheet = 'display' | 'sort' | 'filter' | null;

/**
 * AntennaPod's Subscriptions screen in Sage Pod's design: shortcuts, a tag
 * row, and the podcasts in a saved order, filter, layout and counter.
 * Long-press a podcast to select several; long-press a tag to rename or
 * delete it.
 */
export default function LibraryScreen() {
  const theme = useTheme();
  const router = useRouter();
  const layout = useLayout();
  const [refreshing, setRefreshing] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [tagMenu, setTagMenu] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number> | null>(null);

  const view = useSetting('libraryView') === 'list' ? 'list' : 'grid';
  const sort = parseSort(useSetting('librarySort'));
  const counter = parseCounter(useSetting('libraryCounter'));
  const showTitles = useSetting('libraryShowTitles');
  const filterRaw = useSetting('libraryFilter');
  const savedColumns = useSetting('libraryColumns');
  const globalAutoDownload = useSetting('autoDownloadNew');
  const filter = useMemo(() => parseLibraryFilter(filterRaw), [filterRaw]);

  const { data: feeds = [], loading } = useQuery<LibraryFeed[]>(() => listLibraryFeeds(), ['feeds', 'episodes']);

  const tags = useMemo(() => allTags(feeds), [feeds]);
  // A tag deleted or renamed elsewhere stops filtering.
  const activeTag = tag && tags.some((t) => t.toLowerCase() === tag.toLowerCase()) ? tag : null;
  const shown = useMemo(
    () => sortFeeds(filterFeeds(feeds, filter, { counter, globalAutoDownload, tag: activeTag }), sort),
    [feeds, filter, counter, globalAutoDownload, activeTag, sort]
  );

  const columns = columnsFor(savedColumns, layout.columns);
  const tileSize = columns === layout.columns ? layout.tileSize : gridTileSize(layout.usableWidth, columns);
  const selecting = selected !== null;

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllFeeds({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggle = (id: number) =>
    setSelected((current) => {
      const next = new Set(current ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const startSelecting = (id: number) => {
    triggerHaptic('selection');
    setSelected(new Set([id]));
  };
  const openFeed = (feed: LibraryFeed) => (selecting ? toggle(feed.id) : router.push(`/feed/${feed.id}`));

  return (
    <>
      <Tabs.Screen
        options={{
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable onPress={() => router.push('/search')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Search">
                <Ionicons name="search" size={22} color={theme.text} />
              </Pressable>
              <Pressable
                onPress={() => router.navigate('/discover')}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Add podcast"
              >
                <Ionicons name="add" size={26} color={theme.text} />
              </Pressable>
              <OverflowMenu
                title="Library"
                items={[
                  { key: 'display', label: 'Display…', icon: 'grid-outline', onPress: () => setSheet('display') },
                  { key: 'sort', label: 'Sort…', icon: 'swap-vertical', onPress: () => setSheet('sort') },
                  { key: 'filter', label: 'Filter…', icon: 'funnel-outline', onPress: () => setSheet('filter') },
                  { key: 'refresh', label: 'Refresh podcasts', icon: 'refresh', onPress: () => void refresh() },
                  { key: 'archive', label: 'Archived podcasts', icon: 'archive-outline', onPress: () => router.push('/archive' as Href) },
                  { key: 'stats', label: 'Statistics', icon: 'bar-chart-outline', onPress: () => router.push('/stats' as Href) },
                  { key: 'settings', label: 'Settings', icon: 'settings-outline', onPress: () => router.push('/settings') },
                ]}
              />
            </View>
          ),
        }}
      />
      <FlatList
        // numColumns can't change on a mounted FlatList, so a new column count
        // (rotation, split screen, the Display choice) remounts it.
        key={`${view}-${columns}`}
        data={shown}
        numColumns={view === 'grid' ? columns : 1}
        keyExtractor={(feed) => String(feed.id)}
        extraData={[selected, counter, showTitles]}
        contentContainerStyle={[
          styles.content,
          {
            paddingHorizontal: layout.gutter,
            maxWidth: layout.contentWidth,
            paddingBottom: selecting ? FEED_SELECTION_BAR_HEIGHT + space.xl : MINI_PLAYER_HEIGHT + space.xl,
          },
        ]}
        columnWrapperStyle={view === 'grid' ? styles.column : undefined}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.shortcuts}>
              {SHORTCUTS.map((shortcut) => (
                <Pressable
                  key={shortcut.label}
                  onPress={() => router.push(shortcut.href)}
                  style={({ pressed }) => [
                    styles.shortcut,
                    { backgroundColor: pressed ? theme.surfaceAlt : theme.surface, borderColor: theme.border },
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons name={shortcut.icon} size={18} color={theme.accent} />
                  <Text style={[styles.shortcutLabel, { color: theme.text }]} numberOfLines={1}>
                    {shortcut.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {feeds.length > 0 ? (
              <View style={styles.toolbar}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tags}>
                  {[null, ...tags].map((option) => {
                    const active = (option ?? '').toLowerCase() === (activeTag ?? '').toLowerCase();
                    return (
                      <Pressable
                        key={option ?? '__all'}
                        onPress={() => {
                          triggerHaptic('selection');
                          setTag(option);
                        }}
                        onLongPress={option ? () => setTagMenu(option) : undefined}
                        style={[styles.tagChip, { backgroundColor: active ? theme.accent : theme.surfaceAlt }]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                        accessibilityHint={option ? 'Long-press to rename or delete' : undefined}
                      >
                        <Text style={[styles.tagLabel, { color: active ? theme.onAccent : theme.textMuted }]}>
                          {option ?? 'All'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <Pressable
                  onPress={() => {
                    triggerHaptic('selection');
                    void setSetting('libraryView', view === 'grid' ? 'list' : 'grid');
                  }}
                  hitSlop={8}
                  style={[styles.viewToggle, { backgroundColor: theme.surfaceAlt }]}
                  accessibilityRole="button"
                  accessibilityLabel={view === 'grid' ? 'Switch to list view' : 'Switch to grid view'}
                >
                  <Ionicons name={view === 'grid' ? 'list-outline' : 'grid-outline'} size={18} color={theme.text} />
                </Pressable>
              </View>
            ) : null}

            {isLibraryFiltered(filter) ? (
              <Pressable
                onPress={() => setSheet('filter')}
                style={[styles.filtered, { backgroundColor: theme.surfaceAlt }]}
                accessibilityRole="button"
              >
                <Ionicons name="funnel" size={14} color={theme.accent} />
                <Text style={[styles.filteredLabel, { color: theme.text }]}>
                  Filtered · {shown.length} of {feeds.length}
                </Text>
                <Text style={[styles.filteredLink, { color: theme.accent }]} onPress={() => void setSetting('libraryFilter', '')}>
                  Clear
                </Text>
              </Pressable>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? null : feeds.length > 0 ? (
            <EmptyState
              icon="funnel-outline"
              title="No matching podcasts"
              message="None of your podcasts match the filter or tag."
              action={{
                label: 'Show all',
                onPress: () => {
                  setTag(null);
                  void setSetting('libraryFilter', '');
                },
              }}
            />
          ) : (
            <EmptyState
              icon="library-outline"
              title="No subscriptions yet"
              message="Podcasts you subscribe to appear here, with a badge showing what you haven't heard."
              action={{ label: 'Find podcasts', onPress: () => router.navigate('/discover') }}
            />
          )
        }
        renderItem={({ item }) =>
          view === 'grid' ? (
            <PodcastCard
              title={item.title}
              subtitle={item.author}
              artworkUrl={item.image_url}
              badge={counterValue(item, counter)}
              size={tileSize}
              showTitle={showTitles}
              warning={item.last_refresh_error !== null}
              selecting={selecting}
              selected={selected?.has(item.id) ?? false}
              onPress={() => openFeed(item)}
              onLongPress={() => (selecting ? toggle(item.id) : startSelecting(item.id))}
            />
          ) : (
            <FeedListRow
              feed={item}
              counter={counter}
              selecting={selecting}
              selected={selected?.has(item.id) ?? false}
              onPress={() => openFeed(item)}
              onLongPress={() => (selecting ? toggle(item.id) : startSelecting(item.id))}
            />
          )
        }
      />

      {selecting ? (
        <FeedSelectionBar
          selected={feeds.filter((feed) => selected.has(feed.id))}
          total={shown.length}
          onSelectAll={() => setSelected(new Set(shown.map((feed) => feed.id)))}
          onClose={() => setSelected(null)}
        />
      ) : null}

      <LibraryDisplaySheet visible={sheet === 'display'} onClose={() => setSheet(null)} />
      <LibraryFilterSheet visible={sheet === 'filter'} onClose={() => setSheet(null)} />
      <ActionSheet
        visible={sheet === 'sort'}
        title="Sort podcasts"
        items={LIBRARY_SORTS.map((option) => ({
          key: option.key,
          label: option.label,
          icon: 'swap-vertical',
          selected: option.key === sort,
          onPress: () => void setSetting('librarySort', option.key),
        }))}
        onClose={() => setSheet(null)}
      />
      <ActionSheet
        visible={tagMenu !== null}
        title={tagMenu ?? undefined}
        subtitle="Tag"
        items={
          tagMenu
            ? [
                { key: 'rename', label: 'Rename tag', icon: 'create-outline', onPress: () => setRenaming(tagMenu) },
                {
                  key: 'delete',
                  label: 'Delete tag',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => void renameTag(tagMenu, ''),
                },
              ]
            : []
        }
        onClose={() => setTagMenu(null)}
      />
      <TextPromptSheet
        visible={renaming !== null}
        title="Rename tag"
        subtitle="On every podcast that has it"
        initialValue={renaming ?? ''}
        confirmLabel="Rename"
        onSubmit={(name) => {
          if (!renaming) return;
          void renameTag(renaming, name);
          if (activeTag?.toLowerCase() === renaming.toLowerCase()) setTag(name);
        }}
        onClose={() => setRenaming(null)}
      />
    </>
  );
}

function FeedListRow({
  feed,
  counter,
  selecting,
  selected,
  onPress,
  onLongPress,
}: {
  feed: LibraryFeed;
  counter: LibraryCounter;
  selecting: boolean;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const theme = useTheme();
  const count = counterValue(feed, counter);
  const counted: Record<LibraryCounter, string> = {
    unplayed: 'unplayed',
    inbox: 'in the inbox',
    downloaded: 'downloaded',
    downloaded_unplayed: 'downloaded, unplayed',
    none: '',
  };
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [
        styles.listRow,
        {
          backgroundColor: pressed || selected ? theme.surfaceAlt : 'transparent',
          borderBottomColor: theme.border,
        },
      ]}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
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
        <Text style={[styles.listRowMeta, { color: feed.last_refresh_error ? theme.danger : theme.textFaint }]}>
          {feed.last_refresh_error
            ? 'Last refresh failed'
            : `${counter !== 'none' && count > 0 ? `${count} ${counted[counter]} · ` : ''}${feed.episode_count} episode${
                feed.episode_count === 1 ? '' : 's'
              }`}
        </Text>
      </View>
      {selecting ? (
        <Ionicons
          name={selected ? 'checkmark-circle' : 'ellipse-outline'}
          size={24}
          color={selected ? theme.accent : theme.textMuted}
        />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={theme.textFaint} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    alignSelf: 'center',
    gap: space.lg,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginRight: space.lg,
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
    paddingHorizontal: 2,
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
    gap: space.sm,
    paddingVertical: space.xs,
  },
  tags: {
    alignItems: 'center',
    gap: space.xs,
  },
  tagChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
  },
  tagLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  viewToggle: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  filtered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
  },
  filteredLabel: {
    ...typography.caption,
    flex: 1,
  },
  filteredLink: {
    ...typography.caption,
    fontWeight: '700',
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
