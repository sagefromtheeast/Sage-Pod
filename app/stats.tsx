import { Stack } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { getListeningStats, type StatRow } from '@/db/stats';
import { useQuery } from '@/db/useQuery';
import { Artwork } from '@/ui/Artwork';
import { space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

export default function StatsScreen() {
  const theme = useTheme();
  
  const { data: stats = [] } = useQuery<StatRow[]>(
    () => getListeningStats(),
    ['episodes'] // Re-run when episodes change (since playback history is updated alongside)
  );

  const totalSeconds = stats.reduce((acc, row) => acc + row.total_seconds, 0);

  const formatHours = (seconds: number) => {
    return (seconds / 3600).toFixed(1);
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Listening Stats' }} />
      
      <View style={styles.header}>
        <Text style={[styles.totalNumber, { color: theme.accent }]}>{formatHours(totalSeconds)}</Text>
        <Text style={[styles.totalLabel, { color: theme.textMuted }]}>hours listened</Text>
      </View>

      <FlatList
        data={stats}
        keyExtractor={(item) => String(item.feed_id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Artwork uri={item.feed_image_url} size={48} />
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {item.feed_title}
            </Text>
            <Text style={[styles.time, { color: theme.textMuted }]}>
              {formatHours(item.total_seconds)}h
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: space.xxl,
  },
  totalNumber: {
    fontSize: 48,
    fontWeight: '800',
  },
  totalLabel: {
    ...typography.subheading,
    marginTop: space.xs,
  },
  list: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  title: {
    ...typography.body,
    flex: 1,
  },
  time: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
});
