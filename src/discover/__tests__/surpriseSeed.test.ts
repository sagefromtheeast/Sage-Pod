import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SURPRISE_MODULUS,
  getSurpriseSeed,
  nextSeed,
  shuffleSurprise,
  subscribeSurpriseSeed,
} from '../surpriseSeed';

describe('nextSeed', () => {
  it('stays within [1, modulus - 1] at both ends of the random range', () => {
    assert.equal(nextSeed(null, () => 0), 1);
    assert.equal(nextSeed(null, () => 0.999999999), SURPRISE_MODULUS - 1);
  });

  it('never repeats the previous seed', () => {
    assert.notEqual(nextSeed(1, () => 0), 1);
    const top = SURPRISE_MODULUS - 1;
    const wrapped = nextSeed(top, () => 0.999999999);
    assert.notEqual(wrapped, top);
    assert.ok(wrapped >= 1 && wrapped < SURPRISE_MODULUS);
  });
});

describe('surprise seed store', () => {
  it('holds still until shuffled, then notifies subscribers', () => {
    const before = getSurpriseSeed();
    assert.equal(getSurpriseSeed(), before);

    let notified = 0;
    const unsubscribe = subscribeSurpriseSeed(() => notified++);
    shuffleSurprise();
    const afterShuffle = getSurpriseSeed();
    unsubscribe();
    shuffleSurprise();

    assert.notEqual(afterShuffle, before);
    assert.equal(notified, 1);
  });
});
