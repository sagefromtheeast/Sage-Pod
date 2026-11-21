import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isTall } from '../layout';

describe('widget layout', () => {
  it('stays one row at its default 4 x 1 size', () => {
    assert.equal(isTall(320, 70), false);
  });

  it('gives the buttons their own row when resized taller', () => {
    assert.equal(isTall(320, 150), true);
    assert.equal(isTall(250, 120), true);
  });

  it('keeps one row when too narrow for four buttons', () => {
    assert.equal(isTall(200, 200), false);
  });
});
