import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStore, useStore } from '@/util/store';

import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * "Removed from queue · Undo" — one toast at a time, like AntennaPod's
 * snackbar. A new toast replaces the current one; each lasts ~5 s.
 */
type Toast = { id: number; message: string; onUndo?: () => void | Promise<void> };

const DURATION_MS = 5000;
/** Clears the tab bar and mini player so the toast never covers controls. */
const BOTTOM_CHROME = MINI_PLAYER_HEIGHT + 76;

const store = createStore<Toast | null>(null);
let nextId = 1;

/** Shows a toast, optionally with an Undo button. */
export function showToast(message: string, onUndo?: Toast['onUndo']): void {
  store.set({ id: nextId++, message, onUndo });
}

function dismiss(id: number): void {
  if (store.get()?.id === id) store.set(null);
}

/** Mounted once, at the root. */
export function UndoToastHost() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useStore(store);

  useEffect(() => {
    if (!toast) return;
    const handle = setTimeout(() => dismiss(toast.id), DURATION_MS);
    return () => clearTimeout(handle);
  }, [toast]);

  // The dock stays mounted so the toast can slide out as well as in.
  return (
    <View
      style={[styles.dock, { bottom: insets.bottom + BOTTOM_CHROME }]}
      pointerEvents="box-none"
    >
      {toast ? (
        <Animated.View
          key={toast.id}
          entering={FadeInDown.duration(200)}
          exiting={FadeOutDown.duration(160)}
          style={[styles.toast, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          <Text style={[styles.message, { color: theme.text }]} numberOfLines={2}>
            {toast.message}
          </Text>
          {toast.onUndo ? (
            <Pressable
              onPress={() => {
                dismiss(toast.id);
                void toast.onUndo?.();
              }}
              hitSlop={8}
              accessibilityRole="button"
            >
              <Text style={[styles.undo, { color: theme.accent }]}>Undo</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: space.lg,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    width: '100%',
    maxWidth: 560,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  message: {
    ...typography.label,
    flex: 1,
  },
  undo: {
    ...typography.label,
    fontWeight: '700',
  },
});
