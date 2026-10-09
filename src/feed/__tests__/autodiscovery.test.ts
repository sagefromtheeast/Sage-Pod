import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { findFeedLinks, looksLikeHtml } from '../autodiscovery';

const PAGE = `<!DOCTYPE html><html><head>
  <link rel="stylesheet" href="/style.css">
  <link rel="alternate" type="application/rss+xml" title="Main feed" href="/feed.xml?a=1&amp;b=2">
  <link type='application/atom+xml' href='https://cdn.example.com/atom' rel='alternate'>
  <link rel="alternate" type="application/rss+xml" href="/feed.xml?a=1&amp;b=2">
  <link rel="alternate" type="text/html" hreflang="de" href="/de/">
</head><body></body></html>`;

describe('feed autodiscovery', () => {
  it('finds RSS and Atom links in page order, resolved and de-duplicated', () => {
    assert.deepEqual(findFeedLinks(PAGE, 'https://example.com/show/'), [
      { url: 'https://example.com/feed.xml?a=1&b=2', title: 'Main feed' },
      { url: 'https://cdn.example.com/atom', title: null },
    ]);
  });

  it('finds nothing on a page without feed links', () => {
    assert.deepEqual(findFeedLinks('<html><head><title>x</title></head></html>', 'https://e.com'), []);
  });

  it('tells pages from feeds', () => {
    assert.equal(looksLikeHtml(PAGE, null), true);
    assert.equal(looksLikeHtml('<?xml version="1.0"?><rss version="2.0">', null), false);
    assert.equal(looksLikeHtml('<html>', 'text/html; charset=utf-8'), true);
    assert.equal(looksLikeHtml('<?xml version="1.0"?>\n<rss version="2.0"><channel>', 'text/html'), false);
  });
});
