import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { EpisodeWithFeed } from '@/db/types';
import { useEpisodePlayback } from '@/player';
import { formatDuration, formatPublishDate, formatRemaining } from '@/util/time';

import { Artwork } from './Artwork';
import { ProgressBar } from './ProgressBar';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

const ARTWORK_SIZE = 56;

type Props = {
  episode: EpisodeWithFeed;
  /** Called when the play control is tapped. */
  onPlay: (episode: EpisodeWithFeed) => void;
  /** Optional trailing control (queue toggle, download, drag handle). */
  trailing?: React.ReactNode;
  /** Hide the podcast name — redundant inside a single podcast's episode list. */
  hideFeedTitle?: boolean;
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
}: Props) {
  const theme = useTheme();
  const router = useRouter();

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
  const isPlayingThis = playing;

  return (
    <Pressable
      onPress={() => router.push(`/episode/${episode.id}`)}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: pressed ? theme.surfaceAlt : 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${episode.title}, ${episode.feed_title}`}
    >
      <Artwork uri={artwork} size={ARTWORK_SIZE} />

      <View style={styles.body}>
        {!hideFeedTitle ? (
          <Text style={[styles.feed, { color: theme.textMuted }]} numberOfLines={1}>
            {episode.feed_title}
          </Text>
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
            <Ionicons name="arrow-down-circle" size={13} color={theme.accent} />
          ) : null}
          {episode.is_favorite ? (
            <Ionicons name="heart" size={13} color={theme.danger} />
          ) : null}
        </View>

        {started ? (
          <View style={styles.progress}>
            <ProgressBar progress={progress} />
          </View>
        ) : null}
      </View>

      <View style={styles.controls}>
        <Pressable
          onPress={() => onPlay(episode)}
          hitSlop={8}
          style={[styles.playButton, { backgroundColor: theme.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={isPlayingThis ? 'Pause' : 'Play'}
        >
          <Ionicons
            name={isPlayingThis ? 'pause' : 'play'}
            size={16}
            color={theme.accent}
            // The play glyph's visual centre sits left of its bounding box.
            style={isPlayingThis ? undefined : styles.playGlyph}
          />
        </Pressable>
        {trailing}
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
  title: {
    ...typography.body,
    fontWeight: '600',
    lineHeight: 20,
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
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: {
    marginLeft: 2,
  },
});
