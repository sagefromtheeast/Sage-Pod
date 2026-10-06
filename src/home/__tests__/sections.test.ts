import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  classicsSince,
  continueListening,
  DEFAULT_HOME_SECTIONS,
  moveSection,
  parseHomeSections,
  serializeHomeSections,
  setSectionVisible,
} from '../sections';

describe('home sections setting', () => {
  it('defaults to every section, visible, in the default order', () => {
    const sections = parseHomeSections('');
    assert.deepEqual(
      sections.map((section) => section.id),
      [...DEFAULT_HOME_SECTIONS]
    );
    assert.ok(sections.every((section) => section.visible));
  });

  it('keeps the saved order and hidden sections, and round-trips', () => {
    const raw = 'new,-queue,surprise,classics,downloads,inProgress,subscriptions';
    const sections = parseHomeSections(raw);
    assert.deepEqual(sections.slice(0, 2), [
      { id: 'new', visible: true },
      { id: 'queue', visible: false },
    ]);
    assert.equal(serializeHomeSections(sections), raw);
  });

  it('drops unknown and repeated ids and appends sections it does not mention', () => {
    const sections = parseHomeSections('bogus,new,new,-downloads');
    assert.deepEqual(
      sections.map((section) => `${section.visible ? '' : '-'}${section.id}`),
      ['new', '-downloads', 'queue', 'surprise', 'classics', 'inProgress', 'subscriptions']
    );
  });

  it('moves and hides sections', () => {
    const sections = parseHomeSections('');
    assert.deepEqual(
      moveSection(sections, 1, -1).slice(0, 2).map((section) => section.id),
      ['new', 'queue']
    );
    assert.deepEqual(moveSection(sections, 0, -1), sections);
    assert.equal(setSectionVisible(sections, 'classics', false).find((section) => section.id === 'classics')?.visible, false);
  });
});

describe('home section content', () => {
  it('puts started queue episodes first, keeping queue order otherwise', () => {
    const queue = [
      { id: 1, position: 0 },
      { id: 2, position: 30 },
      { id: 3, position: 0 },
      { id: 4, position: 10 },
    ];
    assert.deepEqual(
      continueListening(queue, 3).map((episode) => episode.id),
      [2, 4, 1]
    );
  });

  it('looks three years back for classics', () => {
    assert.equal(classicsSince(Date.UTC(2026, 9, 6)), '2023-10-06');
  });
});
