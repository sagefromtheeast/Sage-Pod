import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

import { getEpisode, listDownloaded, listPendingDownloads, setDownloadState } from '@/db/episodes';
import { listQueue } from '@/db/queue';
import { getSettings } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';
import { USER_AGENT } from '@/feed/fetch';
import {
  fileNameFor,
  formatBytes,
  guessExtension,
  KNOWN_AUDIO_EXTENSIONS,
  shouldAutoDownloadEpisode,
} from './downloadRules';

/**
 * Episode download manager.
 *
 * Downloads land in the app's document directory (not the cache) so the OS
 * cannot evict an episode a listener saved for offline listening.
 */

const DOWNLOAD_DIRECTORY = 'episodes';
/** Concurrent downloads. Phones throttle hard above a handful of transfers. */
const MAX_CONCURRENT = 2;


export type DownloadProgress = {
  episodeId: number;
  /** 0..1, or null while the server has not reported a total size. */
  progress: number | null;
  bytesWritten: number;
  totalBytes: number | null;
};

type ProgressListener = (progress: DownloadProgress) => void;

export class DownloadError extends Error {}

const listeners = new Set<ProgressListener>();
const active = new Map<number, { cancel: () => void }>();
const cancelledIds = new Set<number>();
const waiting: { episodeId: number; isAuto: boolean }[] = [];

/** Subscribes to byte-level progress for in-flight downloads. */
export function subscribeToDownloads(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook to subscribe to live download progress for an episode. */
export function useDownloadProgress(episodeId: number): DownloadProgress | null {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    return subscribeToDownloads((data) => {
      if (data.episodeId === episodeId) {
        setProgress(data);
      }
    });
  }, [episodeId]);

  return progress;
}

function emit(progress: DownloadProgress) {
  for (const listener of listeners) listener(progress);
}

export function downloadDirectory(): Directory {
  const directory = new Directory(Paths.document, DOWNLOAD_DIRECTORY);
  if (!directory.exists) {
    try {
      directory.create({ intermediates: true, idempotent: true });
    } catch {
      // Best effort if already created concurrently
    }
  }
  return directory;
}

export {
  fileNameFor,
  formatBytes,
  guessExtension,
  KNOWN_AUDIO_EXTENSIONS,
  shouldAutoDownloadEpisode,
};

/**
 * Resolves the playback URI for a downloaded episode, resilient to iOS sandbox container UUID shifts.
 * Returns null if the episode is not marked done or neither the stored nor canonical file exists.
 */
export function getLocalEpisodePath(episode: EpisodeWithFeed): string | null {
  if (episode.download_state !== 'done') return null;

  if (episode.local_path) {
    try {
      const file = new File(episode.local_path);
      if (file.exists) return file.uri;
    } catch {
      // Sandbox container UUID may have rotated
    }
  }

  try {
    const canonical = new File(downloadDirectory(), fileNameFor(episode));
    if (canonical.exists) return canonical.uri;
  } catch {
    // Filesystem read failure
  }

  return null;
}

/**
 * Validates network connectivity against download constraints.
 * Manual downloads only block when completely disconnected.
 * Automated background downloads respect the user's `downloadOnWifiOnly` setting.
 */
async function networkAllowsDownload(isAuto = false): Promise<boolean> {
  if (!isAuto) {
    try {
      const state = await Network.getNetworkStateAsync();
      if (state.isConnected === false && state.type === Network.NetworkStateType.NONE) {
        return false;
      }
    } catch {
      // Fallback for simulators or environments where Network state lookup is unavailable
    }
    return true;
  }

  if (!getSettings().downloadOnWifiOnly) return true;
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    return state.type !== Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}

/** Queues an episode for download, starting it when a slot frees up. */
export async function queueDownload(
  episodeId: number,
  options: { isAuto?: boolean } = {}
): Promise<void> {
  const { isAuto = false } = options;
  const episode = await getEpisode(episodeId);
  if (!episode) return;
  if (episode.download_state === 'done' || active.has(episodeId)) return;

  cancelledIds.delete(episodeId);
  await setDownloadState(episodeId, 'queued');
  if (!waiting.some((item) => item.episodeId === episodeId)) {
    waiting.push({ episodeId, isAuto });
  }
  void pump();
}

/** Starts queued downloads up to the concurrency limit. */
async function pump(): Promise<void> {
  while (active.size < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift();
    if (next === undefined) return;
    void run(next.episodeId, next.isAuto);
  }
}

