import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { runEpisodeAction } from '@/actions/runEpisodeAction';
import {
  dismissManyFromInbox,
  getPlaybackSnapshots,
  listInboxEpisodes,
  listInboxFeeds,
  listInboxIds,
  restorePlaybackSnapshots,
  type InboxFeedInfo,
  type InboxSort,
} from '@/db/episodes';
import { setSetting, useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { ActionSheet } from '@/ui/ActionSheet';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';

/** Episodes loaded per page; scrolling near the end loads the next page. */
const PAGE_SIZE = 100;

const SORTS: { sort: InboxSort; label: string; icon: 'calendar-outline' | 'time-outline' }[] = [
  { sort: 'date:desc', label: 'Newest first', icon: 'calendar-outline' },
  { sort: 'date:asc', label: 'Oldest first', icon: 'calendar-outline' },
  { sort: 'duration:asc', label: 'Shortest first', icon: 'time-outline' },
  { sort: 'duration:desc', label: 'Longest first', icon: 'time-outline' },
];

export default function InboxScreen() {
  const theme = useTheme();
  const router = useRouter();
  const sort = useSetting('inboxSort');
  const confirmRemoveAll = useSetting('confirmInboxRemoveAll');

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const [sorting, setSorting] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const term = search?.trim() ?? '';
  // A new filter, order or search starts again from the first page.
  useEffect(() => setLimit(PAGE_SIZE), [selectedFeedId, sort, term]);

  const { data: inboxFeeds = [] } = useQuery<InboxFeedInfo[]>(() => listInboxFeeds(), ['episodes', 'feeds']);
  const { data: episodes = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listInboxEpisodes({ feedId: selectedFeedId, limit, sort, search: term }),
    ['episodes', 'feeds'],
    [selectedFeedId, limit, sort, term]
  );

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllFeeds({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Both offer Undo (runEpisodeAction shows the toast).
  const dismiss = useCallback((episode: EpisodeWithFeed) => void runEpisodeAction('removeFromInbox', [episode]), []);
  const queue = useCallback((episode: EpisodeWithFeed) => void runEpisodeAction('addToQueue', [episode]), []);

  const removeAll = useCallback(async () => {
    const ids = await listInboxIds(selectedFeedId);
    if (ids.length === 0) return;
    const saved = await getPlaybackSnapshots(ids);
    await dismissManyFromInbox(ids);
    showToast(ids.length === 1 ? 'Removed from inbox' : `${ids.length} episodes removed from inbox`, () =>
      restorePlaybackSnapshots(saved, ['is_new'])
    );
  }, [selectedFeedId]);

  const confirmAndRemoveAll = useCallback(() => {
    if (!confirmRemoveAll) return void removeAll();
    Alert.alert(
      selectedFeedId === null ? 'Remove all from inbox?' : 'Remove this podcast from the inbox?',
      'The episodes stay in their podcasts; they just leave the inbox. You can undo this.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: "Don't ask again",
          onPress: () => {
            void setSetting('confirmInboxRemoveAll', false);
            void removeAll();
          },
        },
        { text: 'Remove all', style: 'destructive', onPress: () => void removeAll() },
      ]
    );
  }, [confirmRemoveAll, removeAll, selectedFeedId]);

  const header = (
    <Tabs.Screen
      options={{
        headerRight: () => (
          <View style={styles.headerButtons}>
            <Pressable
              onPress={() => setSearch((value) => (value === null ? '' : null))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={search === null ? 'Search the inbox' : 'Close search'}
            >
              <Ionicons name={search === null ? 'search' : 'close'} size={22} color={theme.text} />
            </Pressable>
            <OverflowMenu
              title="Inbox"
              items={[
                { key: 'sort', label: 'Sort…', icon: 'swap-vertical', onPress: () => setSorting(true) },
                { key: 'refresh', label: 'Refresh podcasts', icon: 'refresh', onPress: () => void refresh() },
                ...(episodes.length > 0
                  ? [
                      {
                        key: 'removeAll',
                        label: selectedFeedId === null ? 'Remove all from inbox' : 'Remove this podcast from inbox',
                        icon: 'checkmark-done-outline' as const,
                        onPress: confirmAndRemoveAll,
                      },
                    ]
                  : []),
              ]}
            />
          </View>
        ),
      }}
    />
  );

  const sortSheet = (
    <ActionSheet
      visible={sorting}
      title="Sort inbox"
      items={SORTS.map((option) => ({
        key: option.sort,
        label: option.label,
        icon: option.icon,
        selected: option.sort === sort,
        onPress: () => void setSetting('inboxSort', option.sort),
      }))}
      onClose={() => setSorting(false)}
    />
  );

  if (!loading && inboxFeeds.length === 0 && episodes.length === 0 && !term) {
    return (
      <View style={styles.screen}>
        {header}
        <EmptyState
          icon="file-tray-outline"
          title="Inbox Zero!"
          message="You're all caught up on your subscriptions. New episodes land here after a refresh."
          action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
        />
        {sortSheet}
      </View>
    );
  }

  const totalInboxCount = inboxFeeds.reduce((acc, f) => acc + f.unplayed_count, 0);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      {header}
      {search !== null ? (
        <View style={[styles.search, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="Search the inbox"
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            accessibilityLabel="Search the inbox"
          />
        </View>
      ) : null}

      {inboxFeeds.length > 1 ? (
        <View style={[styles.filterBar, { borderBottomColor: theme.border }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRack}>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setSelectedFeedId(null);
              }}
              style={[styles.chip, { backgroundColor: selectedFeedId === null ? theme.accent : theme.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={`All podcasts, ${totalInboxCount} episodes`}
            >
              <Text style={[styles.chipText, { color: selectedFeedId === null ? theme.onAccent : theme.textMuted }]}>
                All ({totalInboxCount})
              </Text>
            </Pressable>

            {inboxFeeds.map((feed) => {
              const active = selectedFeedId === feed.id;
              return (
                <Pressable
                  key={feed.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedFeedId(active ? null : feed.id);
                  }}
                  style={[styles.chip, { backgroundColor: active ? theme.accent : theme.surfaceAlt }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${feed.title}, ${feed.unplayed_count} episodes`}
                >
                  <Text style={[styles.chipText, { color: active ? theme.onAccent : theme.textMuted }]} numberOfLines={1}>
                    {feed.title} ({feed.unplayed_count})
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        data={episodes}
        keyExtractor={(episode) => String(episode.id)}
        extraData={selection.selected}
        contentContainerStyle={{
          paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : MINI_PLAYER_HEIGHT + space.xl,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.accent} />}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          // A full page means there may be more.
          if (episodes.length >= limit) setLimit((value) => value + PAGE_SIZE);
        }}
        ListEmptyComponent={
          loading ? null : term ? (
            <Text style={[styles.noMatches, { color: theme.textMuted }]}>No inbox episodes match “{term}”.</Text>
          ) : (
            <EmptyState
              icon="filter-outline"
              title="No episodes"
              message="No episodes from this podcast in your inbox."
              action={{
                label: 'Show all episodes',
                onPress: () => {
                  triggerHaptic('selection');
                  setSelectedFeedId(null);
                },
              }}
            />
          )
        }
        renderItem={({ item }) => (
          <SwipeableEpisodeRow
            episode={item}
            onPlay={play}
            onDismiss={dismiss}
            onQueue={queue}
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
      {sortSheet}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginRight: space.lg,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: space.sm,
  },
  filterBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: space.xs,
  },
  chipRack: {
    paddingHorizontal: space.lg,
    gap: space.xs,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    maxWidth: 200,
  },
  chipText: {
    ...typography.caption,
    fontWeight: '600',
  },
  noMatches: {
    ...typography.body,
    textAlign: 'center',
    padding: space.xl,
  },
});
