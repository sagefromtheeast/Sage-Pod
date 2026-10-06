import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { rowButtonFor, subjectFor, type RowButton } from '@/actions/episodeActions';
import type { ActionHooks } from '@/actions/runEpisodeAction';
import { markPlayed } from '@/db/episodes';
import { useIsQueued } from '@/db/queueMembership';
import { useSetting } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { useEpisodePlayback } from '@/player';
import { cancelDownload, formatBytes, queueDownload, useDownloadProgress } from '@/player/downloads';
import { formatDuration, formatPublishDate, formatRemaining } from '@/util/time';

import { Artwork } from './Artwork';
import { openEpisodeActions } from './EpisodeActionsHost';
import { ProgressBar } from './ProgressBar';
import { ProgressRing } from './ProgressRing';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

const ARTWORK_SIZE = 56;
const BUTTON_SIZE = 36;

const BUTTON_META: Record<RowButton, { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }> = {
  pause: { icon: 'pause', label: 'Pause' },
  play: { icon: 'play', label: 'Play' },
  stream: { icon: 'play', label: 'Stream' },
  cancel: { icon: 'close', label: 'Cancel download' },
  download: { icon: 'arrow-down', label: 'Download' },
  markPlayed: { icon: 'checkmark', label: 'Mark as played' },
};


type Props = {
  episode: EpisodeWithFeed;
  /** Called when the play control is tapped. */
  onPlay: (episode: EpisodeWithFeed) => void;
  /** Optional trailing control (queue toggle, download, drag handle). */
  trailing?: React.ReactNode;
  /** Hide the podcast name — redundant inside a single podcast's episode list. */
  hideFeedTitle?: boolean;
  /** Passed to the long-press menu; `onMultiSelect` adds "Select multiple". */
  actionHooks?: ActionHooks;
  /** Selection mode (screens with multi-select). Primitives + stable callbacks keep memo effective. */
  selecting?: boolean;
  selected?: boolean;
  onToggleSelect?: (episodeId: number) => void;
  /** Long-press while selecting: "select all above / below". */
  onSelectRange?: (episodeId: number) => void;
};

function formatEpisodeBadge(
  season: number | null | undefined,
  episodeNumber: number | null | undefined
): string | null {
  if (season && episodeNumber) return `S${season} · E${episodeNumber}`;
  if (episodeNumber) return `Ep. ${episodeNumber}`;
  if (season) return `Season ${season}`;
  return null;
}

/**
 * One episode in a list.
 *
 * Memoised because the queue and inbox screens re-render on every player tick
 * (twice a second), and re-rendering fifty rows at that rate is the difference
 * between a smooth scroll and a janky one.
 */
