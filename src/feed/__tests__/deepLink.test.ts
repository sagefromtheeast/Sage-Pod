import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { routeForFeedLink } from '../deepLink';

describe('podcast links', () => {
  it('opens Add podcast for each podcast link scheme', () => {
    for (const link of [
      'itpc://example.com/feed.xml',
      'pcast://example.com/feed.xml',
      'feed://example.com/feed.xml',
      'podcast://example.com/feed.xml',
      'feed:https://example.com/feed.xml',
      'ITPC://example.com/feed.xml',
    ]) {
      assert.equal(routeForFeedLink(link), `/add-feed?url=${encodeURIComponent(link)}`);
    }
  });

  it('leaves Sage Pod’s own links and empty ones to the router', () => {
    assert.equal(routeForFeedLink('sagepod://feed/3'), null);
    assert.equal(routeForFeedLink('/feed/3'), null);
    assert.equal(routeForFeedLink('itpc://'), null);
  });
});
