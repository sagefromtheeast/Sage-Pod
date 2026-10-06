import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appliesTo,
  BULK_CONFIRM_THRESHOLD,
  episodeActionsFor,
  needsBulkConfirm,
  rowButtonFor,
  type ActionSubject,
} from '../episodeActions';

const base: ActionSubject = {
  hasMedia: true,
  isNew: false,
  isPlayed: false,
  isFavorite: false,
  position: 0,
  downloaded: false,
  downloading: false,
  queued: false,
  playing: false,
};
const ep = (patch: Partial<ActionSubject>): ActionSubject => ({ ...base, ...patch });
const menu = { kind: 'menu', canMultiSelect: true } as const;

describe('long-press menu', () => {
  it('lists only what applies, in AntennaPod order', () => {
    assert.deepEqual(episodeActionsFor([ep({ isNew: true, position: 120 })], menu), [
      'removeFromInbox',
      'markPlayed',
      'addToQueue',
      'addToFavorites',
      'resetPosition',
      'share',
      'multiSelect',
    ]);
  });

  it('offers skip only for the episode that is playing', () => {
    assert.equal(episodeActionsFor([ep({ playing: true })], menu)[0], 'skip');
    assert.ok(!episodeActionsFor([ep({})], menu).includes('skip'));
  });

  it('flips queue, played and favourite toggles', () => {
    const actions = episodeActionsFor([ep({ queued: true, isPlayed: true, isFavorite: true })], menu);
    assert.ok(actions.includes('removeFromQueue') && !actions.includes('addToQueue'));
    assert.ok(actions.includes('markUnplayed') && !actions.includes('markPlayed'));
    assert.ok(actions.includes('removeFromFavorites') && !actions.includes('addToFavorites'));
  });

  it('offers delete for downloaded or downloading episodes, never download', () => {
    assert.ok(episodeActionsFor([ep({ downloaded: true })], menu).includes('delete'));
    assert.ok(episodeActionsFor([ep({ downloading: true })], menu).includes('delete'));
    assert.ok(!episodeActionsFor([ep({})], menu).includes('download'));
  });

  it('hides multi select where the screen has no selection mode', () => {
    assert.ok(!episodeActionsFor([ep({})], { kind: 'menu', canMultiSelect: false }).includes('multiSelect'));
  });
});

describe('selection bar', () => {
  const selection = { kind: 'selection', inQueue: false } as const;

  it('shows an action if any selected episode can use it', () => {
    const actions = episodeActionsFor([ep({ isPlayed: true }), ep({ downloaded: true })], selection);
    assert.ok(actions.includes('markPlayed') && actions.includes('markUnplayed'));
    assert.ok(actions.includes('download') && actions.includes('delete'));
  });

  it('never offers share for several episodes', () => {
    assert.ok(!episodeActionsFor([ep({}), ep({})], selection).includes('share'));
  });

  it('collapses mixed favourites to "add"', () => {
    const actions = episodeActionsFor([ep({ isFavorite: true }), ep({})], selection);
    assert.ok(actions.includes('addToFavorites') && !actions.includes('removeFromFavorites'));
  });

  it('adds move to top/bottom only in the queue', () => {
    assert.ok(!episodeActionsFor([ep({})], selection).includes('moveToTop'));
    const inQueue = episodeActionsFor([ep({ queued: true })], { kind: 'selection', inQueue: true });
    assert.deepEqual(inQueue.slice(-2), ['moveToTop', 'moveToBottom']);
  });

  it('is empty for an empty selection', () => {
    assert.deepEqual(episodeActionsFor([], selection), []);
  });
});

describe('appliesTo (what a bulk action acts on)', () => {
  it('limits delete and download to the episodes they fit', () => {
    assert.equal(appliesTo('delete', ep({ downloaded: true })), true);
    assert.equal(appliesTo('delete', ep({})), false);
    assert.equal(appliesTo('download', ep({ hasMedia: false })), false);
    assert.equal(appliesTo('addToQueue', ep({ hasMedia: false })), false);
  });

  it('matches the menu rules', () => {
    for (const subject of [ep({}), ep({ isPlayed: true, queued: true }), ep({ downloaded: true, isNew: true })]) {
      const menu = episodeActionsFor([subject], { kind: 'menu', canMultiSelect: false });
      for (const action of menu) assert.ok(appliesTo(action, subject), `${action} shown but not applicable`);
    }
  });
});

describe('row button', () => {
  it('follows AntennaPod precedence', () => {
    assert.equal(rowButtonFor(ep({ hasMedia: false }), true), 'markPlayed');
    assert.equal(rowButtonFor(ep({ playing: true, downloaded: true }), true), 'pause');
    assert.equal(rowButtonFor(ep({ downloaded: true }), true), 'play');
    assert.equal(rowButtonFor(ep({ downloading: true }), true), 'cancel');
    assert.equal(rowButtonFor(ep({}), true), 'stream');
    assert.equal(rowButtonFor(ep({}), false), 'download');
  });
});

describe('bulk confirmation', () => {
  it('asks from 25 selected episodes, except where nothing changes or delete already asks', () => {
    assert.equal(needsBulkConfirm('markPlayed', 24), false);
    assert.equal(needsBulkConfirm('markPlayed', 25), true);
    assert.equal(needsBulkConfirm('removeFromInbox', 100), true);
    assert.equal(needsBulkConfirm('download', 25), true);
    assert.equal(needsBulkConfirm('delete', 100), false);
    assert.equal(needsBulkConfirm('share', 100), false);
    assert.equal(BULK_CONFIRM_THRESHOLD, 25);
  });
});