async function run(episodeId: number, isAuto: boolean): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode || cancelledIds.has(episodeId)) {
    cancelledIds.delete(episodeId);
    return;
  }

  if (!(await networkAllowsDownload(isAuto))) {
    await setDownloadState(episodeId, isAuto ? 'none' : 'error');
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    return;
  }

  const destination = new File(downloadDirectory(), fileNameFor(episode));
  const isExpoGo = Constants.appOwnership === 'expo';
  const task = File.createDownloadTask(episode.media_url, destination, {
    sessionType: isExpoGo ? 'foreground' : 'background',
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  active.set(episodeId, { cancel: () => task.cancel() });
  await setDownloadState(episodeId, 'downloading');

  const subscription = task.addListener('progress', ({ bytesWritten, totalBytes }) => {
    emit({
      episodeId,
      progress: totalBytes > 0 ? bytesWritten / totalBytes : null,
      bytesWritten,
      totalBytes: totalBytes > 0 ? totalBytes : null,
    });
  });

  try {
    const file = await task.downloadAsync();
    if (cancelledIds.has(episodeId)) {
      try {
        if (destination.exists) destination.delete();
      } catch {}
      await setDownloadState(episodeId, 'none');
      return;
    }
    if (!file) throw new DownloadError('The download did not complete.');
    await setDownloadState(episodeId, 'done', file.uri, file.size ?? null);
  } catch (error) {
    if (cancelledIds.has(episodeId)) {
      try {
        if (destination.exists) destination.delete();
      } catch {}
      await setDownloadState(episodeId, 'none');
      return;
    }

    // Leave no half-written file behind to be mistaken for a real download.
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Best effort
    }
    console.warn(`[downloads] Download failed for episode ${episodeId}:`, error);
    await setDownloadState(episodeId, 'error');
  } finally {
    subscription.remove();
    task.release();
    active.delete(episodeId);
    cancelledIds.delete(episodeId);
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    void pump();
  }
}

/** Cancels an in-flight or queued download. */
export async function cancelDownload(episodeId: number): Promise<void> {
  cancelledIds.add(episodeId);
  const running = active.get(episodeId);
  running?.cancel();
  active.delete(episodeId);

  const queuedIndex = waiting.findIndex((item) => item.episodeId === episodeId);
  if (queuedIndex >= 0) waiting.splice(queuedIndex, 1);

  await setDownloadState(episodeId, 'none');
}

/** Deletes a downloaded file and clears the episode's download state. */
export async function deleteDownload(episodeId: number): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (episode) {
    try {
      if (episode.local_path) {
        const file = new File(episode.local_path);
        if (file.exists) file.delete();
      }
    } catch {}

    try {
      const fallback = new File(downloadDirectory(), fileNameFor(episode));
      if (fallback.exists) fallback.delete();
    } catch {}
  }

  await setDownloadState(episodeId, 'none');
}

/** Deletes all downloaded episode files for a feed being removed. */
export async function deleteFeedDownloads(feedId: number): Promise<void> {
  const downloaded = await listDownloaded();
  for (const ep of downloaded) {
    if (ep.feed_id === feedId) {
      await deleteDownload(ep.id);
    }
  }
}

/** Total bytes currently used by downloaded episodes. */
export function downloadedBytes(): number {
  try {
    const directory = downloadDirectory();
    return directory
      .list()
      .reduce((total, entry) => total + (entry instanceof File ? (entry.size ?? 0) : 0), 0);
  } catch {
    return 0;
  }
}

/** Run auto-cleanup and auto-downloads for the queue (called from app startup). */
export async function manageAutoDownloads(): Promise<void> {
  const settings = getSettings();

  // 1. Resume any interrupted downloads from previous app run
  const pending = await listPendingDownloads();
  for (const ep of pending) {
    void queueDownload(ep.id, { isAuto: true });
  }

  // 2. Cleanup finished episodes if configured
  if (settings.deleteAfterFinished) {
    const downloaded = await listDownloaded();
    for (const ep of downloaded) {
      if (ep.is_played === 1) {
        await deleteDownload(ep.id);
      }
    }
  }

  // 3. Queue auto-downloads up to user limit
  if (settings.autoDownloadLimit > 0 && (await networkAllowsDownload(true))) {
    const queue = await listQueue();
    let queuedToDownload = 0;
    for (const ep of queue) {
      if (queuedToDownload >= settings.autoDownloadLimit) break;
      if (ep.download_state === 'none' && shouldAutoDownloadEpisode(ep)) {
        void queueDownload(ep.id, { isAuto: true });
        queuedToDownload++;
      }
    }
  }
}
