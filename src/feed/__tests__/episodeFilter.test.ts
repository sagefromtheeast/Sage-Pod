import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  describeFilter,
  filterClauses,
  isFiltered,
  parseEpisodeFilter,
  serializeEpisodeFilter,
  toggleFacet,
} from '../episodeFilter';

describe('episode filter', () => {
  it('round-trips include and exclude conditions, ignoring junk', () => {
    const filter = parseEpisodeFilter('played, -downloaded, bogus, -');
    assert.deepEqual(filter, { played: true, downloaded: false });
    assert.equal(serializeEpisodeFilter(filter), 'played,-downloaded');
    assert.deepEqual(parseEpisodeFilter(null), {});
    assert.equal(isFiltered({}), false);
    assert.equal(isFiltered(filter), true);
  });

  it('toggles a side on, switches sides, and clears the pair', () => {
    let filter = toggleFacet({}, 'played', false);
    assert.deepEqual(filter, { played: false });
    filter = toggleFacet(filter, 'played', true);
    assert.deepEqual(filter, { played: true });
    filter = toggleFacet(filter, 'played', true);
    assert.deepEqual(filter, {});
  });

  it('builds SQL conditions and a banner description', () => {
    const filter = { played: false, queued: true, favorite: false };
    assert.deepEqual(filterClauses(filter), [
      'NOT e.is_played = 1',
      'NOT e.is_favorite = 1',
      'e.id IN (SELECT episode_id FROM queue)',
    ]);
    assert.equal(describeFilter(filter), 'Unplayed · Not favourite · Queued');
  });
});
