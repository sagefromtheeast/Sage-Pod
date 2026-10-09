import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';

import { runEpisodeAction } from '@/actions/runEpisodeAction';
import { deleteDownloadByUser } from '@/actions/deleteDownloads';
import { startDownloads } from '@/actions/startDownloads';
import { listActiveDownloads, listDownloaded } from '@/db/episodes';
import { setSetting, useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player } from '@/player';
import { cancelDownload, formatBytes } from '@/player/downloads';
import {
  DOWNLOAD_SORTS,
  matchesDownloadSearch,
  parseDownloadSort,
  playedToDelete,
  sizeOf,
  sortDownloads,
} from '@/player/downloadView';
import { ActionSheet } from '@/ui/ActionSheet';
import { DownloadLogSheet } from '@/ui/downloads/DownloadLogSheet';
import { EmptyState } from '@/ui/EmptyState';
import { EpisodeRow } from '@/ui/EpisodeRow';
import { SwipeableEpisodeRow } from '@/ui/SwipeableEpisodeRow';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { NoMatches } from '@/ui/NoMatches';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SELECTION_BAR_HEIGHT, SelectionBar } from '@/ui/SelectionBar';
import { radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useEpisodeSelection } from '@/ui/useEpisodeSelection';
import { useTheme } from '@/ui/useTheme';

type Section = { key: 'active' | 'done'; title: string; data: EpisodeWithFeed[] };

/**
 * AntennaPod's Downloads screen: downloads waiting, running or failed at the
 * top, finished ones below in a saved order. Search, "Delete played", the
 * download log, and long-press to select several.
 */
