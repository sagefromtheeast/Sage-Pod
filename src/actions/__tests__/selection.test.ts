import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pruneSelection, selectRange, toggleSelected } from '../selection';

const ids = [10, 20, 30, 40, 50];

describe('selection', () => {
  it('toggles an id in and out', () => {
    const once = toggleSelected(new Set(), 20);
    assert.deepEqual([...once], [20]);
    assert.deepEqual([...toggleSelected(once, 20)], []);
  });

  it('selects everything above the anchor, inclusive', () => {
    assert.deepEqual([...selectRange(ids, new Set(), 30, 'above')].sort(), [10, 20, 30]);
  });

  it('selects everything below the anchor and keeps what was selected', () => {
    assert.deepEqual([...selectRange(ids, new Set([10]), 40, 'below')].sort(), [10, 40, 50]);
  });

  it('ignores an anchor that is not in the list', () => {
    assert.deepEqual([...selectRange(ids, new Set([10]), 99, 'above')], [10]);
  });

  it('prunes ids that left the list', () => {
    assert.deepEqual([...pruneSelection([10, 30], new Set([10, 20, 30]))].sort(), [10, 30]);
  });

  it('returns the same set when nothing was pruned (no re-render loop)', () => {
    const selected = new Set([10, 30]);
    assert.equal(pruneSelection(ids, selected), selected);
    const empty = new Set<number>();
    assert.equal(pruneSelection([], empty), empty);
  });
});
