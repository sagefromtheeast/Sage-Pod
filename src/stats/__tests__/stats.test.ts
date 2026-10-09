import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addMonths,
  donutArc,
  donutSlices,
  formatListenTime,
  localDay,
  markedPlayedRows,
  parseStatsRange,
  rangeBounds,
  totalsByFeed,
  totalsByMonth,
  totalsByYear,
  type ListenRow,
} from '../aggregate';
import { formatReleaseSchedule, guessReleaseSchedule } from '../releaseSchedule';

const DAY = 24 * 60 * 60 * 1000;
const utcDay = (ms: number) => new Date(ms).getUTCDay();
/** Noon UTC on a date, so the weekday is the same in every test time zone we care about. */
const at = (iso: string) => Date.parse(`${iso}T12:00:00Z`);

const ROWS: ListenRow[] = [
  { feedId: 1, month: '2025-11', seconds: 600 },
  { feedId: 2, month: '2025-11', seconds: 1800 },
  { feedId: 1, month: '2026-01', seconds: 3000 },
  { feedId: 3, month: '2026-03', seconds: 0 },
  { feedId: 2, month: '2026-03', seconds: 300 },
];

describe('statistics grouping', () => {
  it('totals time per podcast, most first, dropping podcasts with none', () => {
    assert.deepEqual(totalsByFeed(ROWS), [
      { feedId: 1, seconds: 3600 },
      { feedId: 2, seconds: 2100 },
    ]);
    assert.deepEqual(totalsByFeed([]), []);
  });

  it('breaks ties by podcast id so the order is stable', () => {
    const tied = totalsByFeed([
      { feedId: 9, month: '2026-01', seconds: 60 },
      { feedId: 4, month: '2026-01', seconds: 60 },
    ]);
    assert.deepEqual(
      tied.map((t) => t.feedId),
      [4, 9]
    );
  });

  it('fills the months of a chart, empty ones as zero, oldest first', () => {
    const months = totalsByMonth(ROWS, '2026-03', 5);
    assert.deepEqual(months, [
      { month: '2025-11', seconds: 2400 },
      { month: '2025-12', seconds: 0 },
      { month: '2026-01', seconds: 3000 },
      { month: '2026-02', seconds: 0 },
      { month: '2026-03', seconds: 300 },
    ]);
    assert.equal(totalsByMonth([], '2026-03').length, 12);
  });

  it('steps months across year ends', () => {
    assert.equal(addMonths('2026-01', -1), '2025-12');
    assert.equal(addMonths('2025-12', 1), '2026-01');
    assert.equal(addMonths('2026-03', -14), '2025-01');
  });

  it('totals time per year, newest first', () => {
    assert.deepEqual(totalsByYear(ROWS), [
      { year: 2026, seconds: 3300 },
      { year: 2025, seconds: 2400 },
    ]);
  });

  it('counts only the unheard part of played episodes as "marked played"', () => {
    assert.deepEqual(
      markedPlayedRows([
        { feedId: 1, month: '2026-01', duration: 3600, listened: 0 },
        { feedId: 1, month: '2026-01', duration: 3600, listened: 3000 },
        // Listened longer than the episode (replays): nothing extra, never negative.
        { feedId: 2, month: '2026-02', duration: 1200, listened: 1500 },
      ]),
      [
        { feedId: 1, month: '2026-01', seconds: 3600 },
        { feedId: 1, month: '2026-01', seconds: 600 },
      ]
    );
  });
});

describe('statistics date ranges', () => {
  // Local time, as the app uses: 9 October 2026, 8 am on this machine.
  const now = new Date(2026, 9, 9, 8).getTime();

  it('turns each range into inclusive local day bounds', () => {
    assert.deepEqual(rangeBounds('all', now), { from: null, to: null });
    assert.deepEqual(rangeBounds('last30', now), { from: '2026-09-10', to: null });
    assert.deepEqual(rangeBounds('last12m', now), { from: '2025-11-01', to: null });
    assert.deepEqual(rangeBounds('thisYear', now), { from: '2026-01-01', to: null });
    assert.deepEqual(rangeBounds('lastYear', now), { from: '2025-01-01', to: '2025-12-31' });
  });

  it('writes the local day, not the UTC one', () => {
    assert.equal(localDay(new Date(2026, 11, 31, 23, 30).getTime()), '2026-12-31');
    assert.equal(localDay(new Date(2027, 0, 1, 0, 15).getTime()), '2027-01-01');
  });

  it('falls back to all time for an unknown saved range', () => {
    assert.equal(parseStatsRange('thisYear'), 'thisYear');
    assert.equal(parseStatsRange('decade'), 'all');
    assert.equal(parseStatsRange(null), 'all');
  });
});

