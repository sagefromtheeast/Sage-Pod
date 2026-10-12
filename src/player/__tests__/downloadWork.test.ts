import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickWork, reconcileAction, transferSummary, worksByEpisode, type DownloadWork } from '../downloadWork';

const work = (state: DownloadWork['state'], extra: Partial<DownloadWork> = {}): DownloadWork => ({
  id: `${state}-${extra.episodeId ?? 1}`,
  episodeId: 1,
  state,
  enqueuedAt: 0,
  attempt: 0,
  bytesWritten: 0,
  totalBytes: -1,
  path: null,
  size: -1,
  resumedFrom: 0,
  elapsedMs: 0,
  errorCode: null,
  errorMessage: null,
  httpStatus: 0,
  ...extra,
});

describe('pickWork', () => {
  it('prefers a job still going, then a success, then a failure', () => {
    assert.equal(pickWork([work('FAILED'), work('SUCCEEDED'), work('ENQUEUED')])?.state, 'ENQUEUED');
    assert.equal(pickWork([work('FAILED'), work('SUCCEEDED')])?.state, 'SUCCEEDED');
    assert.equal(pickWork([work('CANCELLED'), work('FAILED')])?.state, 'FAILED');
    assert.equal(pickWork([]), undefined);
  });

  it('prefers the newest finished job, so a later failure beats an old success', () => {
    const old = work('SUCCEEDED', { enqueuedAt: 1000 });
    const retry = work('FAILED', { enqueuedAt: 2000 });
    assert.equal(pickWork([old, retry])?.state, 'FAILED');
    assert.equal(pickWork([retry, work('SUCCEEDED', { enqueuedAt: 3000 })])?.state, 'SUCCEEDED');
    // A job still going wins whatever its age.
    assert.equal(pickWork([retry, work('ENQUEUED', { enqueuedAt: 500 })])?.state, 'ENQUEUED');
  });
});

describe('reconcileAction', () => {
  it('records a finished job only for a row still waiting on it', () => {
    assert.equal(reconcileAction('downloading', work('SUCCEEDED'), false), 'done');
    assert.equal(reconcileAction('queued', work('FAILED'), false), 'failed');
    // Deleted or cancelled since: an old job changes nothing.
    assert.equal(reconcileAction('none', work('SUCCEEDED'), true), 'none');
    assert.equal(reconcileAction('done', work('FAILED'), true), 'none');
    assert.equal(reconcileAction('error', work('SUCCEEDED'), true), 'none');
  });

  it('marks a queued row downloading once its job runs', () => {
    assert.equal(reconcileAction('queued', work('RUNNING'), false), 'downloading');
    assert.equal(reconcileAction('downloading', work('RUNNING'), false), 'none');
    assert.equal(reconcileAction('queued', work('ENQUEUED'), false), 'none');
    assert.equal(reconcileAction('downloading', work('ENQUEUED'), true), 'none');
  });

  it('restarts a pending row with no live job only at startup', () => {
    assert.equal(reconcileAction('queued', undefined, true), 'enqueue');
    assert.equal(reconcileAction('downloading', work('CANCELLED'), true), 'enqueue');
    assert.equal(reconcileAction('queued', undefined, false), 'none');
    assert.equal(reconcileAction('none', undefined, true), 'none');
  });
});

describe('worksByEpisode', () => {
  it('groups by episode and skips jobs without one', () => {
    const grouped = worksByEpisode([
      work('RUNNING', { episodeId: 2 }),
      work('FAILED', { episodeId: 2 }),
      work('SUCCEEDED', { episodeId: 0 }),
    ]);
    assert.deepEqual([...grouped.keys()], [2]);
    assert.equal(grouped.get(2)?.length, 2);
  });
});

describe('transferSummary', () => {
  const MB = 1024 * 1024;
  it('gives size, time and speed', () => {
    assert.equal(transferSummary(48 * MB, 72_000), '48 MB in 1 min 12 s, 683 KB/s');
    assert.equal(transferSummary(5 * MB, 2_000), '5.0 MB in 2 s, 2.5 MB/s');
  });

  it('counts only the resumed part and notes retries and background time', () => {
    assert.equal(
      transferSummary(40 * MB, 10_000, { resumedFrom: 30 * MB, attempt: 2, background: 0.75 }),
      '40 MB in 10 s, 1.0 MB/s, resumed from 30 MB, attempt 2, 75% in the background'
    );
  });

  it('says nothing without a size or a time', () => {
    assert.equal(transferSummary(0, 1000), null);
    assert.equal(transferSummary(MB, 0), null);
  });
});
