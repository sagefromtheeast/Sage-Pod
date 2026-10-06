import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export type SheetItem = {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
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

/**
 * A bottom sheet of actions — the long-press menu and the ⋯ overflow menus.
 *
 * Selecting an item closes the sheet first, then runs it, so an item that
 * opens another dialog (share sheet, confirmation) doesn't stack on top.
 */
export function ActionSheet({ visible, title, subtitle, items, onClose }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
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
          <ScrollView bounces={false}>
            {items.map((item) => {
              const color = item.destructive ? theme.danger : theme.text;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => {
                    onClose();
                    item.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
                  ]}
                  accessibilityRole="button"
                >
                  <Ionicons name={item.icon} size={20} color={item.destructive ? theme.danger : theme.textMuted} />
                  <Text style={[styles.label, { color }]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  },
});
