import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { space, type as typography } from './theme';
import { useTheme } from './useTheme';

/**
 * "Nothing here matches" for a screen's own search, with a way to widen it to
 * the whole library (the local search screen, words carried over).
 */
export function NoMatches({ message, term }: { message: string; term: string }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Text style={[styles.message, { color: theme.textMuted }]}>{message}</Text>
      {term.trim() ? (
        <Pressable
          onPress={() => router.push({ pathname: '/search', params: { q: term.trim() } })}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text style={[styles.link, { color: theme.accent }]}>Search all podcasts</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
  },
  message: {
    ...typography.body,
    textAlign: 'center',
  },
  link: {
    ...typography.label,
    fontWeight: '600',
  },
});
