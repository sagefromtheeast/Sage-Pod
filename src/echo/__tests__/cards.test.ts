import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { echoCards } from '../cards';
import type { EchoYear } from '../echo';

const HOUR = 3600;
const DAY_MS = 24 * 3600 * 1000;
const now = new Date(2026, 11, 10, 12).getTime();

const year: EchoYear = {
  year: 2026,
  listenedSeconds: 214 * HOUR,
  podcastsPlayed: 18,
  queueSeconds: 11 * HOUR,
  queueEpisodes: 9,
  medianDelayMs: 4 * DAY_MS,
  activeFeeds: 10,
  playedActiveFeeds: 5,
  unplayedActiveTitles: ['Quiet Show', 'Other Show'],
  firstDay: '2024-03-17',
  top: [],
};

const card = (echo: EchoYear, key: string, seed = 0) => echoCards(echo, now, seed).find((c) => c.key === key)!;

describe('echoCards', () => {
  it('has the six text cards in AntennaPod’s order', () => {
    assert.deepEqual(
      echoCards(year, now, 0).map((c) => c.key),
      ['intro', 'hours', 'queue', 'delay', 'hoarder', 'thanks']
    );
  });

  it('counts hours and podcasts', () => {
    const hours = card(year, 'hours');
    assert.equal(hours.large, '214');
    assert.equal(hours.below, 'hours of episodes\nfrom 18 different podcasts');
    assert.equal(
      card({ ...year, listenedSeconds: HOUR, podcastsPlayed: 1 }, 'hours').below,
      'hour of episodes\nfrom 1 podcast'
    );
  });

  it('spreads the queue over the rest of the year', () => {
    // 11 h over 22 days is 30 minutes a day: a clean start.
    const queue = card(year, 'queue');
    assert.equal(queue.large, '11');
    assert.match(queue.above, /clean start/);
    assert.equal(queue.small, 'That’s about 30 minutes each day until 2027 starts.');
    assert.match(card({ ...year, queueSeconds: 100 * HOUR }, 'queue').small, /skip a few episodes\.$/);
    assert.match(card({ ...year, queueSeconds: 1000 * HOUR }, 'queue').small, /Wait, what\?$/);
  });

  it('judges the delay, or says it is too early', () => {
    assert.equal(card(year, 'delay').below, 'You’re easy going');
    assert.equal(card(year, 'delay').small, 'Typically, you finished an episode 4 days after it came out.');
    assert.equal(card({ ...year, medianDelayMs: DAY_MS }, 'delay').large, '🏃');
    assert.equal(card({ ...year, medianDelayMs: null }, 'delay').below, 'Too early to tell');
  });

  it('suggests an unplayed podcast to a medium listener', () => {
    assert.match(card(year, 'hoarder', 0).small, /50% of your 10 active subscriptions.*“Quiet Show”/);
    assert.match(card(year, 'hoarder', 0.9).small, /“Other Show”/);
    assert.equal(card({ ...year, playedActiveFeeds: 1 }, 'hoarder').large, '🗄️');
    assert.equal(card({ ...year, playedActiveFeeds: 9 }, 'hoarder').below, 'Clean!');
    assert.equal(card({ ...year, activeFeeds: 0, playedActiveFeeds: 0 }, 'hoarder').below, 'Nothing to count');
  });

  it('thanks an old listener and welcomes a new one', () => {
    assert.match(card(year, 'thanks').below, /in March 2024/);
    assert.match(card({ ...year, firstDay: '2026-02-01' }, 'thanks').below, /^for joining Sage Pod/);
  });
});