export const EpisodeRow = memo(function EpisodeRow({
  episode,
  onPlay,
  trailing,
  hideFeedTitle = false,
  actionHooks,
  selecting = false,
  selected = false,
  onToggleSelect,
  onSelectRange,
}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const queued = useIsQueued(episode.id);
  const download = useDownloadProgress(
    episode.download_state === 'downloading' || episode.download_state === 'queued' ? episode.id : null
  );

  // Scoped subscription: this row re-renders on player ticks only while it is
  // the episode being played.
  const { isCurrent, playing, position: livePosition } = useEpisodePlayback(episode.id);

  // While this episode is loaded, follow the live player position so the row's
  // progress bar and "time left" track playback rather than the last save.
  const position = isCurrent ? livePosition : episode.position;
  const duration = episode.duration ?? 0;
  const progress = duration > 0 ? position / duration : 0;
  const started = position > 30 && !episode.is_played;

  const artwork = episode.image_url ?? episode.feed_image_url;
  const preferStreaming = useSetting('streamOverDownload');
  const button = rowButtonFor(subjectFor(episode, { queued, playing: isCurrent && playing }), preferStreaming);

  const pressButton = () => {
    switch (button) {
      case 'pause':
      case 'play':
      case 'stream':
        onPlay(episode);
        return;
      case 'cancel':
        void cancelDownload(episode.id);
        return;
      case 'download':
        void queueDownload(episode.id);
        return;
      case 'markPlayed':
        void markPlayed(episode.id, true);
        return;
    }
  };

  return (
    <Pressable
      onPress={() =>
        selecting ? onToggleSelect?.(episode.id) : router.push(`/episode/${episode.id}`)
      }
      onLongPress={() =>
        selecting ? onSelectRange?.(episode.id) : openEpisodeActions(episode, actionHooks)
      }
      delayLongPress={350}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: pressed
            ? theme.surfaceAlt
            : selected
              ? theme.surfaceAlt
              : isCurrent
                ? theme.accentSoft
                : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={selecting ? { selected } : undefined}
      accessibilityLabel={`${episode.title}, ${episode.feed_title}`}
      accessibilityHint={selecting ? undefined : 'Long-press for more actions'}
    >
      <Artwork uri={artwork} size={ARTWORK_SIZE} />

      <View style={styles.body}>
        {!hideFeedTitle ? (
          <Text style={[styles.feed, { color: theme.textMuted }]} numberOfLines={1}>
            {episode.feed_title}
          </Text>
        ) : null}

        <View style={styles.titleRow}>
          {episode.is_new ? (
            <View
              style={[styles.newDot, { backgroundColor: theme.accent }]}
              accessibilityLabel="New"
            />
          ) : null}
          <Text
            style={[
              styles.title,
              { color: episode.is_played ? theme.textMuted : theme.text },
            ]}
            numberOfLines={2}
          >
            {episode.title}
          </Text>
        </View>

        <View style={styles.meta}>
          {formatEpisodeBadge(episode.season, episode.episode_number) ? (
            <>
              <View style={[styles.episodeBadge, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={[styles.episodeBadgeText, { color: theme.textMuted }]}>
                  {formatEpisodeBadge(episode.season, episode.episode_number)}
                </Text>
              </View>
              <Text style={[styles.metaText, { color: theme.textFaint }]}>·</Text>
            </>
          ) : null}
          <Text style={[styles.metaText, { color: theme.textFaint }]}>
            {formatPublishDate(episode.published_at)}
          </Text>
          <Text style={[styles.metaText, { color: theme.textFaint }]}>·</Text>
          <Text style={[styles.metaText, { color: theme.textFaint }]}>
            {episode.is_played
              ? 'Played'
              : started
                ? formatRemaining(duration - position)
                : formatDuration(duration)}
          </Text>

          {episode.download_state === 'done' ? (
            <View style={styles.downloadMeta}>
              <Ionicons name="arrow-down-circle" size={13} color={theme.accent} />
              {(episode.downloaded_bytes ?? episode.media_size) ? (
                <Text style={[styles.metaText, { color: theme.textFaint }]}>
                  {formatBytes(episode.downloaded_bytes ?? episode.media_size)}
                </Text>
              ) : null}
            </View>
          ) : episode.download_state === 'downloading' || episode.download_state === 'queued' ? (
            <View style={styles.downloadMeta}>
              <Ionicons name="arrow-down-circle-outline" size={13} color={theme.accent} />
              <Text style={[styles.metaText, { color: theme.accent }]}>
                {episode.download_state === 'downloading' ? 'Downloading' : 'Queued'}
              </Text>
            </View>
          ) : null}
          {episode.is_favorite ? (
            <Ionicons name="heart" size={13} color={theme.danger} />
          ) : null}
          {queued ? (
            <Ionicons name="list" size={13} color={theme.textMuted} accessibilityLabel="In queue" />
          ) : null}
        </View>

        {started ? (
          <View style={styles.progress}>
            <ProgressBar progress={progress} />
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        {selecting ? (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={26}
            color={selected ? theme.accent : theme.textFaint}
          />
        ) : (
          <>
            <Pressable
              onPress={pressButton}
              hitSlop={8}
              style={[styles.playButton, { backgroundColor: theme.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={BUTTON_META[button].label}
            >
              {button === 'cancel' ? (
                <ProgressRing
                  size={BUTTON_SIZE}
                  progress={download?.progress ?? null}
                  color={theme.accent}
                  trackColor={theme.track}
                />
              ) : null}
              <Ionicons
                name={BUTTON_META[button].icon}
                size={16}
                color={theme.accent}
                // The play glyph's visual centre sits left of its bounding box.
                style={BUTTON_META[button].icon === 'play' ? styles.playGlyph : undefined}
              />
            </Pressable>
            {trailing}
          </>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  feed: {
    ...typography.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.xs,
  },
  newDot: {
    width: 7,
    height: 7,
    borderRadius: radius.pill,
    marginTop: 7,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 20,
    flexShrink: 1,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: 2,
  },
  metaText: {
    ...typography.caption,
  },
  downloadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  episodeBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: radius.sm,
  },
  episodeBadgeText: {
    ...typography.caption,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  progress: {
    marginTop: space.xs,
  },
  controls: {
    alignItems: 'center',
    gap: space.sm,
  },
  playButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    marginLeft: 2,
  },
});
