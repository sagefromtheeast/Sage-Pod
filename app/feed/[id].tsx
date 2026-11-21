import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  dismissManyFromInbox,
  EPISODE_SORT_KEYS,
  EPISODE_SORT_LABELS,
  parseEpisodeSort,
  getPlaybackSnapshots,
  listEpisodesForFeed,
  listInboxIds,
  markFeedPlayed,
  restorePlaybackSnapshots,
  type EpisodeSortKey,
} from '@/db/episodes';
import { deleteFeed, getFeed, setFeedFlags, setFeedViewPrefs } from '@/db/feeds';
import { enqueue } from '@/db/queue';
import { useSetting } from '@/db/settings';
import type { EpisodeWithFeed, FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { describeFilter, isFiltered, parseEpisodeFilter } from '@/feed/episodeFilter';
import { fetchOlderFeedEpisodes, refreshFeed, refreshFeedCompletely, subscribe } from '@/feed/sync';
import { player } from '@/player';
import { showDialog } from '@/ui/Dialog';
import { EpisodeList } from '@/ui/episode/EpisodeList';
import { ActionSheet, type IconName } from '@/ui/ActionSheet';
import { Artwork } from '@/ui/Artwork';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { FeedFilterSheet } from '@/ui/feed/FeedFilterSheet';
import { askToUnsubscribe } from '@/ui/library/unsubscribe';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';
import { excerpt } from '@/util/html';

/** Episodes read from the database per page, as in AntennaPod. */
const PAGE_SIZE = 150;

export default function FeedScreen() {
  const theme = useTheme();
  const dockPadding = useMiniPlayerDockPadding();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);

  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [sheet, setSheet] = useState<'filter' | 'sort' | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const { data: feed } = useQuery<FeedWithCounts | null>(() => getFeed(feedId), ['feeds', 'episodes'], [feedId]);
  const { data: inboxIds = [] } = useQuery<number[]>(() => listInboxIds(feedId), ['episodes'], [feedId]);

  // Previews and archived podcasts aren't subscriptions: no refresh, inbox or
  // settings, and a Subscribe button instead.
  const archived = feed?.state === 'archived';
  const preview = feed?.state === 'preview' || archived;
  // The podcast's saved order, else Settings › User interface › default order.
  const defaultSort = useSetting('defaultEpisodeSort');
  const sort = parseEpisodeSort(feed?.episode_sort || defaultSort);
  const filterRaw = feed?.episode_filter ?? null;
  const filter = useMemo(() => parseEpisodeFilter(filterRaw), [filterRaw]);
  const filtered = isFiltered(filter);
  const term = search?.trim() ?? '';

  const { data: episodes = [], loading: episodesLoading } = useQuery<EpisodeWithFeed[]>(
    () => listEpisodesForFeed(feedId, { sort, episodeFilter: filter, search: term, limit }),
    ['episodes', 'queue'],
    [feedId, sort, filter, term, limit]
  );

  // A different podcast, filter, sort or search is a new list: start from one page.
  useEffect(() => {
    setLimit(PAGE_SIZE);
  }, [feedId, sort, filterRaw, term]);

  // A full page means there may be more stored episodes; a short one means the
  // database is exhausted and only the feed's older pages (if any) remain.
  const moreStored = episodes.length >= limit;
  const showMoreStored = useCallback(() => {
    if (moreStored) setLimit((value) => value + PAGE_SIZE);
  }, [moreStored]);

  const loadOlder = useCallback(async () => {
    setLoadingOlder(true);
    try {
      await fetchOlderFeedEpisodes(feedId);
    } catch (error) {
      showDialog(
        "Couldn't load older episodes",
        error instanceof Error ? error.message : 'Check your connection and try again.'
      );
    } finally {
      setLoadingOlder(false);
    }
  }, [feedId]);

  const selection = useEpisodeSelection(episodes);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const refresh = useCallback(
    async (complete = false) => {
      if (!feed) return;
      setRefreshing(true);
      try {
        if (complete) {
          const added = await refreshFeedCompletely(feed);
          showToast(added > 0 ? `${added} episodes added` : 'No missing episodes found');
        } else {
          await refreshFeed(feed);
        }
      } catch {
        // The "Last refresh failed" banner shows the reason.
      } finally {
        setRefreshing(false);
      }
    },
    [feed]
  );

  const subscribeNow = useCallback(async () => {
    if (!feed) return;
    setSubscribing(true);
    try {
      await subscribe(feed.feed_url);
      showToast(`Subscribed to ${feed.title}`);
    } catch (error) {
      showDialog('Could not subscribe', error instanceof Error ? error.message : String(error));
    } finally {
      setSubscribing(false);
    }
  }, [feed]);

  const removeAllFromInbox = useCallback(async () => {
    if (inboxIds.length === 0) return;
    const saved = await getPlaybackSnapshots(inboxIds);
    await dismissManyFromInbox(inboxIds);
    showToast(
      inboxIds.length === 1 ? 'Removed from inbox' : `${inboxIds.length} episodes removed from inbox`,
      () => restorePlaybackSnapshots(saved, ['is_new'])
    );
  }, [inboxIds]);

  const confirmUnsubscribe = useCallback(() => {
    if (feed) askToUnsubscribe([feed], () => router.back());
  }, [feed, router]);

  if (!feed) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const description = excerpt(feed.description, descriptionExpanded ? 4000 : 180);
  const share = () =>
    void Share.share({ message: `${feed.title}\n${feed.link ?? feed.feed_url}\nFeed: ${feed.feed_url}` });

  const menu = [
    ...(preview
      ? []
      : [
          { key: 'sort', label: 'Sort…', icon: 'swap-vertical' as IconName, onPress: () => setSheet('sort') },
          { key: 'refresh', label: 'Refresh', icon: 'refresh' as IconName, onPress: () => void refresh() },
          {
            key: 'refreshAll',
            label: 'Refresh complete podcast',
            icon: 'cloud-download-outline' as IconName,
            onPress: () => void refresh(true),
          },
        ]),
    ...(feed.link
      ? [{ key: 'website', label: 'Visit website', icon: 'globe-outline' as IconName, onPress: () => void Linking.openURL(feed.link!) }]
      : []),
    { key: 'share', label: 'Share podcast', icon: 'share-outline' as IconName, onPress: share },
    ...(archived
      ? [
          {
            key: 'delete',
            label: 'Delete podcast',
            icon: 'trash-outline' as IconName,
            destructive: true,
            onPress: () =>
              showDialog(`Delete ${feed.title}?`, 'Its episodes, your progress, and any downloads are removed from this device.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await deleteFeed(feed.id);
                    router.back();
                  },
                },
              ]),
          },
        ]
      : []),
    ...(preview
      ? []
      : [
          ...(inboxIds.length > 0
            ? [
                {
                  key: 'inbox',
                  label: 'Remove all from inbox',
                  icon: 'checkmark-done-outline' as IconName,
                  onPress: () => void removeAllFromInbox(),
                },
              ]
            : []),
          {
            key: 'played',
            label: 'Mark all as played',
            icon: 'checkmark-done-circle-outline' as IconName,
            onPress: () =>
              showDialog('Mark all as played?', `All ${feed.episode_count} episodes.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Mark all', onPress: () => void markFeedPlayed(feed.id) },
              ]),
          },
          {
            key: 'unsubscribe',
            label: 'Unsubscribe',
            icon: 'trash-outline' as IconName,
            destructive: true,
            onPress: confirmUnsubscribe,
          },
        ]),
  ];

  return (
    <>
      <Stack.Screen
        options={{
          title: feed.title,
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => setSearch((value) => (value === null ? '' : null))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={search === null ? 'Search this podcast' : 'Close search'}
              >
                <Ionicons name={search === null ? 'search' : 'close'} size={22} color={theme.text} />
              </Pressable>
              <OverflowMenu title={feed.title} items={menu} />
            </View>
          ),
        }}
      />

      {/* Until every stored episode is loaded, the pager uses the podcast's full list instead. */}
      <EpisodeList ids={moreStored ? null : episodes.map((episode) => episode.id)}>
        <FlatList
          data={episodes}
          keyExtractor={(episode) => String(episode.id)}
          extraData={selection.selected}
          contentContainerStyle={{ paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : dockPadding }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={theme.accent} />}
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
                    {feed.episode_count} episodes{preview ? '' : ` · ${feed.unplayed_count} unplayed`}
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

              {preview ? (
                <View style={styles.previewBlock}>
                  <Pressable
                    onPress={() => void subscribeNow()}
                    disabled={subscribing}
                    style={[styles.subscribe, { backgroundColor: theme.accent, opacity: subscribing ? 0.6 : 1 }]}
                    accessibilityRole="button"
                  >
                    <Ionicons name="add" size={20} color={theme.onAccent} />
                    <Text style={[styles.subscribeLabel, { color: theme.onAccent }]}>
                      {subscribing ? 'Subscribing…' : archived ? 'Subscribe again' : 'Subscribe'}
                    </Text>
                  </Pressable>
                  <Text style={[styles.previewNote, { color: theme.textFaint }]}>
                    {archived
                      ? "Archived. It isn't refreshed and stays out of your Library; your episodes and progress are kept."
                      : 'Previewing. You can play episodes now; the podcast joins your library when you subscribe.'}
                  </Text>
                </View>
              ) : (
                <View style={styles.actions}>
                  <Chip style={styles.chip} icon="information-circle-outline" label="Info" onPress={() => router.push(`/feed/info/${feed.id}`)} />
                  <Chip
                    style={styles.chip}
                    icon={filtered ? 'funnel' : 'funnel-outline'}
                    label="Filter"
                    active={filtered}
                    onPress={() => setSheet('filter')}
                  />
                  <Chip style={styles.chip} icon="settings-outline" label="Settings" onPress={() => router.push(`/feed/settings/${feed.id}`)} />
                </View>
              )}

              {!preview && feed.last_refresh_error ? (
                <Banner
                  icon="warning-outline"
                  tone="danger"
                  text={`Last refresh failed: ${feed.last_refresh_error}`}
                  action={{ label: 'Retry', onPress: () => void refresh() }}
                />
              ) : null}
              {!preview && feed.keep_updated === 0 ? (
                <Banner
                  icon="pause-circle-outline"
                  text="Automatic updates are off for this podcast."
                  action={{ label: 'Turn on', onPress: () => void setFeedFlags(feed.id, { keepUpdated: true }) }}
                />
              ) : null}
              {filtered ? (
                <Banner
                  icon="funnel-outline"
                  text={`Filtered: ${describeFilter(filter)}`}
                  action={{ label: 'Clear', onPress: () => void setFeedViewPrefs(feed.id, { episodeFilter: null }) }}
                />
              ) : null}

              {search !== null ? (
                <View style={[styles.search, { backgroundColor: theme.surfaceAlt }]}>
                  <Ionicons name="search" size={16} color={theme.textMuted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    autoFocus
                    placeholder="Search this podcast"
                    placeholderTextColor={theme.textFaint}
                    style={[styles.searchInput, { color: theme.text }]}
                    returnKeyType="search"
                    accessibilityLabel="Search this podcast"
                  />
                </View>
              ) : null}
            </View>
          }
          onEndReached={showMoreStored}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            !episodesLoading && !moreStored && !term && !filtered && feed.next_page_url ? (
              // Paged feeds (RFC 5005) only ship their newest page; older
              // episodes are fetched on request, like AntennaPod's load-more footer.
              <Pressable
                onPress={() => void loadOlder()}
                disabled={loadingOlder}
                style={[styles.loadOlder, { borderColor: theme.border }]}
                accessibilityRole="button"
              >
                <Ionicons name="time-outline" size={16} color={theme.accent} />
                <Text style={[styles.chipLabel, { color: theme.accent }]}>
                  {loadingOlder ? 'Loading older episodes…' : 'Load older episodes'}
                </Text>
              </Pressable>
            ) : undefined
          }
          ListEmptyComponent={
            episodesLoading ? undefined : filtered || term ? (
              <EmptyState
                icon="filter-outline"
                title="No matching episodes"
                message={term ? `No episodes match “${term}”.` : 'None of the episodes match the filter.'}
                action={
                  filtered
                    ? { label: 'Clear filter', onPress: () => void setFeedViewPrefs(feed.id, { episodeFilter: undefined }) }
                    : { label: 'Search all podcasts', onPress: () => router.push({ pathname: '/search', params: { q: term } }) }
                }
              />
            ) : undefined
          }
          renderItem={({ item }) => (
            <EpisodeRow
              episode={item}
              onPlay={play}
              hideFeedTitle
              actionHooks={actionHooks}
              selecting={selection.active}
              selected={selection.selected.has(item.id)}
              onToggleSelect={selection.toggle}
              onSelectRange={selection.openRangeMenu}
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
      </EpisodeList>
      <SelectionBar selection={selection} />
      <MiniPlayerDock hidden={selection.active} />

      <FeedFilterSheet
        visible={sheet === 'filter'}
        subtitle="Saved for this podcast"
        value={filterRaw}
        onChange={(value) => void setFeedViewPrefs(feed.id, { episodeFilter: value })}
        onClose={() => setSheet(null)}
      />
      <ActionSheet
        visible={sheet === 'sort'}
        title="Sort episodes"
        subtitle="Saved for this podcast"
        items={EPISODE_SORT_KEYS.map((key) => ({
          key,
          label: EPISODE_SORT_LABELS[key],
          icon: key.startsWith('date') ? 'calendar-outline' : key.startsWith('duration') ? 'time-outline' : 'text-outline',
          selected: key === sort,
          onPress: () => void setFeedViewPrefs(feed.id, { episodeSort: key }),
        }))}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

/** AntennaPod's podcast-page status banners: refresh failed, updates off, filtered. */
function Banner({
  icon,
  text,
  action,
  tone = 'muted',
}: {
  icon: IconName;
  text: string;
  action: { label: string; onPress: () => void };
  tone?: 'muted' | 'danger';
}) {
  const theme = useTheme();
  const color = tone === 'danger' ? theme.danger : theme.textMuted;
  return (
    <View style={[styles.banner, { backgroundColor: theme.surfaceAlt }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.bannerText, { color }]} numberOfLines={3}>
        {text}
      </Text>
      <Pressable onPress={action.onPress} hitSlop={8} accessibilityRole="button">
        <Text style={[styles.bannerAction, { color: theme.accent }]}>{action.label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
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
  previewBlock: {
    gap: space.sm,
  },
  subscribe: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  subscribeLabel: {
    ...typography.subheading,
  },
  previewNote: {
    ...typography.caption,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chip: {
    flex: 1,
    paddingHorizontal: 0,
    paddingVertical: space.sm,
  },
  chipLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
  },
  bannerText: {
    ...typography.caption,
    flex: 1,
  },
  bannerAction: {
    ...typography.label,
    fontWeight: '700',
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  searchInput: {
    ...typography.body,
    flex: 1,
    paddingVertical: space.sm,
  },
  loadOlder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginTop: space.md,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
