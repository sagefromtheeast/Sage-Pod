import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePlayerState } from '@/player';

import { useGlassEffects } from './glass';
import { MiniPlayer } from './MiniPlayer';
import { MINI_PLAYER_HEIGHT, space } from './theme';
import { useTheme } from './useTheme';

/**
 * The mini player on pushed screens (podcast, episode, lists), where there is
 * no tab bar to carry it, as AntennaPod keeps its player bar on every screen.
 * Render it last in the screen; it floats over the bottom of the content.
 */
export function MiniPlayerDock({ hidden = false }: { hidden?: boolean }) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const glass = useGlassEffects();
  const hasEpisode = usePlayerState().episode !== null;
  if (hidden || !hasEpisode) return null;
  if (!glass) {
    // Docked to the bottom edge, solid down through the gesture area.
    return (
      <View
        style={[
          styles.dock,
          styles.solid,
          { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom },
        ]}
      >
        <MiniPlayer />
      </View>
    );
  }
  return (
    <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.sm) }]} pointerEvents="box-none">
      <MiniPlayer />
    </View>
  );
}

/** Bottom padding that lets a screen's last row scroll clear of the dock. */
export function useMiniPlayerDockPadding(): number {
  const insets = useSafeAreaInsets();
  return MINI_PLAYER_HEIGHT + space.xl + Math.max(insets.bottom, space.sm);
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  solid: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
