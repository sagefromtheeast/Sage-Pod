import * as Sharing from 'expo-sharing';
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

/** AntennaPod's "Share file": the downloaded audio itself, to another app or a nearby phone. */
export async function shareEpisodeFile(fileUri: string, title: string): Promise<void> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      Alert.alert('Could not share', 'Sharing files isn’t available on this device.');
      return;
    }
    await Sharing.shareAsync(fileUri, { dialogTitle: title, mimeType: 'audio/*' });
  } catch (error) {
    Alert.alert('Could not share', error instanceof Error ? error.message : String(error));
  }
}
