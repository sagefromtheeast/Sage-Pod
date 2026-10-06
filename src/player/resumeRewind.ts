/**
 * How far to back up when playback resumes, scaled by how long it was paused.
 *
 * Mirrors AntennaPod's RewindAfterPauseUtils: a quick pause barely moves, an
 * overnight break replays the last sentence or two. Pure so it can be tested.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seconds to rewind after a pause of `pausedMs` milliseconds. */
export function rewindSecondsAfterPause(pausedMs: number): number {
  if (!Number.isFinite(pausedMs) || pausedMs <= 0) return 0;
  if (pausedMs > DAY) return 20;
  if (pausedMs > HOUR) return 10;
  if (pausedMs > MINUTE) return 3;
  return 0.8;
}

/** `position` moved back by the pause-scaled rewind, never below zero. */
export function positionAfterPause(position: number, pausedMs: number): number {
  if (position <= 0) return position;
  return Math.max(0, position - rewindSecondsAfterPause(pausedMs));
}
