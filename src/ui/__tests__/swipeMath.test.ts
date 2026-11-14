import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { armProgress, commitDistance, releaseDirection, rowOffset } from '../swipeMath';

describe('commitDistance', () => {
  it('is a third of a phone row, held between 72 and 160', () => {
    assert.equal(commitDistance(390), 390 * 0.33);
    assert.equal(commitDistance(100), 72);
    assert.equal(commitDistance(1200), 160);
  });
});

describe('rowOffset', () => {
  it('follows the finger up to the commit point', () => {
    assert.equal(rowOffset(60, true, true, 390), 60);
    assert.equal(rowOffset(-60, true, true, 390), -60);
  });

  it('slows down past the commit point', () => {
    const limit = commitDistance(390);
    assert.ok(Math.abs(rowOffset(limit + 100, true, true, 390) - (limit + 60)) < 1e-9);
  });

  it('only rubber-bands toward a side with no action', () => {
    assert.equal(rowOffset(200, false, true, 390), 16);
    assert.equal(rowOffset(-40, true, false, 390), -6);
  });

  it('never goes past the row', () => {
    assert.equal(rowOffset(5000, true, true, 390), 390);
  });
});

describe('releaseDirection', () => {
  it('commits past the commit point', () => {
    assert.equal(releaseDirection(140, 0, true, true, 390), 'right');
    assert.equal(releaseDirection(-140, 0, true, true, 390), 'left');
  });

  it('springs back when short', () => {
    assert.equal(releaseDirection(60, 0, true, true, 390), null);
  });

  it('lets a fast flick commit from halfway', () => {
    assert.equal(releaseDirection(70, 1500, true, true, 390), 'right');
    // A flick back toward the middle is a change of mind.
    assert.equal(releaseDirection(70, -1500, true, true, 390), null);
  });

  it('never commits toward a side with no action', () => {
    assert.equal(releaseDirection(200, 0, false, true, 390), null);
  });
});

describe('armProgress', () => {
  it('runs from 0 to 1 and stops there', () => {
    assert.equal(armProgress(0, 390), 0);
    assert.equal(armProgress(-commitDistance(390), 390), 1);
    assert.equal(armProgress(1000, 390), 1);
  });
});
