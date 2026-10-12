import type { DownloadState } from '@/db/types';

import { formatBytes } from './downloadRules';

/**
 * Pure helpers for Android's background downloads (D-029): which WorkManager
 * job speaks for an episode, what its state means for the episode's row, and
 * the transfer line kept in the download log.
 */

export type WorkState = 'ENQUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';

/** One WorkManager job as the native module describes it. */
export type DownloadWork = {
  id: string;
  episodeId: number;
  state: WorkState;
  /** When the job was queued (ms since epoch); 0 for a job with no record of it. */
  enqueuedAt: number;
  attempt: number;
  bytesWritten: number;
  /** -1 while the server hasn't said. */
  totalBytes: number;
  path: string | null;
  size: number;
  resumedFrom: number;
  elapsedMs: number;
  errorCode: string | null;
  errorMessage: string | null;
  httpStatus: number;
};

export type WorkAction = 'done' | 'failed' | 'downloading' | 'enqueue' | 'none';

const UNFINISHED: WorkState[] = ['ENQUEUED', 'RUNNING', 'BLOCKED'];
const RANK: Record<WorkState, number> = {
  RUNNING: 0,
  ENQUEUED: 1,
  BLOCKED: 1,
  SUCCEEDED: 2,
  FAILED: 3,
  CANCELLED: 4,
};

export function isUnfinished(state: WorkState): boolean {
  return UNFINISHED.includes(state);
}

/**
 * The job that speaks for an episode when there are several (finished jobs
 * stay listed until pruned): one still going, else the newest finished one,
 * so an old success can't hide the failure of a later retry. Equal times fall
 * back to success over failure over cancellation.
 */
export function pickWork(works: readonly DownloadWork[]): DownloadWork | undefined {
  return [...works].sort((a, b) => {
    const live = Number(isUnfinished(b.state)) - Number(isUnfinished(a.state));
    if (live !== 0) return live;
    if (!isUnfinished(a.state) && a.enqueuedAt !== b.enqueuedAt) return b.enqueuedAt - a.enqueuedAt;
    return RANK[a.state] - RANK[b.state];
  })[0];
}

/**
 * What to do with an episode's row given its job. `atStartup` also restarts
 * pending rows that have no live job (a cancelled one, or one from before
 * background downloads), which resume from their partial file.
 */
export function reconcileAction(
  rowState: DownloadState,
  work: DownloadWork | undefined,
  atStartup: boolean
): WorkAction {
  const pending = rowState === 'queued' || rowState === 'downloading';
  if (!pending) return 'none';
  if (!work || work.state === 'CANCELLED') return atStartup ? 'enqueue' : 'none';
  switch (work.state) {
    case 'SUCCEEDED':
      return 'done';
    case 'FAILED':
      return 'failed';
    case 'RUNNING':
      return rowState === 'queued' ? 'downloading' : 'none';
    default:
      return 'none';
  }
}

/** Groups jobs by episode. */
export function worksByEpisode(works: readonly DownloadWork[]): Map<number, DownloadWork[]> {
  const grouped = new Map<number, DownloadWork[]>();
  for (const work of works) {
    if (!work.episodeId) continue;
    const list = grouped.get(work.episodeId) ?? [];
    list.push(work);
    grouped.set(work.episodeId, list);
  }
  return grouped;
}

function duration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`;
}

/**
 * "48 MB in 1 min 12 s, 683 KB/s" for the download log, so a slow download
 * can be told from a fast one. A resumed file counts only what this run fetched.
 */
export function transferSummary(
  size: number,
  elapsedMs: number,
  extra: { resumedFrom?: number; attempt?: number; background?: number } = {}
): string | null {
  if (!(size > 0) || !(elapsedMs > 0)) return null;
  const resumedFrom = extra.resumedFrom && extra.resumedFrom > 0 && extra.resumedFrom < size ? extra.resumedFrom : 0;
  const fetched = size - resumedFrom;
  const parts = [`${formatBytes(size)} in ${duration(elapsedMs)}, ${formatBytes((fetched * 1000) / elapsedMs)}/s`];
  if (resumedFrom) parts.push(`resumed from ${formatBytes(resumedFrom)}`);
  if (extra.attempt && extra.attempt > 1) parts.push(`attempt ${extra.attempt}`);
  if (extra.background != null) parts.push(`${Math.round(extra.background * 100)}% in the background`);
  return parts.join(', ');
}
