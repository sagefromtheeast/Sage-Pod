import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { downloadFailedContent, newEpisodesContent, notificationUrl, refreshFailedContent } from '../content';

describe('notification content', () => {
  it('names a single new episode under its podcast', () => {
    assert.deepEqual(newEpisodesContent(4, 'Deep Time', ['The comet that came back']), {
      title: 'Deep Time',
      body: 'The comet that came back',
      url: '/feed/4',
    });
  });

  it('counts several new episodes and lists the first two', () => {
    const content = newEpisodesContent(4, 'Deep Time', ['A', 'B', 'C', 'D']);
    assert.equal(content.title, 'Deep Time: 4 new episodes');
    assert.equal(content.body, 'A, B and 2 more');
    assert.equal(newEpisodesContent(4, 'Deep Time', ['A', 'B']).body, 'A and B');
  });

  it('says why a download failed and opens Downloads', () => {
    assert.deepEqual(downloadFailedContent('Ep 1', 'The server refused the download.'), {
      title: 'Download failed',
      body: 'Ep 1: The server refused the download.',
      url: '/downloads',
    });
  });

  it('opens the one podcast that failed, or the Library for several', () => {
    assert.equal(refreshFailedContent([{ feedId: 2, title: 'Field Notes' }]).url, '/feed/2');
    const several = refreshFailedContent([
      { feedId: 2, title: 'Field Notes' },
      { feedId: 3, title: 'Deep Time' },
      { feedId: 5, title: 'Night Shift' },
    ]);
    assert.equal(several.title, "Couldn't refresh 3 podcasts");
    assert.equal(several.body, 'Field Notes, Deep Time and 1 more');
    assert.equal(several.url, '/library');
  });

  it('only follows the app’s own paths from a tap', () => {
    assert.equal(notificationUrl({ url: '/feed/3' }), '/feed/3');
    assert.equal(notificationUrl({ url: 'https://evil.example' }), null);
    assert.equal(notificationUrl({ url: '//evil.example' }), null);
    assert.equal(notificationUrl(null), null);
    assert.equal(notificationUrl({}), null);
  });
});
