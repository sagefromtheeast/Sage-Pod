import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import { sortQueueBy } from '@/db/queue';
import {
  canKeepSorted,
  parseQueueSort,
  serializeQueueSort,
  type QueueSort,
  type QueueSortKey,
} from '@/player/queueSorting';
import { BottomSheet } from '@/ui/ActionSheet';
import { triggerHaptic } from '@/ui/haptics';
import { SettingsSwitch } from '@/ui/SettingsRow';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Option = { label: string; descending: boolean };

/** AntennaPod's queue sort orders, plus Sage Pod's "time left"; each with its two directions. */
const ORDERS: { key: QueueSortKey; title: string; options: Option[] }[] = [
  {
    key: 'date',
    title: 'Date',
    options: [
      { label: 'Newest first', descending: true },
      { label: 'Oldest first', descending: false },
    ],
  },
  {
    key: 'duration',
    title: 'Duration',
    options: [
      { label: 'Shortest', descending: false },
      { label: 'Longest', descending: true },
    ],
  },
  {
    key: 'remaining',
    title: 'Time left',
    options: [
      { label: 'Least left', descending: false },
      { label: 'Most left', descending: true },
    ],
  },
  {
    key: 'episodeTitle',
    title: 'Episode title',
    options: [
      { label: 'A–Z', descending: false },
      { label: 'Z–A', descending: true },
    ],
  },
  {
    key: 'podcastTitle',
    title: 'Podcast',
    options: [
      { label: 'A–Z', descending: false },
      { label: 'Z–A', descending: true },
    ],
  },
  {
    key: 'smartShuffle',
    title: 'Smart shuffle',
    options: [
      { label: 'Oldest first', descending: false },
      { label: 'Newest first', descending: true },
    ],
  },
  { key: 'random', title: 'Random', options: [{ label: 'Shuffle', descending: false }] },
];

type Props = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Sorts the queue once, or keeps it sorted. With "Keep sorted" on, the chosen
 * order is reapplied whenever an episode is added, and dragging is turned off
 * because it would be undone.
 */
export function QueueSortSheet({ visible, onClose }: Props) {
  const theme = useTheme();
  const kept = parseQueueSort(useSetting('queueKeepSorted'));

  const choose = (sort: QueueSort) => {
    triggerHaptic('medium');
    void sortQueueBy(sort);
    if (kept) void setSetting('queueKeepSorted', canKeepSorted(sort) ? serializeQueueSort(sort) : '');
    onClose();
  };

  return (
    <BottomSheet visible={visible} title="Sort queue" onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        {ORDERS.map((order) => (
          <View key={order.key} style={styles.row}>
            <Text style={[styles.title, { color: theme.text }]}>{order.title}</Text>
            <View style={styles.options}>
              {order.options.map((option) => {
                const selected = kept?.key === order.key && kept.descending === option.descending;
                return (
                  <Pressable
                    key={option.label}
                    onPress={() => choose({ key: order.key, descending: option.descending })}
                    style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.surfaceAlt }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Sort by ${order.title.toLowerCase()}, ${option.label}`}
                    accessibilityState={{ selected }}
                  >
                    <Text style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.text }]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
        <SettingsSwitch
          label="Keep sorted"
          description={
            kept
              ? 'New episodes are slotted in by this order. Drag to reorder is off.'
              : 'Turn on, then pick an order to keep the queue in it as episodes are added.'
          }
          value={kept !== null}
          onValueChange={(on) => {
            // Turning it on keeps the queue oldest first until another order is picked.
            const sort: QueueSort = { key: 'date', descending: false };
            void setSetting('queueKeepSorted', on ? serializeQueueSort(sort) : '');
            if (on) void sortQueueBy(sort);
          }}
        />
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    ...typography.body,
    flexShrink: 1,
  },
  options: {
    flexDirection: 'row',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
    fontWeight: '600',
  },
});
