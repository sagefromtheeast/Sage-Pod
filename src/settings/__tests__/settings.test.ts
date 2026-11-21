import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { subjectFor } from '../../actions/episodeActions';
import { DEFAULT_SETTINGS } from '../../db/settingsSchema';
import { cleanupCandidates, formatCleanup, parseCleanup } from '../../player/cleanup';
import { afterLeaving, afterSkip, almostEnded } from '../../player/playedRules';
import { adjustForSpeed, parsePresets } from '../../player/speed';
import { SETTING_OPTIONS } from '../options';
import { parseSwipes, resolveSwipe, serializeSwipes, SWIPE_SCREEN_KEYS, SWIPE_SCREENS } from '../swipes';

describe('settings schema', () => {
  it('offers every multiple-choice default as one of its choices', () => {
    for (const [key, options] of Object.entries(SETTING_OPTIONS)) {
      const value = DEFAULT_SETTINGS[key as keyof typeof DEFAULT_SETTINGS];
      assert.ok((options as readonly unknown[]).includes(value), `${key} default ${String(value)} is not offered`);
    }
  });

  it('has a default of a storable type for every key', () => {
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      assert.ok(['string', 'number', 'boolean'].includes(typeof value), key);
      if (typeof value === 'number') assert.ok(Number.isFinite(value), key);
    }
  });

  it('parses the default speed presets and swipe settings', () => {
    assert.ok(parsePresets(DEFAULT_SETTINGS.speedPresets).includes(1));
    for (const screen of SWIPE_SCREEN_KEYS) {
      const { setting, defaults, actions } = SWIPE_SCREENS[screen];
      assert.deepEqual(parseSwipes(screen, DEFAULT_SETTINGS[setting]), defaults);
      assert.ok(actions.includes(defaults.right) && actions.includes(defaults.left), screen);
    }
  });

  it('keeps AntennaPod-matching defaults', () => {
    assert.equal(DEFAULT_SETTINGS.smartMarkSeconds, 30);
    assert.equal(DEFAULT_SETTINGS.keepSkippedEpisodes, true);
    assert.equal(DEFAULT_SETTINGS.deleteRemovesFromQueue, false);
    assert.equal(DEFAULT_SETTINGS.episodeCleanup, 'queue');
  });
});

const subject = (over: Partial<Parameters<typeof subjectFor>[0]> = {}, queued = false) =>
  subjectFor(
    {
      media_url: 'https://x/a.mp3',
      is_new: 1,
      is_played: 0,
      is_favorite: 0,
      position: 0,
      download_state: 'none',
      ...over,
    },
    { queued, playing: false }
  );

describe('swipes', () => {
  it('round-trips and rejects actions a list does not offer', () => {
    assert.deepEqual(parseSwipes('queue', serializeSwipes({ right: 'togglePlayed', left: 'delete' })), {
      right: 'togglePlayed',
      left: 'delete',
    });
    // Remove from inbox isn't offered on the queue: that side falls back.
    assert.deepEqual(parseSwipes('queue', 'removeFromInbox|none'), { right: 'moveToTop', left: 'none' });
    assert.deepEqual(parseSwipes('inbox', 'garbage'), SWIPE_SCREENS.inbox.defaults);
  });

  it('resolves toggles from the episode', () => {
    assert.equal(resolveSwipe('toggleQueue', subject()), 'addToQueue');
    assert.equal(resolveSwipe('toggleQueue', subject({}, true)), 'removeFromQueue');
    assert.equal(resolveSwipe('togglePlayed', subject({ is_played: 1 })), 'markUnplayed');
    assert.equal(resolveSwipe('toggleFavorite', subject({ is_favorite: 1 })), 'removeFromFavorites');
  });

  it('returns null when the action does not apply', () => {
    assert.equal(resolveSwipe('none', subject()), null);
    assert.equal(resolveSwipe('delete', subject()), null);
    assert.equal(resolveSwipe('download', subject({ download_state: 'done' })), null);
    assert.equal(resolveSwipe('removeFromInbox', subject({ is_new: 0 })), null);
    assert.equal(resolveSwipe('moveToTop', subject()), null);
  });
});

