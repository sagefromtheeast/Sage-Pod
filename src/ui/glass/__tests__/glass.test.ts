import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveBlurMethod } from '../resolveBlurMethod';

describe('Liquid Glass Segmented Physics & Boundary Math', () => {
  const calculateBucket = (
    touchX: number,
    trackWidth: number,
    numSegments: number
  ): { index: number; targetX: number } => {
    const segWidth = trackWidth / numSegments;
    const maxTranslate = segWidth * (numSegments - 1);
    const rawX = touchX - segWidth / 2;
    const clampedX = Math.max(0, Math.min(rawX, maxTranslate));
    const index = Math.round(clampedX / segWidth);
    const targetX = index * segWidth;
    return { index, targetX };
  };

  it('snaps accurately to the first segment on left-side taps', () => {
    const result = calculateBucket(20, 300, 3); // 3 segments, 100px each
    assert.equal(result.index, 0);
    assert.equal(result.targetX, 0);
  });

  it('snaps accurately to the middle segment on centered taps', () => {
    const result = calculateBucket(150, 300, 3);
    assert.equal(result.index, 1);
    assert.equal(result.targetX, 100);
  });

  it('snaps accurately to the last segment on right-side taps and clamps overflow', () => {
    const result = calculateBucket(290, 300, 3);
    assert.equal(result.index, 2);
    assert.equal(result.targetX, 200);

    const overflow = calculateBucket(500, 300, 3);
    assert.equal(overflow.index, 2);
    assert.equal(overflow.targetX, 200);
  });

  it('handles rounding at the exact boundary threshold', () => {
    // segWidth = 100. Bucket 0 is [0..50), Bucket 1 is [50..150)
    // rawX at touchX = 99 is 99 - 50 = 49 -> 49 / 100 = 0.49 -> round = 0
    const justBefore = calculateBucket(99, 300, 3);
    assert.equal(justBefore.index, 0);

    // rawX at touchX = 101 is 101 - 50 = 51 -> 51 / 100 = 0.51 -> round = 1
    const justAfter = calculateBucket(101, 300, 3);
    assert.equal(justAfter.index, 1);
  });
});

describe('resolveBlurMethod — Android Blur Method Fallback Logic', () => {
  it('falls back to "none" when blurTarget is not provided', () => {
    assert.equal(resolveBlurMethod(), 'none');
    assert.equal(resolveBlurMethod(undefined), 'none');
    assert.equal(resolveBlurMethod(undefined, 'dimezisBlurView'), 'none');
    assert.equal(resolveBlurMethod(undefined, 'dimezisBlurViewSdk31Plus'), 'none');
  });

  it('uses dimezisBlurView by default when blurTarget is provided', () => {
    const fakeRef = { current: null };
    assert.equal(resolveBlurMethod(fakeRef), 'dimezisBlurView');
  });

  it('preserves custom blurMethod when blurTarget is provided', () => {
    const fakeRef = { current: null };
    assert.equal(resolveBlurMethod(fakeRef, 'dimezisBlurViewSdk31Plus'), 'dimezisBlurViewSdk31Plus');
    assert.equal(resolveBlurMethod(fakeRef, 'none'), 'none');
  });
});

