import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { positionAfterPause, rewindSecondsAfterPause } from '../resumeRewind';
import { pauseTimer, remainingMs, resumeTimer, startMinutesTimer } from '../sleepTimer';

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

describe('end-of-episode sleep timer', () => {
  it('has no clock', () => {
    const timer = { kind: 'endOfEpisode' } as const;
    assert.equal(remainingMs(timer, 123), null);
    assert.deepEqual(pauseTimer(timer, 5), timer);
    assert.deepEqual(resumeTimer(timer, 5), timer);
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
