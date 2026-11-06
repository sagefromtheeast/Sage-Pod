import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pagerIds, recallPagerList, rememberPagerList } from '../pagerList';

describe('pagerIds', () => {
  it('follows the source list when it holds the episode', () => {
    assert.deepEqual(pagerIds([5, 3, 9], 3, [1, 2, 3]), [5, 3, 9]);
  });

  it('falls back to the podcast for a deep link or a list without the episode', () => {
    assert.deepEqual(pagerIds(null, 3, [1, 2, 3]), [1, 2, 3]);
    assert.deepEqual(pagerIds([5, 9], 3, [1, 2, 3]), [1, 2, 3]);
  });

  it('waits while nothing holds the episode', () => {
    assert.equal(pagerIds(null, 3, null), null);
    assert.equal(pagerIds(null, 3, [1, 2]), null);
  });
});

describe('rememberPagerList', () => {
  it('hands back a copy by token, and nothing for an unknown one', () => {
    const ids = [1, 2, 3];
    const token = rememberPagerList(ids);
    ids.push(4);
    assert.deepEqual(recallPagerList(token), [1, 2, 3]);
    assert.equal(recallPagerList('nope'), null);
    assert.equal(recallPagerList(undefined), null);
  });

  it('keeps only the last ten lists', () => {
    const first = rememberPagerList([1]);
    for (let i = 0; i < 10; i++) rememberPagerList([i]);
    assert.equal(recallPagerList(first), null);
  });
});
