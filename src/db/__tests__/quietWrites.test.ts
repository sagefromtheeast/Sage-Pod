import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { positionSaveIsQuiet, QUIET_WRITE_TTL_MS, QuietRows, STARTED_SECONDS } from '../quietWrites';

describe('QuietRows', () => {
  it('drops exactly one event per expectation', () => {
    const rows = new QuietRows();
    rows.expect('episodes', 7, 0);
    assert.equal(rows.claim('episodes', 7, 10), true);
    assert.equal(rows.claim('episodes', 7, 20), false);
  });

  it('only drops the expected row of the expected table', () => {
    const rows = new QuietRows();
    rows.expect('episodes', 7, 0);
    assert.equal(rows.claim('episodes', 8, 10), false);
    assert.equal(rows.claim('queue', 7, 10), false);
    assert.equal(rows.claim('episodes', 7, 10), true);
  });

  it('forgets an expectation whose event never came', () => {
    const rows = new QuietRows();
    rows.expect('episodes', 7, 0);
    assert.equal(rows.claim('episodes', 7, QUIET_WRITE_TTL_MS + 1), false);
  });

  it('withdraws a cancelled expectation, so a later real change is heard', () => {
    const rows = new QuietRows();
    rows.expect('episodes', 7, 0);
    rows.cancel('episodes', 7);
    assert.equal(rows.claim('episodes', 7, 10), false);
  });

  it('counts overlapping expectations separately', () => {
    const rows = new QuietRows();
    rows.expect('episodes', 7, 0);
    rows.expect('episodes', 7, 5);
    assert.equal(rows.claim('episodes', 7, 10), true);
    assert.equal(rows.claim('episodes', 7, 10), true);
    assert.equal(rows.claim('episodes', 7, 10), false);
  });
});

describe('positionSaveIsQuiet', () => {
  const listening = { is_new: 0, position: 600, duration: 3600 };

  it('is quiet mid-episode, where no list changes', () => {
    assert.equal(positionSaveIsQuiet(listening, 605, 3600), true);
  });

  it('is heard on the first save, which takes the episode out of the Inbox', () => {
    assert.equal(positionSaveIsQuiet({ ...listening, is_new: 1 }, 605, 3600), false);
  });

  it('is heard when the episode first gets a position, or becomes started', () => {
    assert.equal(positionSaveIsQuiet({ ...listening, position: 0 }, 5, 3600), false);
    assert.equal(
      positionSaveIsQuiet({ ...listening, position: STARTED_SECONDS - 2 }, STARTED_SECONDS + 3, 3600),
      false
    );
  });

  it('is heard when the duration becomes known', () => {
    assert.equal(positionSaveIsQuiet({ ...listening, duration: null }, 605, 3600), false);
    assert.equal(positionSaveIsQuiet({ ...listening, duration: null }, 605, null), true);
  });

  it('is heard for an episode it cannot find', () => {
    assert.equal(positionSaveIsQuiet(null, 605, 3600), false);
  });
});
