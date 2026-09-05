import { Alert, Share } from 'react-native';

export type ShareEpisodeParams = {
  title: string;
  podcastTitle: string;
  url: string;
  positionSeconds?: number;
};

/**
 * Shares an episode via the native platform share sheet, optionally including
 * a timestamp fragment if currently playing past 15 seconds.
 */
export async function shareEpisode({
  title,
  podcastTitle,
  url,
  positionSeconds = 0,
}: ShareEpisodeParams): Promise<void> {
  try {
    const timestampSuffix = positionSeconds > 15 ? `#t=${Math.floor(positionSeconds)}` : '';
    const shareUrl = `${url}${timestampSuffix}`;
    const message = `Listening to "${title}" from ${podcastTitle}:\n${shareUrl}`;

    await Share.share({
      message,
      url: shareUrl,
      title,
    });
  } catch (error) {
    Alert.alert('Could not share', error instanceof Error ? error.message : String(error));
  }
}
