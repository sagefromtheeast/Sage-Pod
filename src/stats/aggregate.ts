/**
 * Statistics, AntennaPod's Subscriptions / Years / Downloads tabs. The SQL in
 * `src/db/stats.ts` returns small per-podcast-per-month rows; everything here
 * groups those rows, so the arithmetic is tested without a database.
 */

/** Seconds listened to one podcast in one month ('YYYY-MM'). */
export type ListenRow = { feedId: number; month: string; seconds: number };

/** A played episode, for "include marked played": its length and what was actually heard. */
export type PlayedEpisodeRow = { feedId: number; month: string; duration: number; listened: number };

export type StatsRange = 'all' | 'last30' | 'last12m' | 'thisYear' | 'lastYear';

export const STATS_RANGES: readonly StatsRange[] = ['all', 'last30', 'last12m', 'thisYear', 'lastYear'];

export const STATS_RANGE_LABELS: Record<StatsRange, string> = {
  all: 'All time',
  last30: 'Last 30 days',
  last12m: 'Last 12 months',
  thisYear: 'This year',
  lastYear: 'Last year',
};

export function parseStatsRange(raw: string | null | undefined): StatsRange {
  return STATS_RANGES.includes(raw as StatsRange) ? (raw as StatsRange) : 'all';
}

const pad = (n: number) => String(n).padStart(2, '0');

/** The device's local day as 'YYYY-MM-DD', the format `playback_history.date` is stored in. */
export function localDay(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Inclusive local 'YYYY-MM-DD' bounds for a range, either end null when open. */
export function rangeBounds(range: StatsRange, now: number): { from: string | null; to: string | null } {
  const d = new Date(now);
  const year = d.getFullYear();
  switch (range) {
    case 'last30':
      return { from: localDay(new Date(year, d.getMonth(), d.getDate() - 29).getTime()), to: null };
    case 'last12m':
      return { from: localDay(new Date(year, d.getMonth() - 11, 1).getTime()), to: null };
    case 'thisYear':
      return { from: `${year}-01-01`, to: null };
    case 'lastYear':
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    default:
      return { from: null, to: null };
  }
}

/**
 * What "include marked played" adds: the part of each played episode that was
 * never heard in the app (marked played, or finished on another player).
 */
export function markedPlayedRows(episodes: readonly PlayedEpisodeRow[]): ListenRow[] {
  return episodes
    .map(({ feedId, month, duration, listened }) => ({ feedId, month, seconds: Math.max(0, duration - listened) }))
    .filter((row) => row.seconds > 0);
}

export type FeedTotal = { feedId: number; seconds: number };

/** Time per podcast, most first; podcasts with nothing are left out. */
export function totalsByFeed(rows: readonly ListenRow[]): FeedTotal[] {
  const totals = new Map<number, number>();
  for (const row of rows) totals.set(row.feedId, (totals.get(row.feedId) ?? 0) + row.seconds);
  return [...totals]
    .map(([feedId, seconds]) => ({ feedId, seconds }))
    .filter((t) => t.seconds > 0)
    .sort((a, b) => b.seconds - a.seconds || a.feedId - b.feedId);
}

/** 'YYYY-MM' for the month `offset` months after `month`. */
export function addMonths(month: string, offset: number): string {
  const [y, m] = month.split('-').map(Number);
  // Plain arithmetic, so the device's time zone can't shift the month.
  const index = y * 12 + (m - 1) + offset;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export type MonthTotal = { month: string; seconds: number };

/** The `count` months ending with `lastMonth`, oldest first, with empty months as zero. */
export function totalsByMonth(rows: readonly ListenRow[], lastMonth: string, count = 12): MonthTotal[] {
  const totals = new Map<string, number>();
  for (const row of rows) totals.set(row.month, (totals.get(row.month) ?? 0) + row.seconds);
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(lastMonth, i - count + 1);
    return { month, seconds: totals.get(month) ?? 0 };
  });
}

export type YearTotal = { year: number; seconds: number };

/** Time per calendar year, newest first. */
export function totalsByYear(rows: readonly ListenRow[]): YearTotal[] {
  const totals = new Map<number, number>();
  for (const row of rows) {
    const year = Number(row.month.slice(0, 4));
    totals.set(year, (totals.get(year) ?? 0) + row.seconds);
  }
  return [...totals]
    .map(([year, seconds]) => ({ year, seconds }))
    .filter((t) => t.seconds > 0)
    .sort((a, b) => b.year - a.year);
}

export type Slice<K> = { key: K | 'other'; value: number; start: number; end: number };

/**
 * Donut slices as fractions of the circle (0..1), largest first: the top
 * `max - 1` keep their own slice and the rest share one "other" slice.
 */
export function donutSlices<K>(items: readonly { key: K; value: number }[], max = 6): Slice<K>[] {
  const positive = items.filter((item) => item.value > 0).sort((a, b) => b.value - a.value);
  const total = positive.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return [];
  const kept: { key: K | 'other'; value: number }[] =
    positive.length > max ? positive.slice(0, max - 1) : [...positive];
  if (positive.length > max) {
    kept.push({ key: 'other', value: positive.slice(max - 1).reduce((sum, item) => sum + item.value, 0) });
  }
  let start = 0;
  return kept.map(({ key, value }) => {
    const end = start + value / total;
    const slice = { key, value, start, end };
    start = end;
    return slice;
  });
}

/**
 * An SVG path for one donut slice between fractions `start` and `end`,
 * clockwise from 12 o'clock. A whole circle is drawn as two halves, since an
 * arc can't start and end on the same point.
 */
export function donutArc(cx: number, cy: number, outer: number, inner: number, start: number, end: number): string {
  if (end - start >= 0.9999) {
    return `${donutArc(cx, cy, outer, inner, 0, 0.5)} ${donutArc(cx, cy, outer, inner, 0.5, 1)}`;
  }
  const point = (r: number, f: number) => {
    const a = f * 2 * Math.PI - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  };
  const large = end - start > 0.5 ? 1 : 0;
  return [
    `M ${point(outer, start)}`,
    `A ${outer} ${outer} 0 ${large} 1 ${point(outer, end)}`,
    `L ${point(inner, end)}`,
    `A ${inner} ${inner} 0 ${large} 0 ${point(inner, start)}`,
    'Z',
  ].join(' ');
}

/** "12.4 h", "35 min", "0 min" — the unit AntennaPod's statistics use. */
export function formatListenTime(seconds: number): string {
  if (seconds >= 3600) {
    const hours = seconds / 3600;
    return `${hours >= 100 ? Math.round(hours) : hours.toFixed(1)} h`;
  }
  return `${Math.round(seconds / 60)} min`;
}

const MONTH_INITIALS = 'JFMAMJJASOND';

/** "J", "F", … for a 'YYYY-MM' bar label. */
export function monthInitial(month: string): string {
  return MONTH_INITIALS[Number(month.slice(5, 7)) - 1] ?? '';
}
