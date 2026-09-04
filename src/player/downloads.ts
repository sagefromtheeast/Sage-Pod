import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';

import { getEpisode, setDownloadState } from '@/db/episodes';
import { getSettings } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';

/**
 * Episode download manager.
 *
 * Downloads land in the app's document directory (not the cache) so the OS
 * cannot evict an episode a listener saved for a flight.
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
const waiting: number[] = [];

/** Subscribes to byte-level progress for in-flight downloads. */
export function subscribeToDownloads(listener: ProgressListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(progress: DownloadProgress) {
  for (const listener of listeners) listener(progress);
}

function downloadDirectory(): Directory {
  const directory = new Directory(Paths.document, DOWNLOAD_DIRECTORY);
  if (!directory.exists) directory.create({ intermediates: true });
  return directory;
}

/** Derives a stable, collision-free filename for an episode. */
function fileNameFor(episode: EpisodeWithFeed): string {
  const fromUrl = /\.([a-z0-9]{2,5})(?:\?|#|$)/i.exec(episode.media_url)?.[1];
  const extension = (fromUrl ?? guessExtension(episode.media_type)).toLowerCase();
  // The episode id already guarantees uniqueness, so the filename needs no
  // sanitised title — which also avoids filesystem-illegal characters.
  return `episode-${episode.id}.${extension}`;
}

function guessExtension(mimeType: string | null): string {
  if (!mimeType) return 'mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('opus')) return 'opus';
  if (mimeType.includes('wav')) return 'wav';
  return 'mp3';
}

/** True when the network is suitable given the user's Wi-Fi-only preference. */
async function networkAllowsDownload(): Promise<boolean> {
  if (!getSettings().downloadOnWifiOnly) return true;
  try {
    const state = await Network.getNetworkStateAsync();
    if (!state.isConnected) return false;
    // Treat anything the OS reports as cellular as metered.
    return state.type !== Network.NetworkStateType.CELLULAR;
  } catch {
    // If the network type cannot be determined, defer to the user's setting
    // rather than silently burning their data allowance.
    return false;
  }
}

/** Queues an episode for download, starting it when a slot frees up. */
export async function queueDownload(episodeId: number): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode) return;
  if (episode.download_state === 'done' || active.has(episodeId)) return;

  await setDownloadState(episodeId, 'queued');
  if (!waiting.includes(episodeId)) waiting.push(episodeId);
  void pump();
}

/** Starts queued downloads up to the concurrency limit. */
async function pump(): Promise<void> {
  while (active.size < MAX_CONCURRENT && waiting.length > 0) {
    const episodeId = waiting.shift();
    if (episodeId === undefined) return;
    void run(episodeId);
  }
}

async function run(episodeId: number): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode) return;

  if (!(await networkAllowsDownload())) {
    await setDownloadState(episodeId, 'none');
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    return;
  }

  const destination = new File(downloadDirectory(), fileNameFor(episode));
  // A background session lets the transfer continue after the user leaves the
  // app, which is the whole point of downloading an episode before a commute.
  const task = File.createDownloadTask(episode.media_url, destination, {
    sessionType: 'background',
  });

  active.set(episodeId, { cancel: () => task.cancel() });
  await setDownloadState(episodeId, 'downloading');

  const subscription = task.addListener('progress', ({ bytesWritten, totalBytes }) => {
    emit({
      episodeId,
      // Servers that omit Content-Length report a total of 0; show an
      // indeterminate bar rather than a bogus percentage.
      progress: totalBytes > 0 ? bytesWritten / totalBytes : null,
      bytesWritten,
      totalBytes: totalBytes > 0 ? totalBytes : null,
    });
  });

  try {
    const file = await task.downloadAsync();
    if (!file) throw new DownloadError('The download did not complete.');
    await setDownloadState(episodeId, 'done', file.uri, file.size ?? null);
  } catch {
    // Leave no half-written file behind to be mistaken for a real download.
    try {
      if (destination.exists) destination.delete();
    } catch {
      // Best effort — a leftover file wastes space but breaks nothing.
    }
    await setDownloadState(episodeId, 'error');
  } finally {
    subscription.remove();
    task.release();
    active.delete(episodeId);
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    void pump();
  }
}

/** Cancels an in-flight or queued download. */
export async function cancelDownload(episodeId: number): Promise<void> {
  const running = active.get(episodeId);
  running?.cancel();
  active.delete(episodeId);

  const queuedIndex = waiting.indexOf(episodeId);
  if (queuedIndex >= 0) waiting.splice(queuedIndex, 1);

  await setDownloadState(episodeId, 'none');
}

/** Deletes a downloaded file and clears the episode's download state. */
export async function deleteDownload(episodeId: number): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode?.local_path) {
    await setDownloadState(episodeId, 'none');
    return;
  }

  try {
    const file = new File(episode.local_path);
    if (file.exists) file.delete();
  } catch {
    // The file may already be gone; clearing the row is what matters.
  }

  await setDownloadState(episodeId, 'none');
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

/** Human-readable byte count, e.g. "1.4 GB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 MB';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value < 10 && unit > 1 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}
