/**
 * Sleep timer state, as data.
 *
 * Two kinds, so a timer can't be half of each:
 * - `minutes` counts down only while audio is playing (as AntennaPod does), so
 *   pausing to answer the door doesn't eat the timer. `endsAt` is set while it
 *   is counting and null while paused; `remainingMs` is authoritative when paused.
 * - `endOfEpisode` has no clock at all — the player pauses when the episode
 *   actually ends, whatever the playback speed or however long it was paused.
 *
 * Pure functions; the player service owns the setTimeout.
 */
export type SleepTimer =
  | { kind: 'minutes'; minutes: number; remainingMs: number; endsAt: number | null }
  | { kind: 'endOfEpisode' };

export function startMinutesTimer(minutes: number, now: number, playing: boolean): SleepTimer {
  const remainingMs = Math.max(0, minutes * 60_000);
  return { kind: 'minutes', minutes, remainingMs, endsAt: playing ? now + remainingMs : null };
}

/** Milliseconds left on a minutes timer, or null for end-of-episode. */
export function remainingMs(timer: SleepTimer, now: number): number | null {
  if (timer.kind === 'endOfEpisode') return null;
  return timer.endsAt === null ? timer.remainingMs : Math.max(0, timer.endsAt - now);
}

/** Freezes the countdown. No-op if already paused or not a minutes timer. */
export function pauseTimer(timer: SleepTimer, now: number): SleepTimer {
  if (timer.kind !== 'minutes' || timer.endsAt === null) return timer;
  return { ...timer, remainingMs: Math.max(0, timer.endsAt - now), endsAt: null };
}

/** Restarts the countdown from where it was frozen. No-op if already running. */
export function resumeTimer(timer: SleepTimer, now: number): SleepTimer {
  if (timer.kind !== 'minutes' || timer.endsAt !== null) return timer;
  return { ...timer, endsAt: now + timer.remainingMs };
}
