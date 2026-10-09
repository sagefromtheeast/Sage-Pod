import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import {
  getDownloadStats,
  getListenRows,
  getStatsFeeds,
  getStatsReset,
  resetStatistics,
  type StatsFeed,
} from '@/db/stats';
import { useQuery } from '@/db/useQuery';
import { formatBytes } from '@/player/downloads';
import {
  donutSlices,
  formatListenTime,
  localDay,
  monthInitial,
  parseStatsRange,
  rangeBounds,
  STATS_RANGE_LABELS,
  STATS_RANGES,
  totalsByFeed,
  totalsByMonth,
  totalsByYear,
  type Slice,
  type StatsRange,
} from '@/stats/aggregate';
import { ActionSheet } from '@/ui/ActionSheet';
import { Artwork } from '@/ui/Artwork';
import { Chip } from '@/ui/Chip';
import { EmptyState } from '@/ui/EmptyState';
import { triggerHaptic } from '@/ui/haptics';
import { OverflowMenu } from '@/ui/OverflowMenu';
import { SegmentedTabs } from '@/ui/SegmentedTabs';
import { BarChart, DonutChart, ShareBar, useSliceColor } from '@/ui/stats/charts';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';

type Tab = 'subscriptions' | 'years' | 'downloads';

const TABS = [
  { key: 'subscriptions', label: 'Subscriptions' },
  { key: 'years', label: 'Years' },
  { key: 'downloads', label: 'Downloads' },
] as const;

const parseTab = (raw: string | undefined): Tab => (TABS.some((t) => t.key === raw) ? (raw as Tab) : 'subscriptions');

type StatsData = {
  feeds: Map<number, StatsFeed>;
  /** Listening within the chosen range (Subscriptions). */
  ranged: Awaited<ReturnType<typeof getListenRows>>;
  /** All listening since the last reset (Years). */
  allTime: Awaited<ReturnType<typeof getListenRows>>;
  downloads: Awaited<ReturnType<typeof getDownloadStats>>;
};

/**
 * AntennaPod's Statistics: time per podcast (with a date range and "include
 * marked played"), time per month and year, and space used by downloads.
 */
export default function StatisticsScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(parseTab(params.tab));
  const range = parseStatsRange(useSetting('statsRange'));
  const includeMarkedPlayed = useSetting('statsIncludeMarkedPlayed');

  const { data } = useQuery<StatsData>(
    async () => {
      const reset = await getStatsReset();
      const bounds = rangeBounds(range, Date.now());
      const [feeds, allTime, downloads] = await Promise.all([
        getStatsFeeds(),
        getListenRows({ from: null, to: null, includeMarkedPlayed, reset }),
        getDownloadStats(),
      ]);
      // "All time" is the same query as the Years tab's; don't run it twice.
      const ranged = range === 'all' ? allTime : await getListenRows({ ...bounds, includeMarkedPlayed, reset });
      return { feeds, ranged, allTime, downloads };
    },
    ['playback_history', 'episodes', 'feeds', 'settings'],
    [range, includeMarkedPlayed]
  );

  const confirmReset = () => {
    Alert.alert(
      'Reset statistics?',
      'Statistics start again from now. Podcasts, episodes, played states and listening history are kept.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            await resetStatistics();
            showToast('Statistics reset');
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <OverflowMenu
              items={[
                {
                  key: 'reset',
                  label: 'Reset statistics',
                  icon: 'refresh-outline',
                  destructive: true,
                  onPress: confirmReset,
                },
              ]}
            />
          ),
        }}
      />
      <SegmentedTabs tabs={TABS} selected={tab} onSelect={setTab} style={styles.segments} />
      <ScrollView contentContainerStyle={styles.content}>
        {!data ? null : tab === 'subscriptions' ? (
          <SubscriptionsTab data={data} range={range} includeMarkedPlayed={includeMarkedPlayed} />
        ) : tab === 'years' ? (
          <YearsTab data={data} />
        ) : (
          <DownloadsTab data={data} />
        )}
      </ScrollView>
    </View>
  );
}

function SubscriptionsTab({
  data,
  range,
  includeMarkedPlayed,
}: {
  data: StatsData;
  range: StatsRange;
  includeMarkedPlayed: boolean;
}) {
  const theme = useTheme();
  const [choosingRange, setChoosingRange] = useState(false);
  const totals = totalsByFeed(data.ranged);
  const total = totals.reduce((sum, t) => sum + t.seconds, 0);
  const slices = donutSlices(totals.map((t) => ({ key: t.feedId, value: t.seconds })));

  return (
    <>
      <View style={styles.filters}>
        <Chip
          icon="calendar-outline"
          label={STATS_RANGE_LABELS[range]}
          onPress={() => setChoosingRange(true)}
          accessibilityLabel={`Date range: ${STATS_RANGE_LABELS[range]}`}
        />
        <Chip
          icon={includeMarkedPlayed ? 'checkmark-circle' : 'ellipse-outline'}
          label="Include marked played"
          active={includeMarkedPlayed}
          onPress={() => {
            triggerHaptic('selection');
            void setSetting('statsIncludeMarkedPlayed', !includeMarkedPlayed);
          }}
        />
      </View>
      <ActionSheet
        visible={choosingRange}
        title="Date range"
        items={STATS_RANGES.map((option) => ({
          key: option,
          label: STATS_RANGE_LABELS[option],
          icon: 'calendar-outline',
          selected: option === range,
          onPress: () => void setSetting('statsRange', option),
        }))}
        onClose={() => setChoosingRange(false)}
      />
      <View style={styles.chart}>
        <DonutChart slices={slices} value={formatListenTime(total)} caption="listened" />
      </View>
      {totals.length === 0 ? (
        <EmptyState
          icon="bar-chart-outline"
          title="No listening yet"
          message={
            range === 'all'
              ? 'Time spent listening shows up here, podcast by podcast.'
              : 'Nothing was played in this date range.'
          }
        />
      ) : (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {totals.map((t) => (
            <FeedRow
              key={t.feedId}
              feedId={t.feedId}
              feed={data.feeds.get(t.feedId)}
              detail={formatListenTime(t.seconds)}
              share={t.seconds / totals[0].seconds}
              slices={slices}
            />
          ))}
        </View>
      )}
      {includeMarkedPlayed ? (
        <Text style={[styles.note, { color: theme.textFaint }]}>
          Played episodes count in full: any part not heard in Sage Pod is added on the day the episode was last played.
        </Text>
      ) : null}
    </>
  );
}

