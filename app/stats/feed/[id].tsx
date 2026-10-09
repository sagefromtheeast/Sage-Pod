import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { getFeed, getFeedStats, type FeedStats } from '@/db/feeds';
import { useSetting } from '@/db/settings';
import { getListenRows, getPublishDates, getStatsResetAt } from '@/db/stats';
import type { FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { formatBytes } from '@/player/downloads';
import { formatListenTime, isoDay, monthInitial, rangeBounds, totalsByMonth, type ListenRow } from '@/stats/aggregate';
import { formatReleaseSchedule, guessReleaseSchedule } from '@/stats/releaseSchedule';
import { Artwork } from '@/ui/Artwork';
import { BarChart } from '@/ui/stats/charts';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Detail = { stats: FeedStats; rows: ListenRow[]; dates: number[] };

/** One podcast's numbers (AntennaPod's feed statistics dialog), with its release schedule. */
export default function FeedStatisticsScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);
  const includeMarkedPlayed = useSetting('statsIncludeMarkedPlayed');

  const { data: feed } = useQuery<FeedWithCounts | null>(() => getFeed(feedId), ['feeds'], [feedId]);
  const { data } = useQuery<Detail>(
    async () => {
      const resetAt = await getStatsResetAt();
      const since = resetAt === null ? null : isoDay(resetAt);
      const [stats, rows, dates] = await Promise.all([
        getFeedStats(feedId),
        getListenRows({ ...rangeBounds('all', Date.now(), since), includeMarkedPlayed, resetAt, feedId }),
        getPublishDates(feedId),
      ]);
      return { stats, rows, dates };
    },
    ['episodes', 'playback_history', 'settings'],
    [feedId, includeMarkedPlayed]
  );

  if (!data) return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  const { stats, rows, dates } = data;
  const played = rows.reduce((sum, row) => sum + row.seconds, 0);
  const months = totalsByMonth(rows, isoDay(Date.now()).slice(0, 7));

  return (
    <ScrollView style={{ backgroundColor: theme.bg }} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Podcast statistics' }} />
      <View style={styles.header}>
        <Artwork uri={feed?.image_url ?? null} size={72} />
        <View style={styles.headerMeta}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
            {feed?.custom_title || feed?.title || 'Removed podcast'}
          </Text>
          {feed?.author ? <Text style={[styles.author, { color: theme.textMuted }]}>{feed.author}</Text> : null}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Stat label="Time played" value={formatListenTime(played)} />
        <Stat label="Total length" value={formatListenTime(stats.totalDuration)} />
        <Stat label="Episodes" value={String(stats.total)} />
        <Stat label="Started" value={String(stats.started)} />
        <Stat label="Played" value={String(stats.played)} />
        <Stat
          label="Downloaded"
          value={stats.downloaded > 0 ? `${stats.downloaded} · ${formatBytes(stats.downloadedBytes)}` : 'None'}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>RELEASE SCHEDULE</Text>
        <Text style={[styles.body, { color: theme.text }]}>{formatReleaseSchedule(guessReleaseSchedule(dates))}</Text>
        <Text style={[styles.caption, { color: theme.textFaint }]}>A guess from the latest episodes' dates.</Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>LAST 12 MONTHS</Text>
        <View style={[styles.card, styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <BarChart
            bars={months.map((m) => ({ key: m.month, label: monthInitial(m.month), value: m.seconds }))}
            height={110}
            accessibilityLabel={`Listening per month: ${months.map((m) => formatListenTime(m.seconds)).join(', ')}`}
          />
        </View>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: theme.text }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: theme.textFaint }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: MINI_PLAYER_HEIGHT + space.xxl,
    gap: space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  headerMeta: {
    flex: 1,
    gap: space.xs,
  },
  title: {
    ...typography.heading,
  },
  author: {
    ...typography.label,
  },
  card: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    rowGap: space.md,
  },
  chartCard: {
    flexDirection: 'column',
  },
  stat: {
    width: '50%',
    paddingHorizontal: space.sm,
    gap: 2,
  },
  statValue: {
    ...typography.subheading,
  },
  statLabel: {
    ...typography.caption,
  },
  section: {
    gap: space.sm,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  body: {
    ...typography.body,
  },
  caption: {
    ...typography.caption,
  },
});
