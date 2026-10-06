import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SheetItem = {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  /** Shows a check mark, for single-choice lists (e.g. skip amounts). */
  selected?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  /** Bold first line, e.g. the episode title. */
  title?: string;
  /** Muted second line, e.g. the podcast name. */
  subtitle?: string;
  items: readonly SheetItem[];
  onClose: () => void;
};

type SheetProps = {
  visible: boolean;
  /** Bold first line, e.g. the episode title. */
  title?: string;
  /** Muted second line, e.g. the podcast name. */
  subtitle?: string;
  onClose: () => void;
  /** Runs once the sheet has fully gone (see ActionSheet for why that matters). */
  onDismissed?: () => void;
  children: React.ReactNode;
};

/**
 * The bottom sheet every menu and picker shares: a scrim, a grabber, an
 * optional title, and whatever content the caller puts inside.
 */
export function BottomSheet({ visible, title, subtitle, onClose, onDismissed, children }: SheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const dismissed = useRef(onDismissed);
  dismissed.current = onDismissed;

  // iOS reports the end of the dismissal through onDismiss; elsewhere the
  // modal is gone as soon as it re-renders hidden.
  useEffect(() => {
    if (!visible && Platform.OS !== 'ios') dismissed.current?.();
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={Platform.OS === 'ios' ? () => dismissed.current?.() : undefined}
    >
      <Pressable
        style={[styles.backdrop, { backgroundColor: theme.scrim }]}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
      />
      <View style={styles.dock} pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: insets.bottom + space.sm,
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: theme.border }]} />
          {title ? (
            <View style={styles.header}>
              <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
          ) : null}
          {children}
        </View>
      </View>
    </Modal>
  );
}

/**
 * A bottom sheet of actions — the long-press menu and the ⋯ overflow menus.
 *
 * Selecting an item closes the sheet and runs the item only once the sheet
 * has gone: on iOS an Alert or share sheet presented while a modal is still
 * dismissing can fail to appear.
 */
export function ActionSheet({ visible, title, subtitle, items, onClose }: Props) {
  const theme = useTheme();
  const pending = useRef<(() => void) | null>(null);

  const runPending = () => {
    const run = pending.current;
    pending.current = null;
    run?.();
  };

  return (
    <BottomSheet visible={visible} title={title} subtitle={subtitle} onClose={onClose} onDismissed={runPending}>
      <ScrollView bounces={false}>
        {items.map((item) => {
          const color = item.destructive ? theme.danger : theme.text;
          return (
            <Pressable
              key={item.key}
              onPress={() => {
                pending.current = item.onPress;
                onClose();
              }}
              style={({ pressed }) => [
                styles.item,
                { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
              ]}
              accessibilityRole="button"
              accessibilityState={item.selected !== undefined ? { selected: item.selected } : undefined}
            >
              <Ionicons name={item.icon} size={20} color={item.destructive ? theme.danger : theme.textMuted} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
              {item.selected ? <Ionicons name="checkmark" size={20} color={theme.accent} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  backdrop: StyleSheet.absoluteFill,
  /** Full-width bottom dock that centres the sheet, so tablets get a sheet, not a slab. */
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    maxHeight: '80%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: space.sm,
    width: '100%',
    maxWidth: 640,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.pill,
    marginBottom: space.sm,
  },
  header: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: 2,
  },
  title: {
    ...typography.subheading,
  },
  subtitle: {
    ...typography.label,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.xl,
    paddingVertical: space.md + 2,
  },
  label: {
    ...typography.body,
    flex: 1,
  },
});
