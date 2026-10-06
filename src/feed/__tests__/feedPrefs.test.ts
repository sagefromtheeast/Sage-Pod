import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  boolOverride,
  globalLabel,
  parseNewEpisodesAction,
  parseTags,
  parseWords,
  resolveOverride,
  serializeTags,
  shouldAutoDownload,
  shouldSkipEnding,
  volumeFor,
} from '../feedPrefs';

describe('feed overrides', () => {
  it('falls back to the global value only when unset', () => {
    assert.deepEqual(resolveOverride(null, 1.5), { value: 1.5, inherited: true });
    assert.deepEqual(resolveOverride(undefined, true), { value: true, inherited: true });
    assert.deepEqual(resolveOverride(false, true), { value: false, inherited: false });
    assert.deepEqual(resolveOverride(0, 30), { value: 0, inherited: false });
    assert.equal(globalLabel('1.5×'), 'Global (1.5×)');
    assert.equal(boolOverride(null), null);
    assert.equal(boolOverride(1), true);
    assert.equal(boolOverride(0), false);
  });

  it('reads the new-episodes action and volume reduction defensively', () => {
    assert.equal(parseNewEpisodesAction('queue'), 'queue');
    assert.equal(parseNewEpisodesAction('bogus'), null);
    assert.equal(parseNewEpisodesAction(null), null);
    assert.equal(volumeFor(0.5), 0.5);
    assert.equal(volumeFor(null), 1);
    assert.equal(volumeFor(0.7), 1);
  });
});

describe('skip ending', () => {
  it('skips within the last N seconds of a known duration', () => {
    assert.equal(shouldSkipEnding(3500, 3600, 120), true);
    assert.equal(shouldSkipEnding(3479, 3600, 120), false);
    assert.equal(shouldSkipEnding(3480, 3600, 120), true);
  });

  it('ignores unset, unknown-duration and episode-long settings', () => {
    assert.equal(shouldSkipEnding(3500, 3600, null), false);
    assert.equal(shouldSkipEnding(3500, 3600, 0), false);
    assert.equal(shouldSkipEnding(100, 0, 30), false);
    assert.equal(shouldSkipEnding(10, 60, 60), false);
  });
});

describe('tags and words', () => {
  it('keeps tag case but de-duplicates case-insensitively', () => {
    assert.deepEqual(parseTags(' News, tech,news ,, Tech '), ['News', 'tech']);
    assert.equal(serializeTags(['News', 'tech', 'NEWS']), 'News, tech');
    assert.deepEqual(parseWords('Bonus, BONUS ,  live '), ['bonus', 'live']);
  });
});

describe('auto-download filter', () => {
  const full = { title: 'Episode 101: The Deep Dive', duration: 3600 };

  it('keeps the built-in skip of trailers and short clips', () => {
    assert.equal(shouldAutoDownload(full), true);
    assert.equal(shouldAutoDownload({ title: 'Season 2 Trailer', duration: 3600 }), false);
    assert.equal(shouldAutoDownload({ title: 'A short one', duration: 120 }), false);
    assert.equal(shouldAutoDownload({ title: 'Unknown length', duration: null }), true);
  });

  it('applies include and exclude words to the title', () => {
    const rules = { include: ['interview'], exclude: ['bonus'], minMinutes: 0 };
    assert.equal(shouldAutoDownload({ title: 'Interview: a lighthouse keeper', duration: 3000 }, rules), true);
    assert.equal(shouldAutoDownload({ title: 'Bonus interview', duration: 3000 }, rules), false);
    assert.equal(shouldAutoDownload(full, rules), false);
  });

  it('uses the podcast minimum instead of the built-in one when set', () => {
    const rules = { include: [], exclude: [], minMinutes: 30 };
    assert.equal(shouldAutoDownload({ title: 'Twenty minutes', duration: 1200 }, rules), false);
    assert.equal(shouldAutoDownload({ title: 'Forty minutes', duration: 2400 }, rules), true);
  });
});
