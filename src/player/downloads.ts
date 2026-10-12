import * as Battery from 'expo-battery';
import Constants from 'expo-constants';
import { Directory, File, Paths } from 'expo-file-system';
import * as Network from 'expo-network';
import { useEffect, useState } from 'react';

import { AppState, Platform } from 'react-native';

import { addDownloadLog, type NewDownloadLogEntry } from '@/db/downloadLog';
import { getEpisode, listDownloaded, listPendingDownloads, setDownloadState } from '@/db/episodes';
import { listQueue, onEpisodeQueued } from '@/db/queue';
import { getMeta, getSettings, setMeta } from '@/db/settings';
import { notifyDownloadFailed } from '@/notify';
import { boolOverride, resolveOverride } from '@/feed/feedPrefs';
import type { EpisodeWithFeed } from '@/db/types';
import { basicAuthHeader } from '@/feed/auth';
import { feedCredentialsFor } from '@/feed/credentials';
import { USER_AGENT } from '@/feed/fetch';
import {
  fileNameFor,
  formatBytes,
  guessExtension,
  KNOWN_AUDIO_EXTENSIONS,
  shouldAutoDownloadEpisode,
} from './downloadRules';
import { cleanupCandidates, parseCleanup } from './cleanup';
import {
  isUnfinished,
  pickWork,
  reconcileAction,
  transferSummary,
  worksByEpisode,
  type DownloadWork,
  type WorkState,
} from './downloadWork';
import { nativeDownloads } from './nativeDownloads';
import { classifyDownloadError } from './types';

/**
 * Episode download manager.
 *
 * Downloads land in the app's document directory (not the cache) so the OS
 * cannot evict an episode a listener saved for offline listening.
 */

const DOWNLOAD_DIRECTORY = 'episodes';
/** Concurrent downloads on the JavaScript path. Phones throttle hard above a handful of transfers. */
const MAX_CONCURRENT = 2;

/**
 * Android builds download through WorkManager (D-029): jobs that keep going
 * with the app in the background or closed, wait for Wi-Fi or power by
 * themselves, and resume partial files. Expo Go, iOS and web keep the
 * JavaScript queue below.
 */
const worker = nativeDownloads;

/** Total time spent in the background so far, for the download log's transfer line. */
let backgroundMs = 0;
let backgroundSince: number | null = AppState.currentState === 'active' ? null : Date.now();
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    if (backgroundSince != null) backgroundMs += Date.now() - backgroundSince;
    backgroundSince = null;
  } else if (backgroundSince == null) {
    backgroundSince = Date.now();
  }
});
function backgroundTotal(): number {
  return backgroundMs + (backgroundSince != null ? Date.now() - backgroundSince : 0);
}

/** Records a finished or failed download in the persisted log (best effort). */
function recordLog(entry: NewDownloadLogEntry): void {
  void addDownloadLog(entry).catch((error) => console.warn('[downloads] Could not write the download log:', error));
}

