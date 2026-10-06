import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { positionAfterPause, rewindSecondsAfterPause } from '../resumeRewind';
import {
  afterEpisodeFinished,
  describeTimer,
  extendTimer,
  fadeVolume,
  inHourWindow,
  pauseTimer,
  remainingMs,
  resumeTimer,
  SLEEP_WARNING_MS,
  startEpisodesTimer,
  startMinutesTimer,
} from '../sleepTimer';

const MIN = 60_000;

describe('minutes sleep timer', () => {
  it('counts down while playing', () => {
    const timer = startMinutesTimer(10, 0, true);
    assert.equal(remainingMs(timer, 4 * MIN), 6 * MIN);
  });

  it('does not count while paused', () => {
    const running = startMinutesTimer(10, 0, true);
    const paused = pauseTimer(running, 4 * MIN);
    // An hour of pause later, still 6 minutes left.
    assert.equal(remainingMs(paused, 64 * MIN), 6 * MIN);
    const resumed = resumeTimer(paused, 64 * MIN);
    assert.equal(remainingMs(resumed, 66 * MIN), 4 * MIN);
  });

  it('starts frozen when set while paused', () => {
    const timer = startMinutesTimer(15, 0, false);
    assert.equal(timer.kind === 'minutes' && timer.endsAt, null);
    assert.equal(remainingMs(timer, 99 * MIN), 15 * MIN);
  });

  it('pause and resume are idempotent', () => {
    const running = startMinutesTimer(5, 0, true);
    assert.deepEqual(resumeTimer(running, 1000), running);
    const paused = pauseTimer(running, MIN);
    assert.deepEqual(pauseTimer(paused, 2 * MIN), paused);
  });
});

describe('episodes sleep timer', () => {
  it('has no clock', () => {
    const timer = startEpisodesTimer(1);
    assert.equal(remainingMs(timer, 123), null);
    assert.deepEqual(pauseTimer(timer, 5), timer);
    assert.deepEqual(resumeTimer(timer, 5), timer);
  });

  it('stops after the last counted episode', () => {
    let state = afterEpisodeFinished(startEpisodesTimer(2));
    assert.equal(state.stop, false);
    assert.equal(state.timer?.kind === 'episodes' && state.timer.remaining, 1);
    state = afterEpisodeFinished(state.timer!);
    assert.deepEqual(state, { timer: null, stop: true });
  });

  it('ignores minutes timers', () => {
    const timer = startMinutesTimer(5, 0, true);
    assert.deepEqual(afterEpisodeFinished(timer), { timer, stop: false });
  });
});

describe('extend, fade and auto-enable window', () => {
  it('extends minutes (running or paused) and episodes', () => {
    const running = extendTimer(startMinutesTimer(1, 0, true), 5);
    assert.equal(remainingMs(running, 0), 6 * MIN);
    const paused = extendTimer(startMinutesTimer(1, 0, false), 10);
    assert.equal(remainingMs(paused, 0), 11 * MIN);
    const episodes = extendTimer(startEpisodesTimer(1), 1);
    assert.equal(episodes.kind === 'episodes' && episodes.remaining, 2);
  });

  it('fades from full volume to 0.1 over the last 10 s', () => {
    assert.equal(fadeVolume(SLEEP_WARNING_MS), 1);
    assert.equal(fadeVolume(0), 0.1);
    assert.ok(Math.abs(fadeVolume(5_000) - 0.55) < 1e-9);
  });

  it('handles windows that wrap midnight', () => {
    assert.equal(inHourWindow(23, 22, 6), true);
    assert.equal(inHourWindow(3, 22, 6), true);
    assert.equal(inHourWindow(12, 22, 6), false);
    assert.equal(inHourWindow(9, 8, 17), true);
    assert.equal(inHourWindow(17, 8, 17), false);
  });
});

describe('timer labels', () => {
  it('describes episodes and minutes timers', () => {
    assert.deepEqual(describeTimer(startEpisodesTimer(1), 0), { short: 'End', long: 'Pauses at the end of this episode' });
    assert.equal(describeTimer(startEpisodesTimer(3), 0).short, '3 ep');
    assert.deepEqual(describeTimer(startMinutesTimer(10, 0, true), 4 * MIN + 1), { short: '6m', long: 'Pauses in 6 min' });
    assert.equal(describeTimer(startMinutesTimer(10, 0, false), 0).long, 'Pauses in 10 min of listening');
    assert.equal(describeTimer(startMinutesTimer(1, 0, true), 15_500).short, '45s');
  });
});

describe('rewind after pause (AntennaPod scale)', () => {
  it('scales with the pause length', () => {
    assert.equal(rewindSecondsAfterPause(0), 0);
    assert.equal(rewindSecondsAfterPause(5_000), 0.8);
    assert.equal(rewindSecondsAfterPause(2 * MIN), 3);
    assert.equal(rewindSecondsAfterPause(2 * 60 * MIN), 10);
    assert.equal(rewindSecondsAfterPause(2 * 24 * 60 * MIN), 20);
  });

  it('never rewinds before the start', () => {
    assert.equal(positionAfterPause(2, 2 * 24 * 60 * MIN), 0);
    assert.equal(positionAfterPause(0, 2 * 24 * 60 * MIN), 0);
    assert.equal(positionAfterPause(100, 2 * MIN), 97);
  });
});