describe('played rules', () => {
  const base = {
    position: 100,
    duration: 1000,
    smartMarkSeconds: 30,
    keepSkipped: true,
    removeFinishedFromQueue: true,
    autoDelete: false,
    downloaded: true,
  };
  const nothing = { markPlayed: false, dequeue: false, deleteDownload: false };

  it('treats the last N seconds as the end', () => {
    assert.equal(almostEnded(975, 1000, 30), true);
    assert.equal(almostEnded(960, 1000, 30), false);
    assert.equal(almostEnded(999, 1000, 0), false);
    assert.equal(almostEnded(10, 0, 30), false);
    // A clip no longer than the threshold never counts: pausing it anywhere would.
    assert.equal(almostEnded(10, 180, 300), false);
  });

  it('keeps a skipped episode unless told not to', () => {
    assert.deepEqual(afterSkip(base), nothing);
    // Skipped, not finished: the download stays even with "Delete after finished".
    assert.deepEqual(afterSkip({ ...base, keepSkipped: false, autoDelete: true }), {
      markPlayed: true,
      dequeue: true,
      deleteDownload: false,
    });
  });

  it('marks an almost-finished skip played like a finished episode', () => {
    assert.deepEqual(afterSkip({ ...base, position: 990 }), { markPlayed: true, dequeue: true, deleteDownload: false });
    assert.deepEqual(afterSkip({ ...base, position: 990, removeFinishedFromQueue: false, autoDelete: true }), {
      markPlayed: true,
      dequeue: false,
      deleteDownload: true,
    });
  });

  it('finishes an episode left in its last seconds', () => {
    const leaving = { ...base, position: 990, autoDelete: true };
    assert.deepEqual(afterLeaving(leaving), { markPlayed: true, dequeue: true, deleteDownload: true });
    // Nothing to delete when it was streamed.
    assert.deepEqual(afterLeaving({ ...leaving, downloaded: false }), {
      markPlayed: true,
      dequeue: true,
      deleteDownload: false,
    });
    assert.deepEqual(afterLeaving({ ...leaving, position: 500 }), nothing);
    assert.deepEqual(afterLeaving({ ...leaving, smartMarkSeconds: 0 }), nothing);
  });
});

describe('episode cleanup', () => {
  const hour = 3_600_000;
  const now = 100 * hour;
  const rows = [
    { id: 1, is_played: 1, is_favorite: 0, played_at: now - 50 * hour },
    { id: 2, is_played: 1, is_favorite: 0, played_at: now - 2 * hour },
    { id: 3, is_played: 1, is_favorite: 1, played_at: now - 90 * hour },
    { id: 4, is_played: 0, is_favorite: 0, played_at: null },
    { id: 5, is_played: 1, is_favorite: 0, played_at: now - 80 * hour },
    { id: 6, is_played: 1, is_favorite: 0, played_at: null },
  ];

  it('parses rules, falling back to the queue rule', () => {
    assert.deepEqual(parseCleanup('never'), { kind: 'never' });
    assert.deepEqual(parseCleanup('72'), { kind: 'after', hours: 72 });
    assert.deepEqual(parseCleanup(''), { kind: 'queue' });
    assert.deepEqual(parseCleanup('-3'), { kind: 'queue' });
    assert.equal(formatCleanup('24'), '1 day after played');
    assert.equal(formatCleanup('12'), '12 h after played');
  });

  it('picks played, unstarred, unqueued downloads, oldest first', () => {
    const ids = (list: { id: number }[]) => list.map((row) => row.id);
    assert.deepEqual(ids(cleanupCandidates({ kind: 'queue' }, rows, new Set([1]), now)), [6, 5, 2]);
    // Played at an unknown time: not "a day ago", so kept.
    assert.deepEqual(ids(cleanupCandidates({ kind: 'after', hours: 24 }, rows, new Set(), now)), [5, 1]);
    assert.deepEqual(cleanupCandidates({ kind: 'never' }, rows, new Set(), now), []);
  });
});

describe('adjustForSpeed', () => {
  it('divides by the rate only when on', () => {
    assert.equal(adjustForSpeed(600, 2, true), 300);
    assert.equal(adjustForSpeed(600, 2, false), 600);
    assert.equal(adjustForSpeed(600, 0, true), 600);
  });
});
