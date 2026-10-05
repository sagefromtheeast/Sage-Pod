import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { gridColumns, gridTileSize, layoutFor, windowClass } from '../layout';
import { MAX_CONTENT_WIDTH } from '../theme';

describe('windowClass', () => {
  it('splits at 600 and 840', () => {
    assert.equal(windowClass(360), 'compact');
    assert.equal(windowClass(599), 'compact');
    assert.equal(windowClass(600), 'medium');
    assert.equal(windowClass(839), 'medium');
    assert.equal(windowClass(840), 'expanded');
  });
});

describe('gridColumns', () => {
  it('never drops below 3 or above 8', () => {
    assert.equal(gridColumns(100), 3);
    assert.equal(gridColumns(5000), 8);
  });
});

describe('gridTileSize', () => {
  it('fills the width exactly once gaps are accounted for', () => {
    const size = gridTileSize(600, 4, 12);
    assert.ok(size * 4 + 12 * 3 <= 600);
  });
});

describe('layoutFor', () => {
  it('keeps the phone grid at 3 columns, as before', () => {
    const phone = layoutFor(360);
    assert.equal(phone.windowClass, 'compact');
    assert.equal(phone.columns, 3);
  });

  it('gives the ~690dp tablet 4 columns and larger tiles', () => {
    const tablet = layoutFor(690);
    assert.equal(tablet.windowClass, 'medium');
    assert.equal(tablet.columns, 4);
    assert.ok(tablet.feedTile > layoutFor(360).feedTile);
  });

  it('caps and centres content on very wide windows', () => {
    const wide = layoutFor(1280);
    assert.equal(wide.contentWidth, MAX_CONTENT_WIDTH);
    assert.ok(wide.columns >= 5 && wide.columns <= 8);
  });

  it('keeps every tile at least the minimum size once columns are chosen', () => {
    for (const width of [360, 600, 690, 840, 1024, 1280]) {
      const { tileSize, columns } = layoutFor(width);
      assert.ok(columns === 3 || tileSize >= 150, `width ${width}: ${columns} cols @ ${tileSize}`);
    }
  });
});
