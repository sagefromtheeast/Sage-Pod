import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countryName,
  feedUrlKey,
  fyydSearchUrl,
  itunesChartsUrl,
  itunesSearchUrl,
  mergeResults,
  parseCountry,
  parseFyydResults,
} from '../providers';

// Trimmed from a real `api.fyyd.de/0.2/search/podcast` response.
const FYYD_FIXTURE = {
  status: 1,
  msg: 'ok',
  meta: { paging: { count: 3, page: 0 } },
  data: [
    {
      title: 'Calm History - Bedtime Sleep Stories ',
      id: 78289,
      xmlURL: 'https://feeds.redcircle.com/7b1abe25-db9c-4224-a98b-d2bb424c430d',
      htmlURL: 'https://redcircle.com/shows/calm-history',
      imgURL: 'https://media.redcircle.com/images/calm-history.jpg',
      layoutImageURL: 'https://img-1.fyyd.de/pd/layout/78289.jpg',
      author: 'Harris | ASMR & Insomnia Network',
      episode_count: 207,
      language: 'en',
    },
    { title: 'No feed', id: 2, xmlURL: null },
    { title: '', id: 3, xmlURL: 'http://example.com/feed', imgURL: '', layoutImageURL: 'https://img/3.jpg' },
  ],
};

describe('query builders', () => {
  it('builds Apple search and chart URLs for a country', () => {
    assert.equal(
      itunesSearchUrl('  true crime ', { country: 'gb', limit: 10 }),
      'https://itunes.apple.com/search?media=podcast&entity=podcast&term=true%20crime&limit=10&country=GB'
    );
    assert.equal(
      itunesChartsUrl('DE', 25),
      'https://rss.applemarketingtools.com/api/v2/de/podcasts/top/25/podcasts.json'
    );
  });

  it('builds the fyyd search URL with the term encoded', () => {
    assert.equal(fyydSearchUrl('a&b', 5), 'https://api.fyyd.de/0.2/search/podcast?title=a%26b&count=5');
  });

  it('falls back to the default country for unknown codes', () => {
    assert.equal(parseCountry('GB'), 'gb');
    assert.equal(parseCountry('xx'), 'us');
    assert.equal(parseCountry(null), 'us');
    assert.equal(countryName('zw'), 'Zimbabwe');
  });
});

describe('fyyd parser', () => {
  it('maps podcasts and drops entries without a feed', () => {
    const results = parseFyydResults(FYYD_FIXTURE);
    assert.equal(results.length, 2);
    assert.deepEqual(results[0], {
      id: 'fyyd:78289',
      title: 'Calm History - Bedtime Sleep Stories',
      author: 'Harris | ASMR & Insomnia Network',
      feedUrl: 'https://feeds.redcircle.com/7b1abe25-db9c-4224-a98b-d2bb424c430d',
      artworkUrl: 'https://media.redcircle.com/images/calm-history.jpg',
      genre: null,
      episodeCount: 207,
    });
    assert.equal(results[1].title, 'Untitled podcast');
    assert.equal(results[1].artworkUrl, 'https://img/3.jpg');
  });

  it('survives unexpected shapes', () => {
    assert.deepEqual(parseFyydResults(null), []);
    assert.deepEqual(parseFyydResults({ status: 0, data: 'nope' }), []);
  });
});

describe('subscribed matching', () => {
  it('treats scheme, www, host case and trailing slashes as the same feed', () => {
    const key = feedUrlKey('https://www.Example.com/Feed/');
    assert.equal(key, 'example.com/Feed');
    assert.equal(feedUrlKey('http://example.com/Feed'), key);
    assert.equal(feedUrlKey('feed://example.com/Feed'), key);
    assert.notEqual(feedUrlKey('https://example.com/feed'), key);
  });

  it('merges provider lists, keeping the first copy of each feed', () => {
    const podcast = (id: string, feedUrl: string) => ({
      id, title: id, author: null, feedUrl, artworkUrl: null, genre: null, episodeCount: null,
    });
    const merged = mergeResults(
      [podcast('a', 'https://x.com/a'), podcast('b', 'https://x.com/b')],
      [podcast('fyyd:a', 'http://www.x.com/a/'), podcast('fyyd:c', 'https://x.com/c')]
    );
    assert.deepEqual(merged.map((p) => p.id), ['a', 'b', 'fyyd:c']);
  });
});
