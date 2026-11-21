/**
 * When stopping or skipping counts as finishing, as in AntennaPod's
 * `PlaybackService.onPostPlayback`: "Smart mark as played" treats an episode
 * stopped within the last N seconds as finished, and with "Keep skipped
 * episodes" off a skipped episode is marked played and leaves the queue.
 */

/** Offered thresholds in seconds (AntennaPod's 0–600 range; 0 turns it off). */
export const SMART_MARK_OPTIONS = [0, 15, 30, 60, 120, 300, 600] as const;

/**
 * Within the last `smartMarkSeconds` of a known length. An episode no longer
 * than the threshold never qualifies, or pausing a short clip anywhere would
 * mark it played.
 */
export function almostEnded(position: number, duration: number, smartMarkSeconds: number): boolean {
  return smartMarkSeconds > 0 && duration > smartMarkSeconds && position >= duration - smartMarkSeconds;
}

type Housekeeping = {
  /** "Remove from queue when finished". */
  removeFinishedFromQueue: boolean;
  /** "Delete after finished", resolved for the episode's podcast. */
  autoDelete: boolean;
  /** Whether the episode's audio is on the phone. */
  downloaded: boolean;
};

/** What finishing an episode does to it besides marking it played. */
export function finishEffects(options: Housekeeping): { dequeue: boolean; deleteDownload: boolean } {
  return {
    dequeue: options.removeFinishedFromQueue,
    deleteDownload: options.autoDelete && options.downloaded,
  };
}

/** What skipping the playing episode does to it. */
export function afterSkip(
  options: {
    position: number;
    duration: number;
    smartMarkSeconds: number;
    keepSkipped: boolean;
  } & Housekeeping
): { markPlayed: boolean; dequeue: boolean; deleteDownload: boolean } {
  const finished = almostEnded(options.position, options.duration, options.smartMarkSeconds);
  if (finished) return { markPlayed: true, ...finishEffects(options) };
  if (!options.keepSkipped) return { markPlayed: true, dequeue: true, deleteDownload: false };
  return { markPlayed: false, dequeue: false, deleteDownload: false };
}

/**
 * What leaving the episode does to it: playing another one or stopping. Left
 * in its last few seconds, it counts as finished, like a skip.
 */
export function afterLeaving(
  options: { position: number; duration: number; smartMarkSeconds: number } & Housekeeping
): { markPlayed: boolean; dequeue: boolean; deleteDownload: boolean } {
  if (!almostEnded(options.position, options.duration, options.smartMarkSeconds)) {
    return { markPlayed: false, dequeue: false, deleteDownload: false };
  }
  return { markPlayed: true, ...finishEffects(options) };
}

export function formatSmartMark(seconds: number): string {
  if (seconds === 0) return 'Off';
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}
