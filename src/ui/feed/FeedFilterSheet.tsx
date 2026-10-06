import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setFeedViewPrefs } from '@/db/feeds';
import {
  FILTER_FACETS,
  isFiltered,
  parseEpisodeFilter,
  serializeEpisodeFilter,
  toggleFacet,
} from '@/feed/episodeFilter';
import { BottomSheet } from '@/ui/ActionSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  visible: boolean;
  feedId: number;
  /** The saved filter string (feeds.episode_filter). */
  value: string | null;
  onClose: () => void;
};

/**
 * AntennaPod's podcast filter: pairs of opposites (played / unplayed, …).
 * Tap a side to show only those episodes, tap it again to stop filtering on
 * that pair. Saved per podcast, applied as you tap.
 */
export function FeedFilterSheet({ visible, feedId, value, onClose }: Props) {
  const theme = useTheme();
  const filter = parseEpisodeFilter(value);
  const save = (next: typeof filter) =>
    void setFeedViewPrefs(feedId, { episodeFilter: serializeEpisodeFilter(next) });

  return (
    <BottomSheet visible={visible} title="Filter episodes" subtitle="Saved for this podcast" onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        {FILTER_FACETS.map(({ facet, yes, no }) => (
          <View key={facet} style={styles.row}>
            {([
              [true, yes],
              [false, no],
            ] as const).map(([include, label]) => {
              const selected = filter[facet] === include;
              return (
                <Pressable
                  key={label}
                  onPress={() => save(toggleFacet(filter, facet, include))}
                  style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.surfaceAlt }]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                >
                  <Text style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.text }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}
        <Pressable
          onPress={() => save({})}
          disabled={!isFiltered(filter)}
          style={[styles.clear, { opacity: isFiltered(filter) ? 1 : 0.4 }]}
          accessibilityRole="button"
        >
          <Text style={[styles.clearLabel, { color: theme.accent }]}>Clear filter</Text>
        </Pressable>
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
    gap: space.sm,
  },
  chip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  clear: {
    alignSelf: 'center',
    paddingVertical: space.sm,
  },
  clearLabel: {
    ...typography.label,
    fontWeight: '600',
  },
});
