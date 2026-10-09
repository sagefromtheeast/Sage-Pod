import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { MINI_PLAYER_HEIGHT, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** The scrolling body every Settings page shares. */
export function SettingsScreen({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      {children}
    </ScrollView>
  );
}

/** A muted paragraph under a group of rows. */
export function SettingsNote({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.note}>
      <Text style={[styles.noteText, { color: theme.textFaint }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: MINI_PLAYER_HEIGHT + space.xxl },
  note: { paddingHorizontal: space.lg, paddingVertical: space.md },
  noteText: { ...typography.caption, lineHeight: 17 },
});
