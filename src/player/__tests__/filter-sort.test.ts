import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatBytes, shouldAutoDownloadEpisode } from '../downloadRules';
import { sortQueueEpisodes } from '../queueSorting';

describe('shouldAutoDownloadEpisode — AntennaPod-style Auto-Download Filter Rules', () => {
  it('allows normal full-length episodes', () => {
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Episode 101: The Deep Dive', duration: 3600 }),
      true
    );
  });

  it('rejects episodes with promo, trailer, or teaser in title', () => {
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Season 2 Official Trailer', duration: 120 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: '[Trailer] Welcome to our show', duration: 300 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Special Promo: Summer Series', duration: 400 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Quick Teaser for Friday', duration: 500 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Sneak Peek: Inside the Lab', duration: 600 }),
      false
    );
  });

  it('rejects micro-episodes under 3 minutes (180 seconds)', () => {
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Quick update', duration: 179 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Short clip', duration: 60 }),
      false
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Regular episode', duration: 180 }),
      true
    );
  });

  it('permits episodes where duration is unknown or null', () => {
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Live Broadcast without duration header', duration: null }),
      true
    );
    assert.equal(
      shouldAutoDownloadEpisode({ title: 'Unknown duration episode', duration: 0 }),
      true
    );
  });
});

describe('formatBytes — Storage Size Formatting', () => {
  it('formats byte numbers properly', () => {
    assert.equal(formatBytes(0), '0 MB');
    assert.equal(formatBytes(null), '0 MB');
    assert.equal(formatBytes(500), '500 B');
    assert.equal(formatBytes(2048), '2 KB');
    assert.equal(formatBytes(10 * 1024 * 1024), '10 MB');
    assert.equal(formatBytes(1.5 * 1024 * 1024 * 1024), '1.5 GB');
  });
});

describe('sortQueueEpisodes — Queue Batch Sorting & Reordering', () => {
  const sampleEpisodes = [
    {
      id: 1,
      feed_title: 'Zeta Podcast',
      duration: 3600,
      position: 3000, // 600s remaining
      published_at: 1000,
    },
    {
      id: 2,
      feed_title: 'Alpha Podcast',
      duration: 1800,
      position: 0, // 1800s remaining
      published_at: 3000,
    },
    {
      id: 3,
      feed_title: 'Beta Podcast',
      duration: 600,
      position: 100, // 500s remaining
      published_at: 2000,
    },
  ];

  it('sorts by duration remaining ascending (shortest remaining first)', () => {
    // ep 3 has 500s remaining, ep 1 has 600s remaining, ep 2 has 1800s remaining
    const sorted = sortQueueEpisodes(sampleEpisodes, 'duration_remaining_asc');
    assert.deepEqual(sorted, [3, 1, 2]);
  });

  it('sorts by total duration descending (longest first)', () => {
    // ep 1 (3600s), ep 2 (1800s), ep 3 (600s)
    const sorted = sortQueueEpisodes(sampleEpisodes, 'duration_desc');
    assert.deepEqual(sorted, [1, 2, 3]);
  });

  it('sorts by publish date descending (newest first)', () => {
    // ep 2 (3000), ep 3 (2000), ep 1 (1000)
    const sorted = sortQueueEpisodes(sampleEpisodes, 'date_desc');
    assert.deepEqual(sorted, [2, 3, 1]);
  });

  it('sorts by publish date ascending (oldest first)', () => {
    // ep 1 (1000), ep 3 (2000), ep 2 (3000)
    const sorted = sortQueueEpisodes(sampleEpisodes, 'date_asc');
    assert.deepEqual(sorted, [1, 3, 2]);
  });

  it('sorts by podcast title ascending (A-Z)', () => {
    // Alpha (ep 2), Beta (ep 3), Zeta (ep 1)
    const sorted = sortQueueEpisodes(sampleEpisodes, 'podcast_title_asc');
    assert.deepEqual(sorted, [2, 3, 1]);
  });

  it('shuffles the episodes while preserving all items', () => {
    const shuffled = sortQueueEpisodes(sampleEpisodes, 'shuffle');
    assert.equal(shuffled.length, sampleEpisodes.length);
    assert.ok(shuffled.includes(1));
    assert.ok(shuffled.includes(2));
    assert.ok(shuffled.includes(3));
  });
});
