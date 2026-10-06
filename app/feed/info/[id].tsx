import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Stack, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getFeed, getFeedStats, type FeedStats } from '@/db/feeds';
import type { FeedWithCounts } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import type { FundingLink } from '@/feed/parser';
import { formatBytes } from '@/player/downloads';
import { Artwork } from '@/ui/Artwork';
import type { IconName } from '@/ui/ActionSheet';
import { MiniPlayerDock, useMiniPlayerDockPadding } from '@/ui/MiniPlayerDock';
import { radius, space, type as typography } from '@/ui/theme';
import { showToast } from '@/ui/UndoToast';
import { useTheme } from '@/ui/useTheme';
import { parseShowNotes } from '@/util/notes';
import { formatPublishDate } from '@/util/time';

const open = (url: string) => void WebBrowser.openBrowserAsync(url).catch(() => undefined);

function parseFunding(raw: string | null): FundingLink[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    return Array.isArray(value) ? value.filter((link) => typeof link?.url === 'string') : [];
  } catch {
    return [];
  }
}

/** "12 h 5 min", "40 min", "0 min". */
function formatListened(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}

/**
 * The podcast's info page (AntennaPod's feed info): statistics, ways to
 * support it, the full description and the feed's details.
 */
export default function FeedInfoScreen() {
  const theme = useTheme();
  const dockPadding = useMiniPlayerDockPadding();
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);

  const { data: feed } = useQuery<FeedWithCounts | null>(() => getFeed(feedId), ['feeds'], [feedId]);
  const { data: stats } = useQuery<FeedStats>(() => getFeedStats(feedId), ['episodes', 'playback_history'], [feedId]);
  const about = useMemo(() => parseShowNotes(feed?.description, null), [feed?.description]);

  if (!feed) return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  const funding = parseFunding(feed.funding);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Podcast info' }} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: dockPadding }]}>
        <View style={styles.header}>
          <Artwork uri={feed.image_url} size={120} />
          <View style={styles.headerMeta}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={3}>
              {feed.title}
            </Text>
            {feed.author ? <Text style={[styles.author, { color: theme.textMuted }]}>{feed.author}</Text> : null}
          </View>
        </View>

        {stats ? (
          <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Stat label="Episodes" value={String(stats.total)} />
            <Stat label="Played" value={String(stats.played)} />
            <Stat label="Listened" value={formatListened(stats.listenedSeconds)} />
            <Stat
              label="Downloaded"
              value={stats.downloaded > 0 ? `${stats.downloaded} · ${formatBytes(stats.downloadedBytes)}` : 'None'}
            />
            <Stat label="First episode" value={formatPublishDate(stats.firstPublished) || '—'} />
            <Stat label="Latest episode" value={formatPublishDate(stats.latestPublished) || '—'} />
          </View>
        ) : null}

        {funding.length > 0 ? (
          <Section title="Support this podcast">
            {funding.map((link) => (
              <Row key={link.url} icon="heart-outline" label={link.label} detail={link.url} onPress={() => open(link.url)} />
            ))}
          </Section>
        ) : null}

        {about.length > 0 ? (
          <Section title="About">
            <Text style={[styles.body, { color: theme.textMuted }]}>
              {about.map((segment, index) =>
                segment.type === 'link' ? (
                  <Text
                    key={index}
                    onPress={() => open(segment.url)}
                    style={[styles.link, { color: theme.accent }]}
                    accessibilityRole="link"
                  >
                    {segment.label}
                  </Text>
                ) : segment.type === 'timestamp' ? (
                  segment.raw
                ) : (
                  segment.value
                )
              )}
            </Text>
          </Section>
        ) : null}

        <Section title="Details">
          {feed.link ? <Row icon="globe-outline" label="Website" detail={feed.link} onPress={() => open(feed.link!)} /> : null}
          <Row
            icon="logo-rss"
            label="Feed address"
            detail={feed.feed_url}
            onPress={() => {
              void Clipboard.setStringAsync(feed.feed_url);
              showToast('Feed address copied');
            }}
            hint="Tap to copy"
          />
          {feed.language ? <Row icon="language-outline" label="Language" detail={feed.language} /> : null}
          <Row
            icon="refresh-outline"
            label="Last refreshed"
            detail={feed.last_refreshed_at ? formatPublishDate(feed.last_refreshed_at) : 'Never'}
          />
        </Section>
      </ScrollView>
      <MiniPlayerDock />
    </View>
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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textMuted }]} accessibilityRole="header">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function Row({
  icon,
  label,
  detail,
  onPress,
  hint,
}: {
  icon: IconName;
  label: string;
  detail: string;
  onPress?: () => void;
  hint?: string;
}) {
  const theme = useTheme();
  const body = (
    <>
      <Ionicons name={icon} size={20} color={theme.textMuted} />
      <View style={styles.rowText}>
        <Text style={[styles.rowLabel, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.rowDetail, { color: onPress ? theme.accent : theme.textFaint }]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
    </>
  );
  if (!onPress) return <View style={styles.row}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityHint={hint}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: space.lg,
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
    lineHeight: 22,
  },
  link: {
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...typography.body,
  },
  rowDetail: {
    ...typography.caption,
  },
});
