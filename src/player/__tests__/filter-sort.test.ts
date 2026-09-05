import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  fileNameFor,
  formatBytes,
  guessExtension,
  shouldAutoDownloadEpisode,
} from '../downloadRules';
import { sortQueueEpisodes } from '../queueSorting';
import { classifyDownloadError } from '../types';

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

describe('fileNameFor & guessExtension — Download File Naming & Extension Resolution', () => {
  it('extracts audio extension directly from simple media URL', () => {
    assert.equal(
      fileNameFor({ id: 10, media_url: 'https://cdn.example.com/audio/ep10.mp3' }),
      'episode-10.mp3'
    );
    assert.equal(
      fileNameFor({ id: 11, media_url: 'https://cdn.example.com/audio/ep11.m4a' }),
      'episode-11.m4a'
    );
    assert.equal(
      fileNameFor({ id: 12, media_url: 'https://cdn.example.com/audio/EP12.OGG' }),
      'episode-12.ogg'
    );
  });

  it('strips query parameters and hash anchors when parsing extension', () => {
    assert.equal(
      fileNameFor({
        id: 42,
        media_url: 'https://dts.podtrac.com/redirect.mp3/example.com/ep42.mp3?token=abc123xyz#t=0',
      }),
      'episode-42.mp3'
    );
  });

  it('falls back to MIME type when URL has no audio extension or uses script/endpoint', () => {
    assert.equal(
      fileNameFor({
        id: 99,
        media_url: 'https://example.com/stream.php?id=99',
        media_type: 'audio/mpeg',
      }),
      'episode-99.mp3'
    );
    assert.equal(
      fileNameFor({
        id: 100,
        media_url: 'https://example.com/listen?episode=100',
        media_type: 'audio/mp4',
      }),
      'episode-100.m4a'
    );
    assert.equal(
      fileNameFor({
        id: 101,
        media_url: 'https://example.com/download/101',
        media_type: 'audio/flac',
      }),
      'episode-101.flac'
    );
  });

  it('correctly maps known MIME types and defaults to mp3 for unknown', () => {
    assert.equal(guessExtension('audio/mpeg'), 'mp3');
    assert.equal(guessExtension('audio/mp3'), 'mp3');
    assert.equal(guessExtension('audio/aac'), 'm4a');
    assert.equal(guessExtension('audio/x-m4a'), 'm4a');
    assert.equal(guessExtension('audio/ogg'), 'ogg');
    assert.equal(guessExtension('audio/opus'), 'opus');
    assert.equal(guessExtension('audio/wav'), 'wav');
    assert.equal(guessExtension('audio/x-wav'), 'wav');
    assert.equal(guessExtension('audio/flac'), 'flac');
    assert.equal(guessExtension(null), 'mp3');
    assert.equal(guessExtension('unknown/format'), 'mp3');
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

describe('classifyDownloadError — AntennaPod-style Error Taxonomy', () => {
  it('identifies 404 / not found as fatal non-retryable NOT_FOUND', () => {
    const res = classifyDownloadError(new Error('HTTP status 404: Not Found'));
    assert.equal(res.code, 'NOT_FOUND');
    assert.equal(res.isRetryable, false);
    assert.equal(res.httpStatus, 404);
  });

  it('identifies 403 / forbidden as fatal non-retryable FORBIDDEN', () => {
    const res = classifyDownloadError(new Error('Server responded with 403 Forbidden'));
    assert.equal(res.code, 'FORBIDDEN');
    assert.equal(res.isRetryable, false);
  });

  it('identifies 401 / unauthorized as fatal non-retryable UNAUTHORIZED', () => {
    const res = classifyDownloadError(new Error('401 Unauthorized for private feed'));
    assert.equal(res.code, 'UNAUTHORIZED');
    assert.equal(res.isRetryable, false);
  });

  it('identifies captive portal / html response as fatal non-retryable CAPTIVE_PORTAL', () => {
    const res = classifyDownloadError(
      new Error('A captive Wi-Fi login page or HTML error was received instead of audio.')
    );
    assert.equal(res.code, 'CAPTIVE_PORTAL');
    assert.equal(res.isRetryable, false);
  });

  it('identifies storage space full as fatal non-retryable INSUFFICIENT_SPACE', () => {
    const res = classifyDownloadError(new Error('ENOSPC: no space left on device'));
    assert.equal(res.code, 'INSUFFICIENT_SPACE');
    assert.equal(res.isRetryable, false);
  });

  it('identifies truncated / premature stream end as retryable CORRUPTED_STREAM', () => {
    const res = classifyDownloadError(new Error('Download stream truncated: received 500 of 1000 bytes.'));
    assert.equal(res.code, 'CORRUPTED_STREAM');
    assert.equal(res.isRetryable, true);
  });

  it('identifies network socket timeouts as retryable NETWORK_TIMEOUT', () => {
    const res = classifyDownloadError(new Error('Network request failed: socket timeout'));
    assert.equal(res.code, 'NETWORK_TIMEOUT');
    assert.equal(res.isRetryable, true);
  });
});