export default function DownloadsScreen() {
  const theme = useTheme();
  const dockPadding = useMiniPlayerDockPadding();
  const sort = parseDownloadSort(useSetting('downloadsSort'));
  const [sheet, setSheet] = useState<'sort' | 'log' | null>(null);
  const [search, setSearch] = useState<string | null>(null);
  const term = search?.trim() ?? '';

  const { data: active = [] } = useQuery<EpisodeWithFeed[]>(() => listActiveDownloads(), ['episodes', 'feeds']);
  const { data: done = [], loading } = useQuery<EpisodeWithFeed[]>(() => listDownloaded(), ['episodes', 'feeds']);

  const finished = useMemo(
    () => sortDownloads(term ? done.filter((episode) => matchesDownloadSearch(episode, term)) : done, sort),
    [done, sort, term]
  );
  const running = useMemo(
    () => (term ? active.filter((episode) => matchesDownloadSearch(episode, term)) : active),
    [active, term]
  );
  const totalBytes = done.reduce((sum, episode) => sum + sizeOf(episode), 0);

  const selection = useEpisodeSelection(finished);
  const actionHooks = useMemo(() => ({ onMultiSelect: selection.start }), [selection.start]);

  const play = useCallback((episode: EpisodeWithFeed) => {
    const current = player.getState();
    if (current.episode?.id === episode.id) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, []);

  const deletePlayed = () => {
    const targets = playedToDelete(done);
    if (targets.length === 0) {
      showToast('No played downloads to delete');
      return;
    }
    const bytes = targets.reduce((sum, episode) => sum + sizeOf(episode), 0);
    Alert.alert(
      `Delete ${targets.length} played download${targets.length === 1 ? '' : 's'}?`,
      `Frees ${formatBytes(bytes)}. Favourites are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            let deleted = 0;
            try {
              for (const episode of targets) {
                await deleteDownloadByUser(episode.id);
                deleted += 1;
              }
              showToast(`${deleted} download${deleted === 1 ? '' : 's'} deleted`);
            } catch (error) {
              showToast(
                `Deleted ${deleted} of ${targets.length}: ${error instanceof Error ? error.message : String(error)}`
              );
            }
          },
        },
      ]
    );
  };

  const sections: Section[] = [
    ...(running.length > 0 ? [{ key: 'active' as const, title: 'IN PROGRESS', data: running }] : []),
    ...(finished.length > 0 || running.length > 0
      ? [{ key: 'done' as const, title: `DOWNLOADED · ${term ? `${finished.length} of ` : ''}${done.length} · ${formatBytes(totalBytes)}`, data: finished }]
      : []),
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen
        options={{
          title: 'Downloads',
          headerRight: () => (
            <View style={styles.headerButtons}>
              <Pressable
                onPress={() => setSearch((value) => (value === null ? '' : null))}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={search === null ? 'Search downloads' : 'Close search'}
              >
                <Ionicons name={search === null ? 'search' : 'close'} size={22} color={theme.text} />
              </Pressable>
              <OverflowMenu
                title="Downloads"
                items={[
                  { key: 'sort', label: 'Sort…', icon: 'swap-vertical', onPress: () => setSheet('sort') },
                  { key: 'played', label: 'Delete played…', icon: 'trash-outline', destructive: true, onPress: deletePlayed },
                  { key: 'log', label: 'Download log', icon: 'document-text-outline', onPress: () => setSheet('log') },
                ]}
              />
            </View>
          ),
        }}
      />

      {search !== null ? (
        <View style={[styles.search, { backgroundColor: theme.surfaceAlt }]}>
          <Ionicons name="search" size={16} color={theme.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            autoFocus
            placeholder="Search downloads"
            placeholderTextColor={theme.textFaint}
            style={[styles.searchInput, { color: theme.text }]}
            returnKeyType="search"
            accessibilityLabel="Search downloads"
          />
        </View>
      ) : null}

      <SectionList
        sections={sections}
        keyExtractor={(episode) => String(episode.id)}
        extraData={selection.selected}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={{ paddingBottom: selection.active ? SELECTION_BAR_HEIGHT + space.xl : dockPadding }}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.heading, { color: theme.textMuted }]}>{section.title}</Text>
        )}
        ListEmptyComponent={
          loading ? null : term ? (
            <NoMatches message={`No downloads match “${term}”.`} term={term} />
          ) : (
            <EmptyState
              icon="arrow-down-circle-outline"
              title="No downloads"
              message="Downloaded episodes play without a connection and appear here."
            />
          )
        }
        renderItem={({ item, section }) =>
          section.key === 'active' ? (
            <EpisodeRow
              episode={item}
              onPlay={play}
              // Waiting or running: the row's own button cancels. A failed
              // download can be retried or dismissed.
              trailing={
                item.download_state === 'error' ? (
                  <View style={styles.failedActions}>
                    <Pressable
                      onPress={() => void startDownloads([item.id])}
                      hitSlop={8}
                      style={[styles.retry, { borderColor: theme.danger }]}
                      accessibilityRole="button"
                      accessibilityLabel="Retry download"
                    >
                      <Text style={[styles.retryLabel, { color: theme.danger }]}>Retry</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => void cancelDownload(item.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Dismiss failed download"
                    >
                      <Ionicons name="close" size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                ) : null
              }
            />
          ) : (
            <SwipeableEpisodeRow
              episode={item}
              screen="downloads"
              onPlay={play}
              swipeEnabled={!selection.active}
              actionHooks={actionHooks}
              selecting={selection.active}
              selected={selection.selected.has(item.id)}
              onToggleSelect={selection.toggle}
              onSelectRange={selection.openRangeMenu}
              trailing={
                <Pressable
                  // Same confirmed delete as the long-press menu.
                  onPress={() => void runEpisodeAction('delete', [item])}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Delete download"
                >
                  <Ionicons name="trash-outline" size={19} color={theme.textFaint} />
                </Pressable>
              }
            />
          )
        }
      />

      <SelectionBar selection={selection} />
      <MiniPlayerDock hidden={selection.active} />

      <ActionSheet
        visible={sheet === 'sort'}
        title="Sort downloads"
        items={DOWNLOAD_SORTS.map((option) => ({
          key: option.key,
          label: option.label,
          icon: 'swap-vertical',
          selected: option.key === sort,
          onPress: () => void setSetting('downloadsSort', option.key),
        }))}
        onClose={() => setSheet(null)}
      />
      <DownloadLogSheet visible={sheet === 'log'} onClose={() => setSheet(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerButtons: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
  },
  searchInput: { ...typography.body, flex: 1, paddingVertical: space.sm },
  heading: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.xs,
  },
  failedActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  retry: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  retryLabel: { ...typography.caption, fontWeight: '700' },
});
