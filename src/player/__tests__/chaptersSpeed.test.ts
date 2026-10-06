import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chapterTicks, currentChapterIndex, nextChapterTarget, parseChapters, prevChapterTarget } from '../chapters';
import { clampSpeed, formatSpeed, parsePresets, togglePreset } from '../speed';

const chapters = [{ startTime: 0 }, { startTime: 60 }, { startTime: 300 }];

describe('chapters', () => {
  it('finds the chapter playing now', () => {
    assert.equal(currentChapterIndex(chapters, 0), 0);
    assert.equal(currentChapterIndex(chapters, 61), 1);
    assert.equal(currentChapterIndex(chapters, 9999), 2);
    assert.equal(currentChapterIndex([{ startTime: 30 }], 10), -1);
    assert.equal(currentChapterIndex([], 10), -1);
  });

  it('goes back a chapter only within ~10 s of listening (AntennaPod rule)', () => {
    assert.equal(prevChapterTarget(chapters, 65, 1), 0); // 5 s into chapter 2 → chapter 1
    assert.equal(prevChapterTarget(chapters, 80, 1), 60); // 20 s in → restart chapter 2
    assert.equal(prevChapterTarget(chapters, 75, 2), 0); // 15 s in at 2× = 7.5 s listened → back
    assert.equal(prevChapterTarget(chapters, 30, 1), 0); // first chapter → 0
  });

  it('goes to the next chapter, or nowhere on the last', () => {
    assert.equal(nextChapterTarget(chapters, 10), 60);
    assert.equal(nextChapterTarget(chapters, 400), null);
  });

  it('places ticks at interior boundaries', () => {
    assert.deepEqual(chapterTicks(chapters, 600), [0.1, 0.5]);
    assert.deepEqual(chapterTicks(chapters, 0), []);
  });
});

describe('speed', () => {
  it('clamps to 0.5–4.0 and snaps to 0.05', () => {
    assert.equal(clampSpeed(0.1), 0.5);
    assert.equal(clampSpeed(9), 4);
    assert.equal(clampSpeed(1.234), 1.25);
    assert.equal(clampSpeed(Number.NaN), 1);
  });

  it('formats without trailing zeros', () => {
    assert.equal(formatSpeed(1), '1×');
    assert.equal(formatSpeed(1.25), '1.25×');
    assert.equal(formatSpeed(0.8), '0.8×');
  });

  it('parses presets, dropping junk and falling back to defaults', () => {
    assert.deepEqual(parsePresets('1.5, 1, x, 1.5, 2'), [1, 1.5, 2]);
    assert.deepEqual(parsePresets(''), [0.8, 1, 1.2, 1.5, 1.75, 2, 2.5, 3]);
  });

  it('toggles a preset in and out, sorted', () => {
    assert.deepEqual(togglePreset([1, 2], 1.5), [1, 1.5, 2]);
    assert.deepEqual(togglePreset([1, 1.5, 2], 1.5), [1, 2]);
  });
});

describe('chapter parsing', () => {
  it('sorts, drops bad entries and toc:false, and tolerates junk', () => {
    const parsed = parseChapters({
      chapters: [
        { startTime: 300, title: 'Later', img: 'https://x/img.png' },
        { startTime: 0, title: 'Intro' },
        { startTime: 'soon', title: 'Bad' },
        { startTime: 120, title: 'Hidden', toc: false },
        null,
        { startTime: 60 },
      ],
    });
    assert.deepEqual(parsed.map((chapter) => [chapter.startTime, chapter.title]), [[0, 'Intro'], [60, ''], [300, 'Later']]);
    assert.equal(parsed[2].img, 'https://x/img.png');
    assert.deepEqual(parseChapters(null), []);
    assert.deepEqual(parseChapters({ chapters: 'nope' }), []);
  });
});
