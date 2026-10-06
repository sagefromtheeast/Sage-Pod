import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { episodeActionsFor, needsBulkConfirm, subjectFor } from '@/actions/episodeActions';
import { ACTION_META, runEpisodeAction } from '@/actions/runEpisodeAction';
import { isQueuedNow } from '@/db/queueMembership';
import { player } from '@/player';

import { ActionSheet } from './ActionSheet';
import { radius, space, type as typography } from './theme';
import type { EpisodeSelection } from './useEpisodeSelection';
import { useTheme } from './useTheme';

type Props = {
  selection: EpisodeSelection;
  /** The Queue screen adds Move to top / bottom. */
  inQueue?: boolean;
};

/** Height to pad a list by so its last rows clear the bar. */
export const SELECTION_BAR_HEIGHT = 112;

/**
 * Bottom bar shown while episodes are selected (AntennaPod's floating select
 * menu): count, Select all, close, and every action that applies to at least
 * one selected episode. Running an action leaves selection mode.
 */
export function SelectionBar({ selection, inQueue = false }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  if (!selection.active) return null;

  const state = player.getState();
  const subjects = selection.selectedEpisodes.map((episode) =>
    subjectFor(episode, {
      queued: isQueuedNow(episode.id),
      playing: state.episode?.id === episode.id && state.playing,
    })
  );
  const actions = episodeActionsFor(subjects, { kind: 'selection', inQueue });
  const n = selection.selected.size;

  return (
    <>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + space.sm },
        ]}
      >
        <View style={styles.header}>
          <Pressable onPress={selection.clear} hitSlop={8} accessibilityRole="button" accessibilityLabel="Done selecting">
            <Ionicons name="close" size={22} color={theme.text} />
          </Pressable>
          <Text style={[styles.count, { color: theme.text }]}>{n === 1 ? '1 selected' : `${n} selected`}</Text>
          <Pressable onPress={selection.selectAll} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.link, { color: theme.accent }]}>Select all</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          {actions.map((action) => {
            const meta = ACTION_META[action];
            const color = meta.destructive ? theme.danger : theme.text;
            return (
              <Pressable
                key={action}
                onPress={() => {
                  const episodes = selection.selectedEpisodes;
                  const run = () => {
                    selection.clear();
                    void runEpisodeAction(action, episodes);
                  };
                  if (!needsBulkConfirm(action, episodes.length)) return run();
                  Alert.alert(`${meta.label}?`, `This applies to ${episodes.length} episodes.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: meta.label, style: meta.destructive ? 'destructive' : 'default', onPress: run },
                  ]);
                }}
                style={({ pressed }) => [
                  styles.action,
                  { backgroundColor: pressed ? theme.surfaceAlt : theme.bg, borderColor: theme.border },
                ]}
                accessibilityRole="button"
              >
                <Ionicons name={meta.icon} size={16} color={color} />
                <Text style={[styles.actionLabel, { color }]}>{meta.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ActionSheet
        visible={selection.rangeAnchor !== null}
        items={[
          { key: 'above', label: 'Select all above', icon: 'arrow-up', onPress: () => selection.selectRangeFromAnchor('above') },
          { key: 'below', label: 'Select all below', icon: 'arrow-down', onPress: () => selection.selectRangeFromAnchor('below') },
        ]}
        onClose={selection.closeRangeMenu}
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
