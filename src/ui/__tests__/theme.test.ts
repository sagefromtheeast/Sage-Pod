import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { palettes, resolvePalette } from '../theme';

describe('resolvePalette — Theme Resolution Logic', () => {
  it('resolves explicit light theme regardless of system scheme', () => {
    assert.deepEqual(resolvePalette('light', 'dark'), palettes.light);
    assert.deepEqual(resolvePalette('light', 'light'), palettes.light);
    assert.deepEqual(resolvePalette('light', null), palettes.light);
  });

  it('resolves explicit dark theme regardless of system scheme', () => {
    assert.deepEqual(resolvePalette('dark', 'light'), palettes.dark);
    assert.deepEqual(resolvePalette('dark', 'dark'), palettes.dark);
    assert.deepEqual(resolvePalette('dark', null), palettes.dark);
  });

  it('resolves explicit oled theme with pure black background', () => {
    const palette = resolvePalette('oled', 'light');
    assert.deepEqual(palette, palettes.oled);
    assert.equal(palette.bg, '#000000');
    assert.equal(palette.scheme, 'oled');
  });

  it('resolves system theme matching light system scheme', () => {
    assert.deepEqual(resolvePalette('system', 'light'), palettes.light);
  });

  it('resolves system theme matching dark/unspecified/null system scheme', () => {
    assert.deepEqual(resolvePalette('system', 'dark'), palettes.dark);
    assert.deepEqual(resolvePalette('system', 'unspecified'), palettes.dark);
    assert.deepEqual(resolvePalette('system', null), palettes.dark);
    assert.deepEqual(resolvePalette('system', undefined), palettes.dark);
  });
});