// Reactive queue auto-download (AntennaPod prefEnableAutoDlQueue)
onEpisodeQueued((episodeId) => {
  if (getSettings().autoDownloadQueue) {
    void queueDownload(episodeId, { isAuto: true });
  }
});


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
export function useDownloadProgress(episodeId: number | null | undefined): DownloadProgress | null {
  const [progress, setProgress] = useState<DownloadProgress | null>(null);

  useEffect(() => {
    if (!episodeId || Number.isNaN(episodeId)) return;
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

/** True on a cellular connection; false when it can't be told (simulators, web). */
export async function onCellular(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    return state.type === Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}

/** True on a cellular connection while "Download on Wi-Fi only" is on: manual downloads ask first. */
export async function onMeteredWhileWifiOnly(): Promise<boolean> {
  if (!getSettings().downloadOnWifiOnly) return false;
  return onCellular();
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

  // AntennaPod's "Only while charging": automatic downloads wait for power.
  if (getSettings().autoDownloadOnlyCharging && (await onBattery())) return false;
  if (!getSettings().downloadOnWifiOnly) return true;
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    return state.type !== Network.NetworkStateType.CELLULAR;
  } catch {
    return false;
  }
}

/** Unplugged, as far as the system says; an unknown state never holds downloads back. */
async function onBattery(): Promise<boolean> {
  try {
    return (await Battery.getBatteryStateAsync()) === Battery.BatteryState.UNPLUGGED;
  } catch {
    return false;
  }
}

/**
 * Automatic downloads held back by Wi-Fi only or Only while charging, kept
 * across restarts and retried when the app opens, the background refresh
 * runs, or the phone is plugged in.
 */
const HELD_KEY = 'heldAutoDownloads';
let held: Set<number> | null = null;

async function heldDownloads(): Promise<Set<number>> {
  if (!held) {
    let ids: unknown = [];
    try {
      ids = JSON.parse((await getMeta(HELD_KEY)) ?? '[]');
    } catch {
      // A damaged list is just forgotten.
    }
    held ??= new Set(Array.isArray(ids) ? ids.filter((id): id is number => typeof id === 'number') : []);
  }
  return held;
}

async function holdAutoDownload(episodeId: number): Promise<void> {
  const ids = await heldDownloads();
  if (ids.has(episodeId)) return;
  ids.add(episodeId);
  await setMeta(HELD_KEY, JSON.stringify([...ids]));
}

export async function retryHeldAutoDownloads(): Promise<void> {
  if (Platform.OS === 'web') return;
  const ids = await heldDownloads();
  // WorkManager waits for Wi-Fi and power itself, so held downloads (kept
  // from before background downloads) can all be handed over.
  if (ids.size === 0 || (!worker && !(await networkAllowsDownload(true)))) return;
  const retry = [...ids];
  ids.clear();
  await setMeta(HELD_KEY, '[]');
  for (const id of retry) {
    const episode = await getEpisode(id);
    // Played, downloaded or deleted meanwhile: nothing left to fetch.
    if (episode && episode.is_played === 0 && episode.download_state === 'none') {
      void queueDownload(id, { isAuto: true });
    }
  }
}

/** Retries held automatic downloads when the phone is plugged in. */
export function useRetryHeldDownloadsOnPower(): void {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const subscription = Battery.addBatteryStateListener(({ batteryState }) => {
      if (batteryState === Battery.BatteryState.CHARGING || batteryState === Battery.BatteryState.FULL) {
        void retryHeldAutoDownloads().catch(() => undefined);
      }
    });
    return () => subscription.remove();
  }, []);
}

/** Queues an episode for download, starting it when a slot frees up. */
export async function queueDownload(
  episodeId: number,
  options: { isAuto?: boolean } = {}
): Promise<void> {
  const { isAuto = false } = options;
  const episode = await getEpisode(episodeId);
  if (!episode) return;
  if (worker) {
    if (episode.download_state === 'done') return;
    if (episode.download_state !== 'downloading') await setDownloadState(episodeId, 'queued');
    await enqueueWork(episode, isAuto);
    return;
  }
  if (episode.download_state === 'done' || active.has(episodeId)) return;

  cancelledIds.delete(episodeId);
  await setDownloadState(episodeId, 'queued');
  if (!waiting.some((item) => item.episodeId === episodeId)) {
    waiting.push({ episodeId, isAuto });
  }
  void pump();
}

/**
 * Downloads whose work isn't finished, counted until their last write: a
 * cancelled one still records its state after `active` lets go of it.
 */
let runsInFlight = 0;

/** Whether any download is queued or still writing; a database restore waits for none. */
export function isDownloading(): boolean {
  return runsInFlight > 0 || waiting.length > 0 || workInFlight.size > 0;
}

/** Starts queued downloads up to the concurrency limit. */
async function pump(): Promise<void> {
  while (active.size < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift();
    if (next === undefined) return;
    runsInFlight += 1;
    void run(next.episodeId, next.isAuto).finally(() => {
      runsInFlight -= 1;
    });
  }
}

