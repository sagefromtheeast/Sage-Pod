import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import {
  isLibraryFiltered,
  LIBRARY_COLUMNS,
  LIBRARY_COUNTERS,
  LIBRARY_FACETS,
  parseCounter,
  parseLibraryFilter,
  serializeLibraryFilter,
  toggleLibraryFacet,
} from '@/library/libraryView';
import { BottomSheet } from '@/ui/ActionSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type SheetProps = { visible: boolean; onClose: () => void };

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.surfaceAlt }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * AntennaPod's Subscriptions display options: layout, columns, titles and
 * the number on each tile. Saved, applied as you tap.
 */
export function LibraryDisplaySheet({ visible, onClose }: SheetProps) {
  const theme = useTheme();
  const view = useSetting('libraryView');
  const columns = useSetting('libraryColumns');
  const showTitles = useSetting('libraryShowTitles');
  const counter = parseCounter(useSetting('libraryCounter'));

  return (
    <BottomSheet visible={visible} title="Display" onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        <Text style={[styles.heading, { color: theme.textMuted }]}>LAYOUT</Text>
        <View style={styles.row}>
          <Chip label="Grid" selected={view !== 'list'} onPress={() => void setSetting('libraryView', 'grid')} />
          <Chip label="List" selected={view === 'list'} onPress={() => void setSetting('libraryView', 'list')} />
        </View>

        {view !== 'list' ? (
          <>
            <Text style={[styles.heading, { color: theme.textMuted }]}>COLUMNS</Text>
            <View style={styles.row}>
              {LIBRARY_COLUMNS.map((count) => (
                <Chip
                  key={count}
                  label={count === 0 ? 'Auto' : String(count)}
                  selected={columns === count}
                  onPress={() => void setSetting('libraryColumns', count)}
                />
              ))}
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.label, { color: theme.text }]}>Show titles</Text>
              <Switch
                value={showTitles}
                onValueChange={(value) => void setSetting('libraryShowTitles', value)}
                trackColor={{ true: theme.accent, false: theme.surfaceAlt }}
                accessibilityLabel="Show titles"
              />
            </View>
          </>
        ) : null}

        <Text style={[styles.heading, { color: theme.textMuted }]}>NUMBER ON EACH PODCAST</Text>
        {LIBRARY_COUNTERS.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => void setSetting('libraryCounter', option.key)}
            style={styles.option}
            accessibilityRole="radio"
            accessibilityState={{ selected: counter === option.key }}
          >
            <Text style={[styles.label, { color: theme.text }]}>{option.label}</Text>
            {counter === option.key ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}

/** AntennaPod's subscription filter: pairs of opposites, saved, applied as you tap. */
export function LibraryFilterSheet({ visible, onClose }: SheetProps) {
  const theme = useTheme();
  const filter = parseLibraryFilter(useSetting('libraryFilter'));
  const save = (next: typeof filter) => void setSetting('libraryFilter', serializeLibraryFilter(next));

  return (
    <BottomSheet visible={visible} title="Filter podcasts" subtitle="Saved for the Library" onClose={onClose}>
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        {LIBRARY_FACETS.map(({ facet, yes, no }) => (
          <View key={facet} style={styles.row}>
            {(
              [
                [true, yes],
                [false, no],
              ] as const
            ).map(([include, label]) => {
              const selected = filter[facet] === include;
              return (
                <Pressable
                  key={label}
                  onPress={() => save(toggleLibraryFacet(filter, facet, include))}
                  style={[styles.pair, { backgroundColor: selected ? theme.accent : theme.surfaceAlt }]}
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
          disabled={!isLibraryFiltered(filter)}
          style={[styles.clear, { opacity: isLibraryFiltered(filter) ? 1 : 0.4 }]}
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
  heading: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: space.xs,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  pair: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.xs,
  },
  label: {
    ...typography.body,
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
