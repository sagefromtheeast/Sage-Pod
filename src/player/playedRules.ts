/**
 * When stopping or skipping counts as finishing, as in AntennaPod's
 * `PlaybackService.onPostPlayback`: "Smart mark as played" treats an episode
 * stopped within the last N seconds as finished, and with "Keep skipped
 * episodes" off a skipped episode is marked played and leaves the queue.
 */

/** Offered thresholds in seconds (AntennaPod's 0–600 range; 0 turns it off). */
export const SMART_MARK_OPTIONS = [0, 15, 30, 60, 120, 300, 600] as const;

/** Within the last `smartMarkSeconds` of a known length. */
export function almostEnded(position: number, duration: number, smartMarkSeconds: number): boolean {
  return duration > 0 && smartMarkSeconds > 0 && position >= duration - smartMarkSeconds;
}

/** What skipping the playing episode does to it. */
export function afterSkip(options: {
  position: number;
  duration: number;
  smartMarkSeconds: number;
  keepSkipped: boolean;
  removeFinishedFromQueue: boolean;
}): { markPlayed: boolean; dequeue: boolean } {
  const finished = almostEnded(options.position, options.duration, options.smartMarkSeconds);
  if (finished) return { markPlayed: true, dequeue: options.removeFinishedFromQueue };
  if (!options.keepSkipped) return { markPlayed: true, dequeue: true };
  return { markPlayed: false, dequeue: false };
}

export function formatSmartMark(seconds: number): string {
  if (seconds === 0) return 'Off';
  return seconds < 60 ? `${seconds}s` : `${seconds / 60} min`;
}