async function run(episodeId: number, isAuto: boolean, attempt = 0): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode || cancelledIds.has(episodeId)) {
    cancelledIds.delete(episodeId);
    return;
  }

  if (!(await networkAllowsDownload(isAuto))) {
    // An automatic download just waits for a connection; a manual one failed.
    if (!isAuto) {
      recordLog({
        episode_id: episodeId,
        episode_title: episode.title,
        feed_title: episode.feed_title,
        url: episode.media_url,
        status: 'failed',
        error_code: 'OFFLINE',
        error_message: 'There was no internet connection.',
      });
    }
    await setDownloadState(episodeId, isAuto ? 'none' : 'error');
    // Remembered, so it starts once the phone is on Wi-Fi or charging again.
    if (isAuto) await holdAutoDownload(episodeId);
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    return;
  }

  const destination = new File(downloadDirectory(), fileNameFor(episode));
  const isExpoGo = Constants.appOwnership === 'expo';
  // A password-protected podcast's file, sent the password only on the feed's own host.
  const auth = await feedCredentialsFor(episode.feed_id, episode.media_url);
  const task = File.createDownloadTask(episode.media_url, destination, {
    sessionType: isExpoGo ? 'foreground' : 'background',
    headers: {
      'User-Agent': USER_AGENT,
      ...(auth ? { Authorization: basicAuthHeader(auth) } : {}),
    },
  });

  active.set(episodeId, { cancel: () => task.cancel() });
  await setDownloadState(episodeId, 'downloading');
  const startedAt = Date.now();
  const backgroundAtStart = backgroundTotal();

  let expectedTotalBytes: number | null = null;
  const subscription = task.addListener('progress', ({ bytesWritten, totalBytes }) => {
    if (totalBytes > 0) expectedTotalBytes = totalBytes;
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

    // Captive portal / HTML detection (AntennaPod HttpDownloader)
    if (file.size != null && file.size < 100 * 1024) {
      try {
        const preview = (await file.slice(0, 512).text()).toLowerCase();
        if (
          preview.includes('<!doctype html') ||
          preview.includes('<html') ||
          preview.includes('<head') ||
          preview.includes('captive')
        ) {
          if (destination.exists) destination.delete();
          throw new DownloadError('A captive Wi-Fi login page or HTML error was received instead of audio.');
        }
      } catch (e) {
        if (e instanceof DownloadError) throw e;
      }
    }

    // Truncated stream verification (AntennaPod #8319)
    if (expectedTotalBytes != null && expectedTotalBytes > 0 && file.size != null) {
      if (file.size < expectedTotalBytes * 0.95) {
        if (destination.exists) destination.delete();
        throw new DownloadError(
          `Download stream truncated: received ${file.size} of ${expectedTotalBytes} bytes.`
        );
      }
    }

    recordLog({
      episode_id: episodeId,
      episode_title: episode.title,
      feed_title: episode.feed_title,
      url: episode.media_url,
      status: 'success',
      error_code: null,
      error_message: transferSummary(file.size ?? 0, Date.now() - startedAt, {
        attempt: attempt + 1,
        background: (backgroundTotal() - backgroundAtStart) / Math.max(1, Date.now() - startedAt),
      }),
    });

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

    const failure = classifyDownloadError(error);

    // 1 immediate retry on transient network drops (AntennaPod #8691)
    if (failure.isRetryable && attempt === 0 && !cancelledIds.has(episodeId)) {
      console.warn(
        `[downloads] Transient error (${failure.code}) for episode ${episodeId}, retrying once immediately:`,
        error
      );
      subscription.remove();
      task.release();
      active.delete(episodeId);
      return run(episodeId, isAuto, 1);
    }

    console.warn(`[downloads] Download failed for episode ${episodeId} (${failure.code}):`, error);
    recordLog({
      episode_id: episodeId,
      episode_title: episode.title,
      feed_title: episode.feed_title,
      url: episode.media_url,
      status: 'failed',
      error_code: failure.code,
      error_message: failure.message,
    });
    if (getSettings().notifyDownloadErrors) void notifyDownloadFailed(episodeId, episode.title, failure.message);
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
  if (worker) {
    await setDownloadState(episodeId, 'none');
    const episode = await getEpisode(episodeId);
    if (episode) await worker.cancel(episodeId, new File(downloadDirectory(), fileNameFor(episode)).uri);
    workInFlight.delete(episodeId);
    emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    return;
  }
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

/**
 * Detects episodes marked 'done' whose audio files are missing from disk
 * (e.g. after sandbox UUID shifts or storage cleaners), resetting them to 'none'.
 * (AntennaPod PR #8428 self-healing pattern).
 */
export async function reconcileStaleDownloads(): Promise<number> {
  const downloaded = await listDownloaded();
  let reconciled = 0;
  for (const ep of downloaded) {
    const validPath = getLocalEpisodePath(ep);
    if (!validPath) {
      console.warn(`[downloads] Reconciling stale download for episode ${ep.id}: file missing on disk`);
      await setDownloadState(ep.id, 'none');
      reconciled++;
    }
  }
  return reconciled;
}

/**
 * Deletes played downloads to make room for new ones when the storage limit
 * is reached, choosing them by Settings › Downloads › Episode cleanup
 * (src/player/cleanup.ts). "Never" frees nothing.
 */
export async function pruneOldEpisodesForStorage(episodesNeeded = 1): Promise<number> {
  if (episodesNeeded <= 0) return 0;
  const rule = parseCleanup(getSettings().episodeCleanup);
  const queuedIds = new Set((await listQueue()).map((q) => q.id));
  const candidates = cleanupCandidates(rule, await listDownloaded(), queuedIds, Date.now());

  let pruned = 0;
  for (const candidate of candidates) {
    if (pruned >= episodesNeeded) break;
    await deleteDownload(candidate.id);
    pruned++;
  }
  return pruned;
}

/** Run auto-cleanup, stale reconciliation, and auto-downloads (called from app startup). */
export async function manageAutoDownloads(): Promise<void> {
  // Downloads are native-only: the web build (the screenshot harness) has no
  // files, and reconciling would wipe its seeded downloads.
  if (Platform.OS === 'web') return;
  const settings = getSettings();

  // 1. Reconcile stale downloads (disk vs SQLite, AntennaPod #8428)
  await reconcileStaleDownloads();

  // 2. Resume any interrupted downloads from previous app run: on Android,
  // record what WorkManager finished meanwhile and restart what it lost.
  if (worker) {
    await reconcileDownloadWork();
  } else {
    for (const ep of await listPendingDownloads()) {
      void queueDownload(ep.id, { isAuto: true });
    }
  }

  // 3. Delete played downloads where configured: the podcast's own Auto-delete
  // choice, else the global "Delete after finishing".
  for (const ep of await listDownloaded()) {
    const autoDelete = resolveOverride(boolOverride(ep.feed_auto_delete), settings.deleteAfterFinished).value;
    if (ep.is_played === 1 && autoDelete) await deleteDownload(ep.id);
  }

  // 3b. "N hours after played" cleanup deletes whether or not room is needed.
  const rule = parseCleanup(settings.episodeCleanup);
  if (rule.kind === 'after') {
    const queuedIds = new Set((await listQueue()).map((q) => q.id));
    for (const ep of cleanupCandidates(rule, await listDownloaded(), queuedIds, Date.now())) {
      await deleteDownload(ep.id);
    }
  }

  // 4. Enforce storage cap if configured (AntennaPod #5236)
  if (settings.maxDownloadedEpisodes > 0) {
    const currentCount = (await listDownloaded()).length;
    if (currentCount > settings.maxDownloadedEpisodes) {
      await pruneOldEpisodesForStorage(currentCount - settings.maxDownloadedEpisodes);
    }
  }

  // 5. Auto-downloads that waited for Wi-Fi or power.
  await retryHeldAutoDownloads();

  // 6. Queue auto-downloads up to user limit
  if (settings.autoDownloadLimit > 0 && (worker || (await networkAllowsDownload(true)))) {
    const queue = await listQueue();
    let queuedToDownload = 0;
    for (const ep of queue) {
      if (queuedToDownload >= settings.autoDownloadLimit) break;
      if (ep.download_state === 'none' && shouldAutoDownloadEpisode(ep)) {
        if (settings.maxDownloadedEpisodes > 0) {
          const currentCount = (await listDownloaded()).length;
          if (currentCount + queuedToDownload >= settings.maxDownloadedEpisodes) {
            const freed = await pruneOldEpisodesForStorage(1);
            if (freed === 0 && currentCount + queuedToDownload >= settings.maxDownloadedEpisodes) {
              break;
            }
          }
        }
        void queueDownload(ep.id, { isAuto: true });
        queuedToDownload++;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Android: WorkManager jobs (D-029)

/** Episodes with a job not yet finished, for isDownloading(). */
const workInFlight = new Set<number>();
/** The last state seen per job, so the database is touched only on a change. */
const seenWork = new Map<string, WorkState>();
let applying: Promise<void> = Promise.resolve();

async function enqueueWork(episode: EpisodeWithFeed, isAuto: boolean): Promise<void> {
  if (!worker) return;
  const settings = getSettings();
  // A password-protected podcast's file, sent the password only on the feed's own host.
  const auth = await feedCredentialsFor(episode.feed_id, episode.media_url);
  workInFlight.add(episode.id);
  await worker.enqueue({
    episodeId: episode.id,
    url: episode.media_url,
    path: new File(downloadDirectory(), fileNameFor(episode)).uri,
    title: episode.title,
    headers: {
      'User-Agent': USER_AGENT,
      ...(auth ? { Authorization: basicAuthHeader(auth) } : {}),
    },
    manual: !isAuto,
    unmeteredOnly: settings.downloadOnWifiOnly,
    requiresCharging: settings.autoDownloadOnlyCharging,
  });
}

/** Applies one job's outcome to its episode's row. */
async function applyWork(episodeId: number, work: DownloadWork | undefined, atStartup: boolean): Promise<void> {
  const episode = await getEpisode(episodeId);
  if (!episode) return;
  const action = reconcileAction(episode.download_state, work, atStartup);
  if (action === 'downloading') {
    await setDownloadState(episodeId, 'downloading');
  } else if (action === 'enqueue') {
    await enqueueWork(episode, true);
  } else if (action === 'done' && work) {
    const file = work.path ? new File(work.path) : null;
    if (file?.exists) {
      recordLog({
        episode_id: episodeId,
        episode_title: episode.title,
        feed_title: episode.feed_title,
        url: episode.media_url,
        status: 'success',
        error_code: null,
        error_message: transferSummary(file.size ?? work.size, work.elapsedMs, {
          resumedFrom: work.resumedFrom,
          attempt: work.attempt + 1,
        }),
      });
      await setDownloadState(episodeId, 'done', file.uri, file.size ?? null);
    } else {
      // Finished once but gone since: fetch it again.
      await enqueueWork(episode, true);
    }
  } else if (action === 'failed' && work) {
    const failure = classifyDownloadError(new Error(work.errorMessage ?? work.errorCode ?? 'Download failed'));
    console.warn(`[downloads] Download failed for episode ${episodeId} (${work.errorCode}):`, work.errorMessage);
    recordLog({
      episode_id: episodeId,
      episode_title: episode.title,
      feed_title: episode.feed_title,
      url: episode.media_url,
      status: 'failed',
      error_code: failure.code === 'UNKNOWN' && work.errorCode ? work.errorCode : failure.code,
      error_message: failure.message,
    });
    if (getSettings().notifyDownloadErrors) void notifyDownloadFailed(episodeId, episode.title, failure.message);
    await setDownloadState(episodeId, 'error');
  }
}

/** Live job updates: progress to the screens, state changes to the database. */
function onWorkChange(works: DownloadWork[]): void {
  const changed: [number, DownloadWork][] = [];
  for (const [episodeId, list] of worksByEpisode(works)) {
    const work = pickWork(list);
    if (!work) continue;
    if (work.state === 'RUNNING' && work.totalBytes !== 0) {
      emit({
        episodeId,
        progress: work.totalBytes > 0 ? work.bytesWritten / work.totalBytes : null,
        bytesWritten: work.bytesWritten,
        totalBytes: work.totalBytes > 0 ? work.totalBytes : null,
      });
    }
    if (isUnfinished(work.state)) workInFlight.add(episodeId);
    else workInFlight.delete(episodeId);
    if (seenWork.get(work.id) === work.state) continue;
    seenWork.set(work.id, work.state);
    if (!isUnfinished(work.state)) emit({ episodeId, progress: null, bytesWritten: 0, totalBytes: null });
    changed.push([episodeId, work]);
  }
  if (changed.length === 0) return;
  // One at a time, so a burst of updates can't record a result twice.
  applying = applying
    .then(async () => {
      for (const [episodeId, work] of changed) await applyWork(episodeId, work, false);
    })
    .catch((error) => console.warn('[downloads] Could not record a download:', error));
}

worker?.addListener('onChange', ({ downloads }) => onWorkChange(downloads));

/**
 * Records what WorkManager finished while Sage Pod wasn't running, restarts
 * pending downloads it has no job for, then forgets the finished jobs. Runs
 * at startup and in the background refresh.
 */
export async function reconcileDownloadWork(): Promise<void> {
  if (!worker) return;
  const work = worksByEpisode(await worker.getAll());
  const pass = applying.then(async () => {
    for (const episode of await listPendingDownloads()) {
      await applyWork(episode.id, pickWork(work.get(episode.id) ?? []), true);
    }
  });
  applying = pass.catch(() => undefined);
  await pass;
  await worker.clearFinished();
  seenWork.clear();
}
