import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { createStore, useStore } from '@/util/store';

import {
  buttonLayout,
  createDialogQueue,
  dismissButton,
  type DialogButton,
  type DialogOptions,
  type DialogRequest,
} from './dialogModel';
import { triggerHaptic } from './haptics';
import { radius, space, type as typography, type Palette } from './theme';
import { useTheme } from './useTheme';

export type { DialogButton, DialogOptions } from './dialogModel';

const queue = createDialogQueue();
const store = createStore<DialogRequest | null>(null);

/**
 * Sage Pod's own alert: same arguments as `Alert.alert`, drawn in the app's
 * colours instead of the system dialog. Destructive buttons are filled red,
 * the confirming button is filled green, Cancel is plain text; Back and a tap
 * outside run the Cancel button.
 */
export function showDialog(
  title: string,
  message?: string,
  buttons?: readonly DialogButton[],
  options?: DialogOptions
): void {
  queue.push(title, message, buttons, options);
  store.set(queue.current());
}

/** Resolves true when the confirming button is pressed, false on Cancel or dismissal. */
export function confirmDialog(opts: {
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    showDialog(opts.title, opts.message, [
      { text: opts.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: opts.confirmLabel, style: opts.destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]);
  });
}

function close(request: DialogRequest, button: DialogButton | null): void {
  queue.close(request.id);
  store.set(queue.current());
  if (button?.onPress) void Promise.resolve(button.onPress()).catch(() => {});
}

/** `#RRGGBB` with an alpha, for the tinted icon disc. */
function tint(hex: string, alpha: number): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return hex;
  const n = parseInt(match[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function buttonColors(button: DialogButton, last: boolean, theme: Palette) {
  if (button.style === 'destructive') {
    return { bg: theme.danger, fg: theme.scheme === 'light' ? '#FFFFFF' : '#2A0B0B' };
  }
  if (button.style === 'cancel' || !last) return { bg: 'transparent', fg: theme.text };
  return { bg: theme.accent, fg: theme.onAccent };
}

/** Mounted once, at the root, next to the toast host. */
export function DialogHost() {
  const theme = useTheme();
  const request = useStore(store);
  // Keep the last dialog on screen while the modal fades out.
  const [shown, setShown] = useState<DialogRequest | null>(request);
  useEffect(() => {
    if (request) setShown(request);
  }, [request]);

  useEffect(() => {
    if (request?.tone === 'danger') triggerHaptic('warning');
  }, [request]);

  const dialog = request ?? shown;
  if (!dialog) return null;

  const danger = dialog.tone === 'danger';
  const iconColor = danger ? theme.danger : theme.accent;
  const layout = buttonLayout(dialog.buttons);
  const onDismiss = () => {
    if (!request) return;
    if (!request.cancelable) return;
    // Back runs the Cancel button if there is one, then onDismiss, like Alert.
    close(request, dismissButton(request));
    request.onDismiss?.();
  };

  return (
    <Modal visible={request !== null} transparent animationType="fade" onRequestClose={onDismiss} statusBarTranslucent>
      <Pressable
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close dialog"
      />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          key={dialog.id}
          entering={ZoomIn.duration(170).withInitialValues({ transform: [{ scale: 0.94 }] })}
          style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}
          accessibilityRole="alert"
          accessibilityViewIsModal
        >
          <Animated.View entering={FadeIn.delay(60)} style={[styles.icon, { backgroundColor: tint(iconColor, 0.14) }]}>
            <Ionicons
              name={danger ? 'warning-outline' : 'information-circle-outline'}
              size={24}
              color={iconColor}
            />
          </Animated.View>
          <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header">
            {dialog.title}
          </Text>
          {dialog.message ? (
            <ScrollView style={styles.messageScroll} bounces={false}>
              <Text style={[styles.message, { color: theme.textMuted }]}>{dialog.message}</Text>
            </ScrollView>
          ) : null}
          <View style={layout === 'row' ? styles.row : styles.stack}>
            {(layout === 'stack' ? [...dialog.buttons].reverse() : dialog.buttons).map((button, index, all) => {
              const isConfirm = layout === 'stack' ? index === 0 : index === all.length - 1;
              const { bg, fg } = buttonColors(button, isConfirm, theme);
              const outlined = bg === 'transparent' && button.style !== 'cancel';
              return (
                <Pressable
                  key={`${index}-${button.text}`}
                  onPress={() => request && close(request, button)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.button,
                    layout === 'row' && styles.rowButton,
                    {
                      backgroundColor: bg,
                      borderColor: outlined ? theme.border : 'transparent',
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.buttonText, { color: fg }]} numberOfLines={1}>
                    {button.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.xl,
    paddingTop: space.xl,
    paddingBottom: space.lg,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.md,
  },
  title: {
    ...typography.heading,
    marginBottom: space.sm,
  },
  messageScroll: {
    maxHeight: 280,
  },
  message: {
    ...typography.body,
    lineHeight: 21,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.sm,
    marginTop: space.xl,
  },
  stack: {
    gap: space.sm,
    marginTop: space.xl,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButton: {
    minWidth: 96,
  },
  buttonText: {
    ...typography.subheading,
    fontSize: 15,
  },
});
