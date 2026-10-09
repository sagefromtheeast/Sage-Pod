import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  checkBackup,
  escapeHtml,
  exportFileName,
  exportMimeType,
  favouritesHtml,
  subscriptionsHtml,
  type BackupInfo,
} from '../formats';

describe('export file names', () => {
  // 9 October 2026, 11 pm local: still the 9th, whatever UTC says.
  const now = new Date(2026, 9, 9, 23).getTime();

  it('dates each export by the local day', () => {
    assert.equal(exportFileName('opml', now), 'sagepod-feeds-2026-10-09.opml');
    assert.equal(exportFileName('html', now), 'sagepod-feeds-2026-10-09.html');
    assert.equal(exportFileName('favourites', now), 'sagepod-favourites-2026-10-09.html');
    assert.equal(exportFileName('database', now), 'sagepod-backup-2026-10-09.db');
  });

  it('gives each a type the system can open', () => {
    assert.equal(exportMimeType('opml'), 'text/x-opml');
    assert.equal(exportMimeType('favourites'), 'text/html');
  });
});

describe('HTML exports', () => {
  it('escapes everything that comes from a feed', () => {
    assert.equal(escapeHtml(`<b>"Tom & Jerry's"</b>`), '&lt;b&gt;&quot;Tom &amp; Jerry&#39;s&quot;&lt;/b&gt;');
    const html = subscriptionsHtml([
      {
        title: '<script>x</script>',
        author: null,
        feedUrl: 'https://a.example/rss?a=1&b=2',
        link: null,
        imageUrl: null,
      },
    ]);
    assert.ok(!html.includes('<script>x'));
    assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
    assert.ok(html.includes('href="https://a.example/rss?a=1&amp;b=2"'));
  });

  it('lists each podcast with its website, feed and artwork', () => {
    const html = subscriptionsHtml([
      {
        title: 'Hard Fork',
        author: 'The New York Times',
        feedUrl: 'https://feeds.example/hardfork',
        link: 'https://nytimes.example/hardfork',
        imageUrl: 'https://img.example/hf.jpg',
      },
      { title: 'Second', author: null, feedUrl: 'https://feeds.example/2', link: null, imageUrl: null },
    ]);
    assert.ok(html.startsWith('<!DOCTYPE html>'));
    assert.ok(html.includes('<p>2 podcasts</p>'));
    assert.ok(
      html.includes(
        '<a href="https://nytimes.example/hardfork">Website</a> · <a href="https://feeds.example/hardfork">Feed</a>'
      )
    );
    assert.ok(html.includes('<img src="https://img.example/hf.jpg" alt="">'));
    assert.equal(html.match(/<li>/g)?.length, 2);
  });

  it('never turns a non-web address into a link', () => {
    const html = subscriptionsHtml([
      { title: 'Odd', author: null, feedUrl: 'https://f.example', link: 'javascript:alert(1)', imageUrl: 'file:///x' },
    ]);
    assert.ok(!html.includes('javascript:'));
    assert.ok(!html.includes('file:///'));
  });

  it('groups favourites by podcast, linking the page or else the audio', () => {
    const html = favouritesHtml([
      {
        feedTitle: 'Show A',
        feedLink: 'https://a.example',
        title: 'Ep 1',
        link: 'https://a.example/1',
        mediaUrl: 'https://cdn.example/1.mp3',
        publishedAt: new Date(2026, 0, 5, 12).getTime(),
      },
      {
        feedTitle: 'Show B',
        feedLink: null,
        title: 'Ep 9',
        link: null,
        mediaUrl: 'https://cdn.example/9.mp3',
        publishedAt: null,
      },
      {
        feedTitle: 'Show A',
        feedLink: 'https://a.example',
        title: 'Ep 2',
        link: null,
        mediaUrl: null,
        publishedAt: null,
      },
    ]);
    assert.equal(html.match(/<h2>/g)?.length, 2);
    assert.ok(html.includes('<h2><a href="https://a.example">Show A</a></h2>'));
    assert.ok(html.includes('<h2>Show B</h2>'));
    assert.ok(html.includes('<a href="https://a.example/1">Ep 1</a><br><small>2026-01-05</small>'));
    assert.ok(html.includes('<a href="https://cdn.example/9.mp3">Ep 9</a>'));
    assert.ok(html.includes('<li><div>Ep 2</div></li>'));
    // Both of Show A's episodes sit under its one heading.
    assert.ok(html.indexOf('Ep 2') < html.indexOf('Show B'));
  });

  it('says so when there is nothing to export', () => {
    assert.ok(subscriptionsHtml([]).includes('No subscriptions.'));
    assert.ok(favouritesHtml([]).includes('No favourites.'));
  });
});

describe('database backup check', () => {
  const good: BackupInfo = {
    userVersion: 6,
    tables: ['feeds', 'episodes', 'queue', 'settings', 'playback_history', 'download_log'],
    integrity: 'ok',
    feeds: 3,
    episodes: 40,
  };

  it('accepts a Sage Pod backup from this version or an older one', () => {
    assert.deepEqual(checkBackup(good, 6), { ok: true });
    assert.deepEqual(checkBackup({ ...good, userVersion: 1, tables: good.tables.slice(0, 4) }, 6), { ok: true });
  });

  it("refuses a file that isn't a Sage Pod database", () => {
    const antennaPod = { ...good, tables: ['Feeds', 'FeedItems', 'Queue'], userVersion: 3050000 };
    const result = checkBackup(antennaPod, 6);
    assert.equal(result.ok, false);
    assert.match(!result.ok ? result.reason : '', /isn't a Sage Pod backup.*OPML/);
    assert.equal(checkBackup({ ...good, userVersion: 0 }, 6).ok, false);
  });

  it('refuses a backup from a newer app', () => {
    const result = checkBackup({ ...good, userVersion: 7 }, 6);
    assert.match(!result.ok ? result.reason : '', /newer version/);
  });

  it('refuses a damaged backup', () => {
    const result = checkBackup({ ...good, integrity: '*** in database main ***' }, 6);
    assert.match(!result.ok ? result.reason : '', /damaged/);
  });
});
