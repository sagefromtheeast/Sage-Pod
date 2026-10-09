/**
 * A guess at how often a podcast publishes, from its episodes' dates — the
 * idea behind AntennaPod's ReleaseScheduleGuesser. Shown on the podcast's
 * info page and its statistics.
 */
export type ReleaseSchedule =
  | { kind: 'daily' }
  | { kind: 'weekdays' }
  | { kind: 'specificDays'; days: number[] }
  | { kind: 'weekly'; day: number | null }
  | { kind: 'biweekly'; day: number | null }
  | { kind: 'monthly' }
  | { kind: 'irregular' }
  | { kind: 'unknown' };

const DAY = 24 * 60 * 60 * 1000;

/** How many recent release days the guess looks at; old habits don't count. */
export const RELEASE_WINDOW = 20;

/** Episodes this close together are one release (a two-part episode, a season dropped at once). */
const SAME_RELEASE = 12 * 60 * 60 * 1000;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * `dates` are publish times in ms, in any order; pass a few times
 * RELEASE_WINDOW of them, since several episodes can make one release. `dayOf` gives a time's
 * weekday (0 = Sunday); it defaults to the device's local weekday.
 */
export function guessReleaseSchedule(
  dates: readonly (number | null | undefined)[],
  dayOf: (ms: number) => number = (ms) => new Date(ms).getDay()
): ReleaseSchedule {
  const sorted = dates.filter((d): d is number => typeof d === 'number' && Number.isFinite(d)).sort((a, b) => b - a);
  // Gaps are measured between releases, not episodes: same-day episodes would
  // otherwise pull the typical gap towards zero.
  const recent: number[] = [];
  for (const d of sorted) {
    if (recent.length === RELEASE_WINDOW) break;
    if (recent.length === 0 || recent[recent.length - 1] - d >= SAME_RELEASE) recent.push(d);
  }
  if (recent.length < 4) return { kind: 'unknown' };

  const gaps = recent.slice(1).map((d, i) => (recent[i] - d) / DAY);
  const typical = median(gaps);
  // Most gaps have to agree with the typical one, or there is no schedule.
  const steady = (target: number, tolerance: number) =>
    gaps.filter((gap) => Math.abs(gap - target) <= tolerance).length >= gaps.length * 0.6;

  const counts = Array<number>(7).fill(0);
  for (const d of recent) counts[dayOf(d)]++;
  const usualDay = (): number | null => {
    const best = counts.indexOf(Math.max(...counts));
    return counts[best] >= recent.length * 0.6 ? best : null;
  };

  if (typical <= 1.5) {
    if (counts[0] === 0 && counts[6] === 0 && recent.length >= 5) return { kind: 'weekdays' };
    // Gaps of one day, with the odd two-day gap where a day was skipped.
    return gaps.filter((gap) => gap <= 2.5).length >= gaps.length * 0.8 ? { kind: 'daily' } : { kind: 'irregular' };
  }
  if (typical < 6) {
    // A few set days a week: every day used at least twice, together holding nearly every episode.
    const days = counts.map((count, day) => (count >= 2 ? day : -1)).filter((day) => day >= 0);
    const covered = days.reduce((sum, day) => sum + counts[day], 0);
    if (days.length >= 2 && days.length <= 5 && covered >= recent.length * 0.85) return { kind: 'specificDays', days };
    return { kind: 'irregular' };
  }
  if (typical <= 8 && steady(7, 1.5)) return { kind: 'weekly', day: usualDay() };
  if (typical >= 12 && typical <= 16 && steady(14, 2)) return { kind: 'biweekly', day: usualDay() };
  if (typical >= 26 && typical <= 33 && steady(30, 4)) return { kind: 'monthly' };
  return { kind: 'irregular' };
}

/** "Weekly on Monday", "Mon, Wed, Fri", "No set schedule". */
export function formatReleaseSchedule(schedule: ReleaseSchedule): string {
  switch (schedule.kind) {
    case 'daily':
      return 'Daily';
    case 'weekdays':
      return 'Weekdays';
    case 'specificDays':
      return schedule.days.map((day) => SHORT_DAY_NAMES[day]).join(', ');
    case 'weekly':
      return schedule.day === null ? 'Weekly' : `Weekly on ${DAY_NAMES[schedule.day]}`;
    case 'biweekly':
      return schedule.day === null ? 'Every two weeks' : `Every two weeks on ${DAY_NAMES[schedule.day]}`;
    case 'monthly':
      return 'Monthly';
    case 'irregular':
      return 'No set schedule';
    case 'unknown':
      return 'Not enough episodes yet';
  }
}
