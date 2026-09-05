import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { getEpisode, markPlayed, toggleFavorite } from '@/db/episodes';
import { dequeue, enqueue, isQueued } from '@/db/queue';
import type { EpisodeWithFeed } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { player, useEpisodePlayback } from '@/player';
import {
  cancelDownload,
  deleteDownload,
  formatBytes,
  queueDownload,
  useDownloadProgress,
} from '@/player/downloads';
import { Artwork } from '@/ui/Artwork';
import { ProgressBar } from '@/ui/ProgressBar';
import { MINI_PLAYER_HEIGHT, radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { extractLinks, htmlToPlainText } from '@/util/html';
import { shareEpisode } from '@/util/share';
import { parseTimestamps } from '@/util/timestamps';
import { formatDuration, formatPublishDate } from '@/util/time';

export default function EpisodeScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const episodeId = Number(id);

  const { data: episode } = useQuery<EpisodeWithFeed | null>(
    () => getEpisode(episodeId),
    ['episodes', 'feeds'],
    [episodeId]
  );

  const { data: queued = false } = useQuery<boolean>(
    () => isQueued(episodeId),
    ['queue'],
    [episodeId]
  );

  const { isCurrent, playing, position: livePosition } = useEpisodePlayback(episodeId);

  const play = useCallback(() => {
    if (!episode) return;
    if (isCurrent) player.togglePlayPause();
    else void player.playEpisode(episode);
  }, [episode, isCurrent]);

  const seekToTimestamp = useCallback(
    (seconds: number) => {
      if (!episode) return;
      if (isCurrent) {
        void player.seekTo(seconds);
      } else {
        Alert.alert(
          'Play this episode?',
          `Jump to ${formatDuration(seconds)} and start listening to this episode.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Play',
              onPress: () => {
                void player.load(episode, { startAt: seconds, autoPlay: true });
              },
            },
          ]
        );
      }
    },
    [episode, isCurrent]
  );

  if (!episode) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const position = isCurrent ? livePosition : episode.position;
  const duration = episode.duration ?? 0;
  const progress = duration > 0 ? position / duration : 0;

  const notes = htmlToPlainText(episode.description);
  const links = extractLinks(episode.description);
  const downloading = episode.download_state === 'downloading' || episode.download_state === 'queued';
  const downloaded = episode.download_state === 'done';
  const downloadProgress = useDownloadProgress(episode.id);

  return (
    <>
      <Stack.Screen options={{ title: '' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => router.push(`/feed/${episode.feed_id}`)}
          style={styles.header}
          accessibilityRole="button"
        >
          <Artwork uri={episode.image_url ?? episode.feed_image_url} size={88} />
          <View style={styles.headerMeta}>
            <Text style={[styles.feedTitle, { color: theme.accent }]} numberOfLines={2}>
              {episode.feed_title}
            </Text>
            <Text style={[styles.meta, { color: theme.textFaint }]}>
              {[formatPublishDate(episode.published_at), formatDuration(duration)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </Pressable>

        <Text style={[styles.title, { color: theme.text }]}>{episode.title}</Text>

        {position > 30 && !episode.is_played ? (
          <View style={styles.progressBlock}>
            <ProgressBar progress={progress} height={4} />
            <Text style={[styles.meta, { color: theme.textFaint }]}>
              {formatDuration(position)} of {formatDuration(duration)}
            </Text>
          </View>
        ) : null}

        <Pressable
          onPress={play}
          style={({ pressed }) => [
            styles.playButton,
            { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Ionicons name={playing ? 'pause' : 'play'} size={20} color={theme.onAccent} />
          <Text style={[styles.playLabel, { color: theme.onAccent }]}>
            {playing ? 'Pause' : position > 30 && !episode.is_played ? 'Resume' : 'Play'}
          </Text>
        </Pressable>

        <View style={styles.actionRow}>
          <IconAction
            icon={queued ? 'remove-circle' : 'add-circle-outline'}
            label={queued ? 'In queue' : 'Queue'}
            active={queued}
            onPress={() => void (queued ? dequeue(episode.id) : enqueue(episode.id))}
          />
          <IconAction
            icon={downloaded ? 'trash-outline' : downloading ? 'close-circle' : 'arrow-down-circle-outline'}
            label={downloaded ? 'Delete' : downloading ? 'Cancel' : 'Download'}
            active={downloaded}
            onPress={() => {
              if (downloaded) void deleteDownload(episode.id);
              else if (downloading) void cancelDownload(episode.id);
              else void queueDownload(episode.id);
            }}
          />
          <IconAction
            icon={episode.is_favorite ? 'heart' : 'heart-outline'}
            label="Favourite"
            active={episode.is_favorite === 1}
            onPress={() => void toggleFavorite(episode.id)}
          />
          <IconAction
            icon={episode.is_played ? 'checkmark-circle' : 'checkmark-circle-outline'}
            label={episode.is_played ? 'Played' : 'Mark played'}
            active={episode.is_played === 1}
            onPress={() => void markPlayed(episode.id, episode.is_played !== 1)}
          />
          <IconAction
            icon="share-outline"
            label="Share"
            onPress={() =>
              void shareEpisode({
                title: episode.title,
                podcastTitle: episode.feed_title,
                url: episode.link ?? episode.media_url,
                positionSeconds: position,
              })
            }
          />
        </View>

        {downloading ? (
          <View style={styles.downloadProgressBlock}>
            <View style={styles.downloadProgressMeta}>
              <Text style={[styles.downloadProgressLabel, { color: theme.textMuted }]}>
                {downloadProgress?.progress != null
                  ? `Downloading ${(downloadProgress.progress * 100).toFixed(0)}%`
                  : 'Downloading…'}
              </Text>
              {downloadProgress?.bytesWritten ? (
                <Text style={[styles.downloadProgressBytes, { color: theme.textFaint }]}>
                  {formatBytes(downloadProgress.bytesWritten)}
                  {downloadProgress.totalBytes ? ` / ${formatBytes(downloadProgress.totalBytes)}` : ''}
                </Text>
              ) : null}
            </View>
            <ProgressBar progress={downloadProgress?.progress ?? 0} height={4} />
          </View>
        ) : null}

        {episode.download_state === 'error' ? (
          <Text style={[styles.error, { color: theme.danger }]}>
            The download failed. Tap download to try again.
          </Text>
        ) : null}

        {notes ? (
          <View style={styles.notes}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Show notes</Text>
            <Text style={[styles.notesBody, { color: theme.textMuted }]}>
              {parseTimestamps(notes).map((segment, index) =>
                segment.type === 'text' ? (
                  segment.value
                ) : (
                  <Text
                    key={index}
                    onPress={() => seekToTimestamp(segment.seconds)}
                    style={{ color: theme.accent, fontWeight: '600' }}
                  >
                    {segment.raw}
                  </Text>
                )
              )}
            </Text>
          </View>
        ) : null}

        {links.length > 0 ? (
          <View style={styles.notes}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Links</Text>
            {links.map((link) => (
              <Pressable
                key={link.url}
                onPress={() =>
                  WebBrowser.openBrowserAsync(link.url).catch(() =>
                    Alert.alert('Could not open link', link.url)
                  )
                }
                style={styles.link}
                accessibilityRole="link"
              >
                <Ionicons name="open-outline" size={15} color={theme.accent} />
                <Text style={[styles.linkLabel, { color: theme.accent }]} numberOfLines={2}>
                  {link.label}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  active = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  active?: boolean;
}) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.iconAction, { opacity: pressed ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={icon} size={24} color={active ? theme.accent : theme.textMuted} />
      <Text style={[styles.iconLabel, { color: active ? theme.accent : theme.textFaint }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    paddingBottom: MINI_PLAYER_HEIGHT + space.xxl,
    gap: space.lg,
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
  feedTitle: {
    ...typography.label,
    fontWeight: '600',
  },
  meta: {
    ...typography.caption,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    lineHeight: 30,
  },
  progressBlock: {
    gap: space.xs,
  },
  playButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    borderRadius: radius.pill,
  },
  playLabel: {
    ...typography.subheading,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  iconAction: {
    alignItems: 'center',
    gap: space.xs,
    flex: 1,
  },
  iconLabel: {
    ...typography.caption,
    fontSize: 11,
    textAlign: 'center',
  },
  downloadProgressBlock: {
    gap: space.xs,
  },
  downloadProgressMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  downloadProgressLabel: {
    ...typography.caption,
    fontWeight: '600',
  },
  downloadProgressBytes: {
    ...typography.caption,
  },
  error: {
    ...typography.caption,
  },
  notes: {
    gap: space.sm,
  },
  sectionTitle: {
    ...typography.subheading,
  },
  notesBody: {
    ...typography.body,
    lineHeight: 22,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
  },
  linkLabel: {
    ...typography.body,
    flex: 1,
  },
});
