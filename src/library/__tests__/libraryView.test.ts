import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  addTagTo,
  allTags,
  columnsFor,
  counterValue,
  filterFeeds,
  parseCounter,
  parseLibraryFilter,
  parseSort,
  renameTagIn,
  serializeLibraryFilter,
  sortFeeds,
  toggleLibraryFacet,
  type LibraryFeedCounts,
} from '../libraryView';

const feed = (id: number, title: string, extra: Partial<LibraryFeedCounts> = {}): LibraryFeedCounts => ({
  id,
  title,
  tags: null,
  keep_updated: 1,
  auto_download_override: null,
  last_refresh_error: null,
  latest_published_at: 0,
  unplayed_count: 0,
  inbox_count: 0,
  downloaded_count: 0,
  downloaded_unplayed_count: 0,
  played_count: 0,
  ...extra,
});

const FEEDS = [
  feed(1, 'beta', { unplayed_count: 3, played_count: 9, latest_published_at: 10, tags: 'News, Tech' }),
  feed(2, 'Alpha', { unplayed_count: 3, played_count: 1, latest_published_at: 30, keep_updated: 0 }),
  feed(3, 'gamma', { unplayed_count: 7, inbox_count: 2, auto_download_override: 1, tags: 'news' }),
  feed(4, 'Delta', { downloaded_count: 2, downloaded_unplayed_count: 1, last_refresh_error: 'HTTP 404' }),
];

describe('library sort', () => {
  it('orders by title without case, and by counts with title as the tie-break', () => {
    assert.deepEqual(sortFeeds(FEEDS, 'title').map((f) => f.id), [2, 1, 4, 3]);
    assert.deepEqual(sortFeeds(FEEDS, 'unplayed').map((f) => f.id), [3, 2, 1, 4]);
    assert.deepEqual(sortFeeds(FEEDS, 'played').map((f) => f.id), [1, 2, 4, 3]);
    assert.deepEqual(sortFeeds(FEEDS, 'updated').map((f) => f.id), [2, 1, 4, 3]);
    assert.equal(parseSort('bogus'), 'title');
  });
});

describe('library counter', () => {
  it('reads the chosen count', () => {
    assert.equal(counterValue(FEEDS[2], 'inbox'), 2);
    assert.equal(counterValue(FEEDS[3], 'downloaded_unplayed'), 1);
    assert.equal(counterValue(FEEDS[0], 'none'), 0);
    assert.equal(parseCounter('nope'), 'unplayed');
  });
});

describe('library filter', () => {
  const context = { counter: 'inbox' as const, globalAutoDownload: false, tag: null };

  it('round-trips and toggles facets', () => {
    const filter = parseLibraryFilter('updated,-autoDownload,bogus');
    assert.deepEqual(filter, { updated: true, autoDownload: false });
    assert.equal(serializeLibraryFilter(filter), 'updated,-autoDownload');
    assert.deepEqual(toggleLibraryFacet(filter, 'updated', true), { autoDownload: false });
  });

  it('applies facets, with auto-download following the global setting when unset', () => {
    assert.deepEqual(filterFeeds(FEEDS, { updated: false }, context).map((f) => f.id), [2]);
    assert.deepEqual(filterFeeds(FEEDS, { autoDownload: true }, context).map((f) => f.id), [3]);
    assert.deepEqual(
      filterFeeds(FEEDS, { autoDownload: true }, { ...context, globalAutoDownload: true }).map((f) => f.id),
      [1, 2, 3, 4]
    );
    assert.deepEqual(filterFeeds(FEEDS, { counter: true }, context).map((f) => f.id), [3]);
    assert.deepEqual(
      filterFeeds(FEEDS, { counter: true }, { ...context, counter: 'none' }).map((f) => f.id),
      [1, 2, 3]
    );
    assert.deepEqual(filterFeeds(FEEDS, { error: true }, context).map((f) => f.id), [4]);
  });

  it('narrows to a tag, ignoring case', () => {
    assert.deepEqual(filterFeeds(FEEDS, {}, { ...context, tag: 'NEWS' }).map((f) => f.id), [1, 3]);
  });
});

describe('tags', () => {
  it('lists tags in use, first spelling wins', () => {
    assert.deepEqual(allTags(FEEDS), ['News', 'Tech']);
  });

  it('renames, removes and adds tags on one podcast', () => {
    assert.equal(renameTagIn('News, Tech', 'news', 'World'), 'World, Tech');
    assert.equal(renameTagIn('News, Tech', 'NEWS', ''), 'Tech');
    assert.equal(renameTagIn('News', 'news', ''), null);
    assert.equal(renameTagIn('Tech, World', 'tech', 'World'), 'World');
    assert.equal(addTagTo(null, ' Comedy '), 'Comedy');
    assert.equal(addTagTo('Comedy', 'comedy'), 'Comedy');
  });
});

describe('columns', () => {
  it('uses the saved count, or the layout when automatic or unknown', () => {
    assert.equal(columnsFor(4, 3), 4);
    assert.equal(columnsFor(0, 3), 3);
    assert.equal(columnsFor(9, 3), 3);
  });
});
