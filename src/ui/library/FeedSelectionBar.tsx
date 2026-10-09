import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  dismissManyFromInbox,
  getPlaybackSnapshots,
  listInboxIdsForFeeds,
  restorePlaybackSnapshots,
} from '@/db/episodes';
import { addTagToFeeds, setFeedPrefs, type FeedPrefs } from '@/db/feeds';
import type { LibraryFeed } from '@/db/types';
import { PLAYBACK_RATES } from '@/player';
import { ActionSheet, type IconName, type SheetItem } from '@/ui/ActionSheet';
import { TextPromptSheet } from '@/ui/TextPromptSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';

import { askToUnsubscribe } from './unsubscribe';

/** Height to pad the grid by so its last row clears the bar. */
export const FEED_SELECTION_BAR_HEIGHT = 112;

type Props = {
  selected: readonly LibraryFeed[];
  total: number;
  onSelectAll: () => void;
  onClose: () => void;
};

type Sheet = 'updated' | 'download' | 'delete' | 'speed' | 'tag' | null;

/**
 * AntennaPod's podcast multi-select actions, as Sage Pod's selection bar:
 * keep updated, auto-download, auto-delete, speed, add a tag, clear the
 * inbox, unsubscribe. Each applies to every selected podcast, then selection ends.
 */
export function FeedSelectionBar({ selected, total, onSelectAll, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [sheet, setSheet] = useState<Sheet>(null);
  const n = selected.length;
  const what = n === 1 ? '1 podcast' : `${n} podcasts`;

  const apply = async (prefs: Partial<FeedPrefs>, message: string) => {
    onClose();
    try {
      await setFeedPrefs(
        selected.map((feed) => feed.id),
        prefs
      );
      showToast(message);
    } catch (error) {
      showToast(`Couldn't change ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const triState = (key: 'autoDownload' | 'autoDelete', label: string): SheetItem[] => [
    { key: 'global', label: 'Follow the global setting', icon: 'globe-outline', onPress: () => void apply({ [key]: null }, `${label}: global for ${what}`) },
    { key: 'on', label: 'On', icon: 'checkmark-circle-outline', onPress: () => void apply({ [key]: true }, `${label} on for ${what}`) },
    { key: 'off', label: 'Off', icon: 'close-circle-outline', onPress: () => void apply({ [key]: false }, `${label} off for ${what}`) },
  ];

  const sheets: Record<Exclude<Sheet, 'tag' | null>, { title: string; items: SheetItem[] }> = {
    updated: {
      title: 'Keep updated',
      items: [
        { key: 'on', label: 'On', icon: 'checkmark-circle-outline', onPress: () => void apply({ keepUpdated: true }, `Updates on for ${what}`) },
        { key: 'off', label: 'Off', icon: 'pause-circle-outline', onPress: () => void apply({ keepUpdated: false }, `Updates off for ${what}`) },
      ],
    },
    download: { title: 'Auto-download', items: triState('autoDownload', 'Auto-download') },
    delete: { title: 'Auto-delete', items: triState('autoDelete', 'Auto-delete') },
    speed: {
      title: 'Playback speed',
      items: [
        { key: 'global', label: 'Follow the global speed', icon: 'globe-outline', onPress: () => void apply({ playbackSpeed: null }, `Global speed for ${what}`) },
        ...PLAYBACK_RATES.map((rate) => ({
          key: String(rate),
          label: `${rate}×`,
          icon: 'speedometer-outline' as IconName,
          onPress: () => void apply({ playbackSpeed: rate }, `${rate}× for ${what}`),
        })),
      ],
    },
  };

  const clearInbox = async () => {
    const ids = await listInboxIdsForFeeds(selected.map((feed) => feed.id));
    onClose();
    if (ids.length === 0) {
      showToast('Nothing in the inbox from these podcasts');
      return;
    }
    const saved = await getPlaybackSnapshots(ids);
    await dismissManyFromInbox(ids);
    showToast(ids.length === 1 ? 'Removed from inbox' : `${ids.length} episodes removed from inbox`, () =>
      restorePlaybackSnapshots(saved, ['is_new'])
    );
  };

  const actions: { key: string; label: string; icon: IconName; destructive?: boolean; onPress: () => void }[] = [
    { key: 'updated', label: 'Keep updated', icon: 'refresh-circle-outline', onPress: () => setSheet('updated') },
    { key: 'download', label: 'Auto-download', icon: 'cloud-download-outline', onPress: () => setSheet('download') },
    { key: 'delete', label: 'Auto-delete', icon: 'trash-bin-outline', onPress: () => setSheet('delete') },
    { key: 'speed', label: 'Speed', icon: 'speedometer-outline', onPress: () => setSheet('speed') },
    { key: 'tag', label: 'Add tag', icon: 'pricetag-outline', onPress: () => setSheet('tag') },
    { key: 'inbox', label: 'Remove from inbox', icon: 'checkmark-done-outline', onPress: () => void clearInbox() },
    {
      key: 'unsubscribe',
      label: 'Unsubscribe',
      icon: 'remove-circle-outline',
      destructive: true,
      onPress: () => askToUnsubscribe(selected, onClose),
    },
  ];

  const open = sheet && sheet !== 'tag' ? sheets[sheet] : null;

  return (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + space.sm },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done selecting">
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.count, { color: theme.text }]}>{n === 1 ? '1 selected' : `${n} selected`}</Text>
          {n < total ? (
            <Pressable onPress={onSelectAll} hitSlop={8} accessibilityRole="button">
              <Text style={[styles.link, { color: theme.accent }]}>Select all</Text>
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {actions.map((action) => {
            const color = action.destructive ? theme.danger : theme.text;
            return (
              <Pressable
                key={action.key}
                onPress={action.onPress}
                disabled={n === 0}
                style={({ pressed }) => [
                  styles.action,
                  {
                    backgroundColor: pressed ? theme.surfaceAlt : theme.bg,
                    borderColor: theme.border,
                    opacity: n === 0 ? 0.5 : 1,
                  },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name={action.icon} size={16} color={color} />
                <Text style={[styles.actionLabel, { color }]}>{action.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ActionSheet
        visible={open !== null}
        title={open?.title}
        subtitle={what}
        items={open?.items ?? []}
        onClose={() => setSheet(null)}
      />
      <TextPromptSheet
        visible={sheet === 'tag'}
        title="Add tag"
        subtitle={what}
        placeholder="e.g. News"
        confirmLabel="Add tag"
        onSubmit={(tag) => {
          const ids = selected.map((feed) => feed.id);
          onClose();
          addTagToFeeds(ids, tag).then(
            () => showToast(`Tagged ${what} “${tag}”`),
            (error: unknown) => showToast(`Couldn't add the tag: ${error instanceof Error ? error.message : String(error)}`)
          );
        }}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: space.md,
    gap: space.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
  },
  count: {
    ...typography.subheading,
    flex: 1,
  },
  link: {
    ...typography.label,
    fontWeight: '700',
  },
  actions: {
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: {
    ...typography.label,
  },
});
