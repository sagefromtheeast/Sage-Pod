import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  logDetails,
  matchesDownloadSearch,
  parseDownloadSort,
  playedToDelete,
  sortDownloads,
  type DownloadLogRow,
} from '../downloadView';

const ep = (id: number, title: string, published_at: number, duration: number | null, bytes: number | null) => ({
  id,
  title,
  published_at,
  duration,
  downloaded_bytes: bytes,
  media_size: null,
});

const EPISODES = [ep(1, 'Episode 10', 300, 60, 5), ep(2, 'episode 9', 100, 600, null), ep(3, 'Alpha', 200, 60, 50)];

describe('download sort', () => {
  it('orders by date, title (numeric, no case), duration and size in both directions', () => {
    assert.deepEqual(sortDownloads(EPISODES, 'date:desc').map((e) => e.id), [1, 3, 2]);
    assert.deepEqual(sortDownloads(EPISODES, 'date:asc').map((e) => e.id), [2, 3, 1]);
    assert.deepEqual(sortDownloads(EPISODES, 'title:asc').map((e) => e.id), [3, 2, 1]);
    assert.deepEqual(sortDownloads(EPISODES, 'duration:desc').map((e) => e.id), [2, 1, 3]);
    assert.deepEqual(sortDownloads(EPISODES, 'size:asc').map((e) => e.id), [2, 1, 3]);
  });

  it('breaks ties newest first and falls back to newest first for unknown sorts', () => {
    assert.deepEqual(sortDownloads(EPISODES, 'duration:asc').map((e) => e.id), [1, 3, 2]);
    assert.equal(parseDownloadSort('bogus'), 'date:desc');
    assert.equal(parseDownloadSort('size:asc'), 'size:asc');
  });
});

describe('delete played and search', () => {
  it('keeps unplayed and favourite downloads', () => {
    const list = [
      { id: 1, is_played: 1, is_favorite: 0 },
      { id: 2, is_played: 1, is_favorite: 1 },
      { id: 3, is_played: 0, is_favorite: 0 },
    ];
    assert.deepEqual(playedToDelete(list).map((e) => e.id), [1]);
  });

  it('matches every word across episode and podcast titles', () => {
    const episode = { title: 'Following the river', feed_title: 'Field Notes' };
    assert.equal(matchesDownloadSearch(episode, 'river FIELD'), true);
    assert.equal(matchesDownloadSearch(episode, 'river sea'), false);
    assert.equal(matchesDownloadSearch(episode, '  '), true);
  });
});

describe('log details', () => {
  it('lists what a bug report needs, skipping empty fields', () => {
    const entry: DownloadLogRow = {
      id: 1,
      episode_id: 9,
      episode_title: 'The 3am bakery',
      feed_title: 'Night Shift Stories',
      url: 'https://media.example/9.mp3',
      status: 'failed',
      error_code: 'NOT_FOUND',
      error_message: 'The podcast file was not found on the server (404/410).',
      created_at: 0,
    };
    assert.equal(
      logDetails(entry, () => 'today'),
      [
        'Night Shift Stories: The 3am bakery',
        'Status: Failed',
        'Error: NOT_FOUND',
        'Reason: The podcast file was not found on the server (404/410).',
        'When: today',
        'Address: https://media.example/9.mp3',
      ].join('\n')
    );
    assert.equal(
      logDetails({ ...entry, status: 'success', error_code: null, error_message: null, feed_title: null }, () => 'x'),
      'The 3am bakery\nStatus: Downloaded\nWhen: x\nAddress: https://media.example/9.mp3'
    );
  });
});
