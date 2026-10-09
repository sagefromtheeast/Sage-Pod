import { dequeue } from '@/db/queue';
import { isQueuedNow } from '@/db/queueMembership';
import { getSettings } from '@/db/settings';
import { deleteDownload } from '@/player/downloads';

/**
 * Deletes a download the listener asked to delete — unlike automatic
 * cleanup, this honours Settings › Downloads › "Delete removes from queue".
 */
export async function deleteDownloadByUser(episodeId: number): Promise<void> {
  await deleteDownload(episodeId);
  if (getSettings().deleteRemovesFromQueue && isQueuedNow(episodeId)) await dequeue(episodeId);
}
