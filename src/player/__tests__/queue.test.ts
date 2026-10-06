import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canKeepSorted,
  dropIndex,
  enqueueIndex,
  moveItem,
  parseQueueSort,
  queueTimeLeft,
  serializeQueueSort,
  sortOrdersAt,
  sortQueue,
  type SortableEpisode,
} from '../queueSorting';

const ep = (
  id: number,
  feed: [number, string],
  published: number,
  duration: number,
  position = 0,
  title = `Episode ${id}`
): SortableEpisode => ({
  id,
  title,
  duration,
  position,
  published_at: published,
  feed_id: feed[0],
  feed_title: feed[1],
});

const ZETA: [number, string] = [1, 'Zeta Podcast'];
const ALPHA: [number, string] = [2, 'alpha podcast'];
const BETA: [number, string] = [3, 'Beta Podcast'];

const queue = [
  ep(1, ZETA, 1000, 3600, 3000, 'Charlie'), // 600 s left
  ep(2, ALPHA, 3000, 1800, 0, 'alpha'), // 1800 s left
  ep(3, BETA, 2000, 600, 100, 'Bravo'), // 500 s left
];

describe('queue sort orders', () => {
  it('sorts by date, duration and time left in both directions', () => {
    assert.deepEqual(sortQueue(queue, { key: 'date', descending: true }), [2, 3, 1]);
    assert.deepEqual(sortQueue(queue, { key: 'date', descending: false }), [1, 3, 2]);
    assert.deepEqual(sortQueue(queue, { key: 'duration', descending: true }), [1, 2, 3]);
    assert.deepEqual(sortQueue(queue, { key: 'duration', descending: false }), [3, 2, 1]);
    assert.deepEqual(sortQueue(queue, { key: 'remaining', descending: false }), [3, 1, 2]);
    assert.deepEqual(sortQueue(queue, { key: 'remaining', descending: true }), [2, 1, 3]);
  });

  it('sorts titles case-insensitively, and a podcast oldest first', () => {
    assert.deepEqual(sortQueue(queue, { key: 'episodeTitle', descending: false }), [2, 3, 1]);
    assert.deepEqual(sortQueue(queue, { key: 'podcastTitle', descending: false }), [2, 3, 1]);
    assert.deepEqual(sortQueue(queue, { key: 'podcastTitle', descending: true }), [1, 3, 2]);
    const sameShow = [ep(7, BETA, 50, 1), ep(8, BETA, 10, 1)];
    assert.deepEqual(sortQueue(sameShow, { key: 'podcastTitle', descending: true }), [8, 7]);
  });

  it('smart shuffle takes one episode from each podcast in turn, in date order', () => {
    const many = [
      ep(1, ZETA, 1, 1),
      ep(2, ZETA, 2, 1),
      ep(3, ZETA, 3, 1),
      ep(4, ALPHA, 4, 1),
      ep(5, ALPHA, 5, 1),
      ep(6, BETA, 6, 1),
    ];
    assert.deepEqual(sortQueue(many, { key: 'smartShuffle', descending: false }), [1, 4, 6, 2, 5, 3]);
    assert.deepEqual(sortQueue(many, { key: 'smartShuffle', descending: true }), [6, 5, 3, 4, 2, 1]);
  });

  it('shuffles with the given random source and keeps every episode', () => {
    const ids = sortQueue(queue, { key: 'random', descending: false }, () => 0);
    assert.deepEqual([...ids].sort(), [1, 2, 3]);
    assert.deepEqual(ids, [2, 3, 1]);
  });

  it('round-trips the keep-sorted setting and refuses to keep a random order', () => {
    assert.deepEqual(parseQueueSort('date:desc'), { key: 'date', descending: true });
    assert.equal(serializeQueueSort({ key: 'remaining', descending: false }), 'remaining:asc');
    assert.equal(parseQueueSort(''), null);
    assert.equal(parseQueueSort('nonsense:asc'), null);
    assert.equal(serializeQueueSort(null), '');
    assert.equal(canKeepSorted({ key: 'random', descending: false }), false);
    assert.equal(canKeepSorted({ key: 'smartShuffle', descending: false }), true);
  });
});

describe('enqueue location', () => {
  const ids = [10, 11, 12];
  it('places at the back, front, after the playing episode, or at random', () => {
    assert.equal(enqueueIndex('back', ids, null), 3);
    assert.equal(enqueueIndex('front', ids, 11), 0);
    assert.equal(enqueueIndex('afterCurrent', ids, 11), 2);
    assert.equal(enqueueIndex('afterCurrent', ids, 99), 0); // playing episode isn't queued
    assert.equal(enqueueIndex('afterCurrent', ids, null), 0);
    assert.equal(enqueueIndex('random', ids, null, () => 0.99), 3);
    assert.equal(enqueueIndex('random', ids, null, () => 0), 0);
    assert.equal(enqueueIndex('whatever', ids, null), 3);
  });

  it('picks sort orders between neighbours without renumbering', () => {
    assert.deepEqual(sortOrdersAt([], 0), [0]);
    assert.deepEqual(sortOrdersAt([1, 2, 3], 0), [0]);
    assert.deepEqual(sortOrdersAt([1, 2, 3], 3), [4]);
    assert.deepEqual(sortOrdersAt([1, 2, 3], 1), [1.5]);
  });

  it('keeps a batch in order wherever it is inserted', () => {
    assert.deepEqual(sortOrdersAt([], 0, 3), [0, 1, 2]);
    assert.deepEqual(sortOrdersAt([5, 6], 0, 3), [2, 3, 4]);
    assert.deepEqual(sortOrdersAt([5, 6], 2, 2), [7, 8]);
    assert.deepEqual(sortOrdersAt([1, 2], 1, 3), [1.25, 1.5, 1.75]);
  });
});

describe('queue time left', () => {
  it('divides each episode by the speed it will play at', () => {
    const left = queueTimeLeft(
      [
        { duration: 3600, position: 600, feed_playback_speed: null }, // 3000 s at 1.5× → 2000
        { duration: 1200, position: 0, feed_playback_speed: 2 }, // 1200 s at 2× → 600
        { duration: null, position: 0, feed_playback_speed: null },
        { duration: 100, position: 500, feed_playback_speed: null }, // past the end → 0
      ],
      1.5
    );
    assert.equal(left, 2600);
  });
});

describe('drag to reorder', () => {
  const heights = [80, 80, 120, 80];
  it('takes a neighbour slot once past its midpoint', () => {
    assert.equal(dropIndex(heights, 0, 0), 0);
    assert.equal(dropIndex(heights, 0, 40), 0);
    assert.equal(dropIndex(heights, 0, 41), 1);
    assert.equal(dropIndex(heights, 0, 80 + 61), 2);
    assert.equal(dropIndex(heights, 0, 9999), 3);
    assert.equal(dropIndex(heights, 3, -61), 2);
    assert.equal(dropIndex(heights, 3, -9999), 0);
  });

  it('moves an item to its new index', () => {
    assert.deepEqual(moveItem([1, 2, 3, 4], 0, 2), [2, 3, 1, 4]);
    assert.deepEqual(moveItem([1, 2, 3, 4], 3, 0), [4, 1, 2, 3]);
    assert.deepEqual(moveItem([1, 2, 3], 1, 1), [1, 2, 3]);
  });
});
