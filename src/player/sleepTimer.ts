/**
 * Sleep timer state, as data (AntennaPod's minutes and episodes timers).
 *
 * Two kinds, so a timer can't be half of each:
 * - `minutes` counts down only while audio is playing (as AntennaPod does), so
 *   pausing to answer the door doesn't eat the timer. `endsAt` is set while it
 *   is counting and null while paused; `remainingMs` is authoritative when paused.
 * - `episodes` has no clock at all: the player pauses when that many episodes
 *   have actually ended, whatever the speed or however long they sat paused.
 *   "End of episode" is `episodes` with `remaining: 1`.
 *
 * Pure functions; the player service owns the timeout and the volume fade.
 */
export type SleepTimer =
  | { kind: 'minutes'; minutes: number; remainingMs: number; endsAt: number | null }
  | { kind: 'episodes'; remaining: number };

/** The last 10 s of a minutes timer: fade out, vibrate, and listen for shakes. */
export const SLEEP_WARNING_MS = 10_000;

export function startEpisodesTimer(count: number): SleepTimer {
  return { kind: 'episodes', remaining: Math.max(1, Math.round(count)) };
}

/** Adds minutes to a minutes timer, or episodes to an episodes timer ("+5 min", "+1 episode"). */
export function extendTimer(timer: SleepTimer, amount: number): SleepTimer {
  if (timer.kind === 'episodes') return { ...timer, remaining: timer.remaining + Math.max(0, amount) };
  const extra = Math.max(0, amount) * 60_000;
  return {
    ...timer,
    remainingMs: timer.remainingMs + extra,
    endsAt: timer.endsAt === null ? null : timer.endsAt + extra,
  };
}

/** An episode ended: count it down. `stop` means pause now and clear the timer. */
export function afterEpisodeFinished(timer: SleepTimer): { timer: SleepTimer | null; stop: boolean } {
  if (timer.kind !== 'episodes') return { timer, stop: false };
  return timer.remaining <= 1 ? { timer: null, stop: true } : { timer: { ...timer, remaining: timer.remaining - 1 }, stop: false };
}

/** Volume during the warning window: 1 → 0.1 linearly over the last 10 s (AntennaPod fades too). */
export function fadeVolume(remaining: number): number {
  if (remaining >= SLEEP_WARNING_MS) return 1;
  return 0.1 + 0.9 * Math.max(0, remaining) / SLEEP_WARNING_MS;
}

/**
 * Whether `hour` (0–23) falls in a daily window that may wrap midnight, e.g.
 * 22→6 covers 22:00–05:59 (AntennaPod's auto-enable default).
 */
export function inHourWindow(hour: number, from: number, to: number): boolean {
  if (from === to) return true;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

export function startMinutesTimer(minutes: number, now: number, playing: boolean): SleepTimer {
  const remainingMs = Math.max(0, minutes * 60_000);
  return { kind: 'minutes', minutes, remainingMs, endsAt: playing ? now + remainingMs : null };
}

/** Milliseconds left on a minutes timer, or null for an episodes timer. */
export function remainingMs(timer: SleepTimer, now: number): number | null {
  if (timer.kind === 'episodes') return null;
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

/** Labels for the timer: `short` for the header icon, `long` for the sheet and screen readers. */
export function describeTimer(timer: SleepTimer, now: number): { short: string; long: string } {
  if (timer.kind === 'episodes') {
    return timer.remaining === 1
      ? { short: 'End', long: 'Pauses at the end of this episode' }
      : { short: `${timer.remaining} ep`, long: `Pauses after ${timer.remaining} episodes` };
  }
  const ms = remainingMs(timer, now) ?? 0;
  const paused = timer.endsAt === null ? ' of listening' : '';
  if (ms < 60_000) {
    const seconds = Math.ceil(ms / 1000);
    return { short: `${seconds}s`, long: `Pauses in ${seconds} s${paused}` };
  }
  const minutes = Math.ceil(ms / 60_000);
  return { short: `${minutes}m`, long: `Pauses in ${minutes} min${paused}` };
}
