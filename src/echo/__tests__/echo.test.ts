import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  echoWindow,
  firstPlayMonth,
  formatSpan,
  hoarderVerdict,
  listenerType,
  medianDelay,
  pickOne,
  queueOutlook,
  shareText,
  showEchoCard,
  wholeHours,
  type EchoYear,
} from '../echo';

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
const HOUR = 3600;
const DAY_MS = 24 * 3600 * 1000;

describe('echoWindow', () => {
  it('opens on 10 December and stays open to the end of the year', () => {
    assert.deepEqual(echoWindow(at(2026, 12, 9, 23)), { year: 2026, open: false });
    assert.deepEqual(echoWindow(at(2026, 12, 10, 0)), { year: 2026, open: true });
    assert.deepEqual(echoWindow(at(2026, 12, 31, 23)), { year: 2026, open: true });
    assert.deepEqual(echoWindow(at(2027, 1, 1, 0)), { year: 2027, open: false });
    assert.deepEqual(echoWindow(at(2026, 11, 20)), { year: 2026, open: false });
  });
});

describe('showEchoCard', () => {
  const dec = at(2026, 12, 15);
  it('needs the window, 10 hours and not hidden this year', () => {
    assert.equal(showEchoCard(dec, 10 * HOUR, null), true);
    assert.equal(showEchoCard(dec, 10 * HOUR - 1, null), false);
    assert.equal(showEchoCard(dec, 50 * HOUR, 2026), false);
    // Hidden last year doesn't hide it this year.
    assert.equal(showEchoCard(dec, 50 * HOUR, 2025), true);
    assert.equal(showEchoCard(at(2026, 11, 15), 50 * HOUR, null), false);
  });
});

describe('queueOutlook', () => {
  it('spreads the queue over the days left, today included', () => {
    // 22 days from 10 December: 33 h is 1.5 h a day, which is "many".
    assert.deepEqual(queueOutlook(33 * HOUR, at(2026, 12, 10)), { tone: 'many', perDaySeconds: 1.5 * HOUR });
    assert.equal(queueOutlook(33 * HOUR - 22, at(2026, 12, 10)).tone, 'clean');
    // On 31 December the whole queue is today's.
    assert.deepEqual(queueOutlook(24 * HOUR, at(2026, 12, 31)), { tone: 'many', perDaySeconds: 24 * HOUR });
    assert.equal(queueOutlook(24 * HOUR + 1, at(2026, 12, 31)).tone, 'much');
    assert.deepEqual(queueOutlook(0, at(2026, 12, 20)), { tone: 'clean', perDaySeconds: 0 });
  });
});

describe('medianDelay and listenerType', () => {
  it('takes the middle gap, the upper one for an even count', () => {
    assert.equal(medianDelay([5, 1, 3]), 3);
    assert.equal(medianDelay([4, 1, 3, 2]), 3);
    assert.equal(medianDelay([]), null);
    assert.equal(medianDelay([-1, Number.NaN]), null);
  });

  it('calls 2.5 days or less an addict', () => {
    assert.equal(listenerType(2.5 * DAY_MS), 'addict');
    assert.equal(listenerType(2.5 * DAY_MS + 1), 'easygoing');
  });
});

describe('hoarderVerdict', () => {
  it('uses AntennaPod’s 25 % and 75 % lines', () => {
    assert.deepEqual(hoarderVerdict(1, 5), { kind: 'hoarder', percent: 20 });
    assert.deepEqual(hoarderVerdict(1, 4), { kind: 'medium', percent: 25 });
    assert.deepEqual(hoarderVerdict(2, 3), { kind: 'medium', percent: 66 });
    assert.deepEqual(hoarderVerdict(3, 4), { kind: 'clean', percent: 75 });
    assert.deepEqual(hoarderVerdict(0, 0), { kind: 'hoarder', percent: 0 });
  });
});

describe('pickOne', () => {
  it('maps the seed across the list', () => {
    assert.equal(pickOne(['a', 'b', 'c'], 0), 'a');
    assert.equal(pickOne(['a', 'b', 'c'], 0.99), 'c');
    assert.equal(pickOne(['a'], 1), 'a');
    assert.equal(pickOne([], 0.5), undefined);
  });
});

describe('firstPlayMonth', () => {
  it('names the month only for a first play before this year', () => {
    assert.equal(firstPlayMonth('2024-03-17', 2026), 'March 2024');
    assert.equal(firstPlayMonth('2026-01-01', 2026), null);
    assert.equal(firstPlayMonth(null, 2026), null);
  });
});

describe('formatSpan and wholeHours', () => {
  it('reads like a sentence', () => {
    assert.equal(formatSpan(3 * DAY_MS), '3 days');
    assert.equal(formatSpan(26 * 3600_000), '26 hours');
    assert.equal(formatSpan(5 * 3600_000 + 20 * 60_000), '5 hours 20 minutes');
    assert.equal(formatSpan(60_000), '1 minute');
    assert.equal(formatSpan(0), '0 minutes');
    assert.equal(wholeHours(10 * HOUR - 1), 9);
  });
});

describe('shareText', () => {
  const echo: EchoYear = {
    year: 2026,
    listenedSeconds: 214 * HOUR + 50,
    podcastsPlayed: 18,
    queueSeconds: 0,
    queueEpisodes: 0,
    medianDelayMs: null,
    activeFeeds: 0,
    playedActiveFeeds: 0,
    unplayedActiveTitles: [],
    firstDay: null,
    top: [
      { id: 1, title: 'First', imageUrl: null, seconds: 10 },
      { id: 2, title: 'Second', imageUrl: null, seconds: 5 },
    ],
  };

  it('sums up the year and lists the favourites', () => {
    assert.equal(
      shareText(echo),
      'My year 2026 in podcasts: 214 hours from 18 podcasts.\n\nMy favourites:\n1. First\n2. Second\n\n#SagePodEcho'
    );
  });

  it('leaves the list out of an empty year', () => {
    assert.equal(
      shareText({ ...echo, listenedSeconds: HOUR, podcastsPlayed: 1, top: [] }),
      'My year 2026 in podcasts: 1 hour from 1 podcast.\n\n#SagePodEcho'
    );
  });
});
