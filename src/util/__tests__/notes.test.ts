import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseShowNotes } from '../notes';
import { parseTimestamps, shortTimecodesAreHours } from '../timestamps';

const HOUR = 3600;

describe('timestamps', () => {
  it('reads two-part timecodes as MM:SS unless all of them fit as HH:MM (AntennaPod)', () => {
    // A 2-hour episode: 1:05 as HH:MM is 65 minutes, which fits.
    assert.equal(shortTimecodesAreHours('Part two at 1:05', 2 * HOUR), true);
    // 05:30 as HH:MM would be 5.5 hours, past the end, so all are MM:SS.
    assert.equal(shortTimecodesAreHours('1:05 and 05:30', 2 * HOUR), false);
    // Unknown duration: minutes and seconds.
    assert.equal(shortTimecodesAreHours('1:05', null), false);
    // HH:MM:SS doesn't count as a short timecode.
    assert.equal(shortTimecodesAreHours('at 1:02:03', 2 * HOUR), false);
  });

  it('turns timecodes into seconds and leaves impossible or out-of-range ones as text', () => {
    assert.deepEqual(parseTimestamps('Intro 00:00, story 05:30', 3600), [
      { type: 'text', value: 'Intro ' },
      { type: 'timestamp', raw: '00:00', seconds: 0 },
      { type: 'text', value: ', story ' },
      { type: 'timestamp', raw: '05:30', seconds: 330 },
    ]);
    assert.deepEqual(parseTimestamps('at 1:02:03', 2 * HOUR), [
      { type: 'text', value: 'at ' },
      { type: 'timestamp', raw: '1:02:03', seconds: 3723 },
    ]);
    // 12:75 isn't a time; 59:00 is past the end of a 30-minute episode.
    assert.deepEqual(parseTimestamps('12:75 and 59:00', 1800), [{ type: 'text', value: '12:75 and 59:00' }]);
    assert.deepEqual(parseTimestamps('Part two at 1:05', 2 * HOUR), [
      { type: 'text', value: 'Part two at ' },
      { type: 'timestamp', raw: '1:05', seconds: 3900 },
    ]);
  });
});

describe('show notes', () => {
  it('keeps anchors inline as links, with their label', () => {
    const segments = parseShowNotes(
      '<p>See <a href="https://sagepod.test/a?x=1&amp;y=2">our site</a> at 05:30.</p>',
      3600
    );
    assert.deepEqual(segments, [
      { type: 'text', value: 'See ' },
      { type: 'link', url: 'https://sagepod.test/a?x=1&y=2', label: 'our site' },
      { type: 'text', value: ' at ' },
      { type: 'timestamp', raw: '05:30', seconds: 330 },
      { type: 'text', value: '.' },
    ]);
  });

  it('links bare URLs without trailing punctuation, and drops non-web anchors to text', () => {
    const segments = parseShowNotes('Visit https://sagepod.test/notes. Or <a href="mailto:a@b.c">email us</a>', null);
    assert.deepEqual(segments, [
      { type: 'text', value: 'Visit ' },
      { type: 'link', url: 'https://sagepod.test/notes', label: 'https://sagepod.test/notes' },
      { type: 'text', value: '. Or email us' },
    ]);
  });

  it('handles empty notes', () => {
    assert.deepEqual(parseShowNotes(null, 100), []);
    assert.deepEqual(parseShowNotes('', 100), []);
  });
});
