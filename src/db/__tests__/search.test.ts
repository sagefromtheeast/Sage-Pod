import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { searchWords } from '../search';

describe('search words', () => {
  it('makes one LIKE pattern per word, ignoring extra spaces', () => {
    assert.deepEqual(searchWords('  chip   shortage '), ['%chip%', '%shortage%']);
    assert.deepEqual(searchWords('   '), []);
  });

  it('takes % _ and the escape character literally', () => {
    assert.deepEqual(searchWords('100%'), ['%100\\%%']);
    assert.deepEqual(searchWords('a_b'), ['%a\\_b%']);
    assert.deepEqual(searchWords('c\\d'), ['%c\\\\d%']);
  });
});