function YearsTab({ data }: { data: StatsData }) {
  const theme = useTheme();
  const months = totalsByMonth(data.allTime, localDay(Date.now()).slice(0, 7));
  const years = totalsByYear(data.allTime);
  const best = Math.max(1, ...years.map((y) => y.seconds));

  if (years.length === 0) {
    return (
      <EmptyState
        icon="calendar-outline"
        title="No listening yet"
        message="Listening time per month and year shows up here."
      />
    );
  }
  return (
    <>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>LAST 12 MONTHS</Text>
      <View style={[styles.card, styles.chartCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <BarChart
          bars={months.map((m) => ({ key: m.month, label: monthInitial(m.month), value: m.seconds }))}
          accessibilityLabel={`Listening per month: ${months.map((m) => formatListenTime(m.seconds)).join(', ')}`}
        />
      </View>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>BY YEAR</Text>
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {years.map((y) => (
          <View key={y.year} style={styles.yearRow}>
            <View style={styles.rowHead}>
              <Text style={[styles.rowTitle, { color: theme.text }]}>{y.year}</Text>
              <Text style={[styles.rowDetail, { color: theme.textMuted }]}>{formatListenTime(y.seconds)}</Text>
            </View>
            <ShareBar share={y.seconds / best} color={theme.accent} />
          </View>
        ))}
      </View>
    </>
  );
}

function DownloadsTab({ data }: { data: StatsData }) {
  const theme = useTheme();
  const total = data.downloads.reduce((sum, d) => sum + d.bytes, 0);
  const count = data.downloads.reduce((sum, d) => sum + d.count, 0);
  const slices = donutSlices(data.downloads.map((d) => ({ key: d.feedId, value: d.bytes })));

  return (
    <>
      <View style={styles.chart}>
        <DonutChart
          slices={slices}
          value={formatBytes(total)}
          caption={`${count} ${count === 1 ? 'episode' : 'episodes'}`}
        />
      </View>
      {data.downloads.length === 0 ? (
        <EmptyState icon="download-outline" title="No downloads" message="Space used by downloads shows up here." />
      ) : (
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          {data.downloads.map((d) => (
            <FeedRow
              key={d.feedId}
              feedId={d.feedId}
              feed={data.feeds.get(d.feedId)}
              detail={formatBytes(d.bytes)}
              subtitle={`${d.count} ${d.count === 1 ? 'episode' : 'episodes'}`}
              share={d.bytes / Math.max(1, data.downloads[0].bytes)}
              slices={slices}
            />
          ))}
        </View>
      )}
    </>
  );
}

/** A podcast's line in a tab: its colour from the chart, a share bar, and a tap to its own numbers. */
function FeedRow({
  feedId,
  feed,
  detail,
  subtitle,
  share,
  slices,
}: {
  feedId: number;
  feed: StatsFeed | undefined;
  detail: string;
  subtitle?: string;
  share: number;
  slices: readonly Slice<number>[];
}) {
  const theme = useTheme();
  const router = useRouter();
  const colorFor = useSliceColor();
  const index = slices.findIndex((slice) => slice.key === feedId);
  const { color, opacity } = index >= 0 ? colorFor(feedId, index) : colorFor('other', slices.length - 1);
  const title = feed?.title ?? 'Removed podcast';

  return (
    <Pressable
      onPress={() => router.push(`/stats/feed/${feedId}`)}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${detail}`}
      accessibilityHint="Shows this podcast's statistics"
    >
      <Artwork uri={feed?.image_url ?? null} size={44} />
      <View style={styles.rowBody}>
        <View style={styles.rowHead}>
          <View style={[styles.dot, { backgroundColor: color, opacity }]} />
          <Text style={[styles.rowTitle, { color: theme.text }]} numberOfLines={1}>
            {title}
          </Text>
          <Text style={[styles.rowDetail, { color: theme.textMuted }]}>{detail}</Text>
        </View>
        {subtitle ? <Text style={[styles.rowSubtitle, { color: theme.textFaint }]}>{subtitle}</Text> : null}
        <ShareBar share={share} color={color} opacity={opacity} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  segments: {
    marginHorizontal: space.lg,
    marginTop: space.md,
  },
  content: {
    padding: space.lg,
    paddingBottom: MINI_PLAYER_HEIGHT + space.xxl,
    gap: space.md,
  },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs,
  },
  chart: {
    alignItems: 'center',
    paddingVertical: space.md,
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
  },
  chartCard: {
    paddingVertical: space.md,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowTitle: {
    ...typography.body,
    flex: 1,
  },
  rowDetail: {
    ...typography.caption,
    fontVariant: ['tabular-nums'],
  },
  rowSubtitle: {
    ...typography.caption,
  },
  yearRow: {
    gap: 6,
    paddingVertical: space.sm,
  },
  note: {
    ...typography.caption,
    lineHeight: 17,
  },
});
