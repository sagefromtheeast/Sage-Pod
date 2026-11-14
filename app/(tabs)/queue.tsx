import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatList,
} from 'react-native';

import { getInboxCount } from '@/db/episodes';
import { clearQueue, getQueueSlots, listQueue, reorderQueue, restoreQueueSlots } from '@/db/queue';
import { setSetting, useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { refreshAllFeeds } from '@/feed/sync';
import { player, useCurrentEpisodeId } from '@/player';
import { queueTimeLeft } from '@/player/queueSorting';
import { showDialog } from '@/ui/Dialog';
import { EpisodeList } from '@/ui/episode/EpisodeList';
import { DraggableList } from '@/ui/DraggableList';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { NoMatches } from '@/ui/NoMatches';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { QueueSortSheet } from '@/ui/queue/QueueSortSheet';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';
import { formatDuration } from '@/util/time';

// A constant, so the memoised rows don't see a new array on every render.
// A kept-sorted queue decides the order itself, so manual moves are off.
const NO_MANUAL_MOVES = ['moveToTop', 'moveToBottom'] as const;

const matches = (episode: EpisodeWithFeed, term: string) =>
  episode.title.toLowerCase().includes(term) || episode.feed_title.toLowerCase().includes(term);

export default function QueueScreen() {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();

  const { data: queue = [], loading } = useQuery<EpisodeWithFeed[]>(
    () => listQueue(),
    ['queue', 'episodes', 'feeds']
  );
  const { data: inboxCount = 0 } = useQuery(() => getInboxCount(), ['episodes']);

  const locked = useSetting('queueLocked');
  const lockExplained = useSetting('queueLockExplained');
  const keptSorted = useSetting('queueKeepSorted') !== '';
  const globalSpeed = useSetting('playbackRate');

  const [sorting, setSorting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState<string | null>(null);

  const term = search?.trim().toLowerCase() ?? '';
  const shown = useMemo(() => (term ? queue.filter((episode) => matches(episode, term)) : queue), [queue, term]);
  const selection = useEpisodeSelection(shown);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  const currentEpisodeId = useCurrentEpisodeId();
  const listRef = useRef<FlatList<EpisodeWithFeed>>(null);
  const activeIndex = shown.findIndex((episode) => episode.id === currentEpisodeId);

  // Reordering by hand only makes sense on the whole, unsorted, unlocked queue.
  const canDrag = !locked && !keptSorted && !term && !selection.active;

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.load(episode, { autoPlay: true });
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshAllFeeds({ force: true });
    } finally {
      setRefreshing(false);
    }
  }, []);

  const toggleLock = useCallback(() => {
    void setSetting('queueLocked', !locked);
    if (!locked && !lockExplained) {
      void setSetting('queueLockExplained', true);
      showDialog(
        'Queue locked',
        "Episodes can't be dragged or swiped while the queue is locked. Unlock it from this menu."
      );
    }
  }, [locked, lockExplained]);

  const confirmClear = useCallback(() => {
    showDialog('Clear queue?', 'This removes every episode from the queue. Downloads are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          const slots = await getQueueSlots(queue.map((episode) => episode.id));
          await clearQueue();
          showToast('Queue cleared', () => restoreQueueSlots(slots));
        },
      },
    ]);
  }, [queue]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <Pressable
            onPress={() => setSearch((value) => (value === null ? '' : null))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={search === null ? 'Search the queue' : 'Close search'}
          >
            <Ionicons name={search === null ? 'search' : 'close'} size={22} color={theme.text} />
          </Pressable>
          <OverflowMenu
            title="Queue"
            items={[
              { key: 'sort', label: 'Sort…', icon: 'swap-vertical', onPress: () => setSorting(true) },
              {
                key: 'lock',
                label: locked ? 'Unlock queue' : 'Lock queue',
                icon: locked ? 'lock-open-outline' : 'lock-closed-outline',
                onPress: toggleLock,
              },
              { key: 'refresh', label: 'Refresh podcasts', icon: 'refresh', onPress: () => void refresh() },
              ...(queue.length > 0
                ? [
                    {
                      key: 'clear',
                      label: 'Clear queue',
                      icon: 'trash-outline' as const,
                      destructive: true,
                      onPress: confirmClear,
                    },
                  ]
                : []),
            ]}
          />
        </View>
      ),
    });
  }, [navigation, theme, search, locked, toggleLock, refresh, confirmClear, queue.length]);

  if (!loading && queue.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: theme.bg }]}>
        {inboxCount > 0 ? (
          <EmptyState
            icon="list-outline"
            title="Your queue is empty"
            message={`You have ${inboxCount} new episode${inboxCount === 1 ? '' : 's'} in your inbox. Add some to line them up here.`}
            action={{ label: 'Open inbox', onPress: () => router.push('/inbox') }}
          />
        ) : (
          <EmptyState
            icon="list-outline"
            title="Your queue is empty"
            message="Add episodes from a podcast or your inbox and they will line up here, ready to play back to back."
            action={{ label: 'Find podcasts', onPress: () => router.push('/discover') }}
          />
        )}
        <QueueSortSheet visible={sorting} onClose={() => setSorting(false)} />
      </View>
    );
  }

  const timeLeft = queueTimeLeft(queue, globalSpeed);

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={[styles.info, { borderBottomColor: theme.border }]}>
        <Text style={[styles.infoText, { color: theme.textMuted }]} numberOfLines={1}>
          {queue.length} episode{queue.length === 1 ? '' : 's'} · {formatDuration(timeLeft)} left
          {locked ? ' · Locked' : keptSorted ? ' · Kept sorted' : ''}
        </Text>
        {activeIndex >= 0 ? (
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              listRef.current?.scrollToIndex({ index: activeIndex, animated: true, viewPosition: 0.2 });
            }}
            hitSlop={8}
            style={[styles.jumpBadge, { backgroundColor: theme.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel="Scroll to playing episode"
          >
            <Ionicons name="play" size={10} color={theme.accent} />
            <Text style={[styles.jumpBadgeText, { color: theme.accent }]}>#{activeIndex + 1}</Text>
          </Pressable>
        ) : null}
      </View>

      {search !== null ? (
        <View style={[styles.search, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="Search the queue"
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            accessibilityLabel="Search the queue"
          />
        </View>
      ) : null}

      <EpisodeList ids={shown.map((episode) => episode.id)}>
        <DraggableList
          listRef={listRef}
          data={shown}
          keyOf={(episode) => episode.id}
          dragEnabled={canDrag}
          onReorder={(ids) => void reorderQueue(ids)}
          extraData={selection.selected}
          contentContainerStyle={{
            paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : MINI_PLAYER_HEIGHT + space.xl,
          }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
          onScrollToIndexFailed={(info) => {
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          }}
          ListEmptyComponent={
            term ? (
              <NoMatches message={`No queued episodes match “${search}”.`} term={search ?? ''} />
            ) : null
          }
          renderItem={(item, _index, handle) => (
            <SwipeableEpisodeRow
              episode={item}
              screen="queue"
              onPlay={play}
              swipeEnabled={!locked && !selection.active}
              // Kept sorted: a manual move would be undone at once.
              unavailable={keptSorted ? NO_MANUAL_MOVES : undefined}
              actionHooks={actionHooks}
              selecting={selection.active}
              selected={selection.selected.has(item.id)}
              onToggleSelect={selection.toggle}
              onSelectRange={selection.openRangeMenu}
              trailing={handle}
            />
          )}
        />
      </EpisodeList>

      <SelectionBar selection={selection} inQueue={!keptSorted} />
      <QueueSortSheet visible={sorting} onClose={() => setSorting(false)} />
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
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoText: {
    ...typography.caption,
    flexShrink: 1,
  },
  jumpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  jumpBadgeText: {
    ...typography.caption,
    fontWeight: '700',
    fontSize: 11,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: space.sm,
  },
});
