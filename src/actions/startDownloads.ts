import { onMeteredWhileWifiOnly, queueDownload } from '@/player/downloads';
import { showDialog } from '@/ui/Dialog';

/**
 * Starts manual downloads. On mobile data with "Download on Wi-Fi only" on,
 * asks first (AntennaPod's mobile-data confirmation); automatic downloads
 * simply wait for Wi-Fi. Resolves to whether the downloads started.
 */
export async function startDownloads(episodeIds: readonly number[]): Promise<boolean> {
  if (episodeIds.length === 0) return false;
  if (await onMeteredWhileWifiOnly()) {
    const proceed = await new Promise<boolean>((resolve) =>
      showDialog(
        'Download on mobile data?',
        episodeIds.length === 1
          ? 'You are not on Wi-Fi, and downloads are set to Wi-Fi only.'
          : `You are not on Wi-Fi, and downloads are set to Wi-Fi only. This starts ${episodeIds.length} downloads.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Download', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) }
      )
    );
    if (!proceed) return false;
  }
  for (const id of episodeIds) await queueDownload(id);
  return true;
}