describe('donut chart', () => {
  it('splits the circle by share, largest first', () => {
    const slices = donutSlices([
      { key: 'a', value: 1 },
      { key: 'b', value: 3 },
      { key: 'c', value: 0 },
    ]);
    assert.deepEqual(slices, [
      { key: 'b', value: 3, start: 0, end: 0.75 },
      { key: 'a', value: 1, start: 0.75, end: 1 },
    ]);
  });

  it('folds the smallest podcasts into one "other" slice', () => {
    const items = [10, 9, 8, 7, 6, 5, 4].map((value, i) => ({ key: i, value }));
    const slices = donutSlices(items, 4);
    assert.deepEqual(
      slices.map((s) => [s.key, s.value]),
      [
        [0, 10],
        [1, 9],
        [2, 8],
        ['other', 22],
      ]
    );
    assert.equal(slices.at(-1)!.end, 1);
  });

  it('draws nothing when there is no data', () => {
    assert.deepEqual(donutSlices([{ key: 1, value: 0 }]), []);
  });

  it('draws a whole circle as two arcs', () => {
    const path = donutArc(50, 50, 40, 25, 0, 1);
    assert.equal(path.match(/M /g)?.length, 2);
    assert.ok(path.startsWith('M 50.00 10.00'));
  });

  it('uses the large-arc flag only past half the circle', () => {
    assert.match(donutArc(50, 50, 40, 25, 0, 0.25), /A 40 40 0 0 1/);
    assert.match(donutArc(50, 50, 40, 25, 0, 0.75), /A 40 40 0 1 1/);
  });

  it('formats listening time in hours or minutes', () => {
    assert.equal(formatListenTime(0), '0 min');
    assert.equal(formatListenTime(2100), '35 min');
    assert.equal(formatListenTime(44640), '12.4 h');
    assert.equal(formatListenTime(400 * 3600), '400 h');
  });
});

describe('release schedule', () => {
  const series = (start: string, stepDays: number, count: number) =>
    Array.from({ length: count }, (_, i) => at(start) + i * stepDays * DAY);
  const guess = (dates: number[]) => guessReleaseSchedule(dates, utcDay);

  it('needs a few episodes before guessing', () => {
    assert.deepEqual(guess(series('2026-01-05', 7, 3)), { kind: 'unknown' });
    assert.deepEqual(guessReleaseSchedule([null, undefined, at('2026-01-05')], utcDay), { kind: 'unknown' });
  });

  it('recognises a weekly show and its day, in any input order', () => {
    // 2026-01-05 is a Monday.
    assert.deepEqual(guess(series('2026-01-05', 7, 10).reverse()), { kind: 'weekly', day: 1 });
  });

  it('tolerates an odd late episode in a weekly show', () => {
    const dates = series('2026-01-05', 7, 10);
    dates[4] += 2 * DAY;
    assert.deepEqual(guess(dates), { kind: 'weekly', day: 1 });
  });

  it('leaves the day out when a weekly show moves around', () => {
    const dates = series('2026-01-05', 7, 8).map((d, i) => d + (i % 2) * DAY);
    assert.equal(guess(dates).kind, 'weekly');
    assert.deepEqual(guess(dates), { kind: 'weekly', day: null });
  });

  it('recognises daily, weekday, fortnightly and monthly shows', () => {
    assert.deepEqual(guess(series('2026-01-01', 1, 14)), { kind: 'daily' });
    const weekdays = series('2026-01-05', 1, 19).filter((d) => utcDay(d) !== 0 && utcDay(d) !== 6);
    assert.deepEqual(guess(weekdays), { kind: 'weekdays' });
    assert.deepEqual(guess(series('2026-01-07', 14, 6)), { kind: 'biweekly', day: 3 });
    const monthly = [1, 2, 3, 4, 5, 6].map((m) => at(`2026-0${m}-15`));
    assert.deepEqual(guess(monthly), { kind: 'monthly' });
  });

  it('recognises set days of the week', () => {
    // Mondays and Thursdays for six weeks.
    const dates = series('2026-01-05', 7, 6).flatMap((monday) => [monday, monday + 3 * DAY]);
    assert.deepEqual(guess(dates), { kind: 'specificDays', days: [1, 4] });
    assert.equal(formatReleaseSchedule(guess(dates)), 'Mon, Thu');
  });

  it('counts several episodes on one day as one release', () => {
    // Part 1 and Part 2 every Monday, an hour apart.
    const dates = series('2026-01-05', 7, 8).flatMap((monday) => [monday, monday + 3600000]);
    assert.deepEqual(guess(dates), { kind: 'weekly', day: 1 });
  });

  it('does not read a season dropped at once as a daily show', () => {
    // Ten episodes on one Tuesday, and ten on a Tuesday a year earlier.
    const drop = (iso: string) => Array.from({ length: 10 }, (_, i) => at(iso) + i * 60000);
    assert.deepEqual(guess([...drop('2026-03-03'), ...drop('2025-03-04')]), { kind: 'unknown' });
  });

  it('calls a scattered feed irregular', () => {
    const offsets = [0, 3, 20, 22, 60, 61, 95, 140];
    assert.deepEqual(guess(offsets.map((o) => at('2026-01-01') + o * DAY)), { kind: 'irregular' });
  });

  it('only looks at the recent episodes', () => {
    // Years of monthly episodes, then a switch to weekly.
    const old = Array.from({ length: 30 }, (_, i) => at('2022-01-10') + i * 30 * DAY);
    assert.equal(guess([...old, ...series('2026-01-05', 7, 20)]).kind, 'weekly');
  });

  it('describes each schedule', () => {
    assert.equal(formatReleaseSchedule({ kind: 'weekly', day: 1 }), 'Weekly on Monday');
    assert.equal(formatReleaseSchedule({ kind: 'weekly', day: null }), 'Weekly');
    assert.equal(formatReleaseSchedule({ kind: 'biweekly', day: 3 }), 'Every two weeks on Wednesday');
    assert.equal(formatReleaseSchedule({ kind: 'irregular' }), 'No set schedule');
  });
});
