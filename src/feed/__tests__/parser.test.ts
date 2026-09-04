import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseFeed } from '../parser';
import { ATOM, NOT_A_FEED, RSS_MESSY, RSS_STANDARD } from './fixtures';

const BASE = 'https://feeds.example.com/show.xml';

describe('parseFeed — well-formed RSS 2.0', () => {
  const feed = parseFeed(RSS_STANDARD, BASE);

  it('reads channel metadata', () => {
    assert.equal(feed.title, 'Deep Field');
    assert.equal(feed.author, 'Orbital Media');
    assert.equal(feed.language, 'en-us');
    assert.equal(feed.explicit, false);
    assert.equal(feed.imageUrl, 'https://cdn.example.com/art.jpg');
  });

  it('resolves relative channel links against the feed URL', () => {
    assert.equal(feed.link, 'https://feeds.example.com/show');
  });

  it('orders episodes newest first', () => {
    assert.deepEqual(
      feed.episodes.map((e) => e.title),
      ['The Great Attractor', 'Voids']
    );
  });

  it('parses both HH:MM:SS and bare-seconds durations', () => {
    assert.equal(feed.episodes[0].duration, 3753);
    assert.equal(feed.episodes[1].duration, 3011);
  });

  it('reads season, episode number, guid and enclosure length', () => {
    const [first] = feed.episodes;
    assert.equal(first.season, 2);
    assert.equal(first.episodeNumber, 14);
    assert.equal(first.guid, 'ep-002');
    assert.equal(first.mediaSize, 60123456);
  });

  it('prefers content:encoded over description for show notes', () => {
    assert.ok(feed.episodes[0].description?.includes('<a href'));
  });

  it('resolves relative enclosure URLs', () => {
    assert.equal(feed.episodes[1].mediaUrl, 'https://feeds.example.com/audio/ep1.mp3');
  });

  it('falls back to channel artwork for episodes without their own', () => {
    assert.equal(feed.episodes[1].imageUrl, 'https://cdn.example.com/art.jpg');
  });
});

describe('parseFeed — non-conforming feeds', () => {
  const feed = parseFeed(RSS_MESSY, BASE);

  it('handles a channel with a single non-array <item>', () => {
    assert.equal(feed.episodes.length, 1);
  });

  it('prefers an audio enclosure over a video media:content', () => {
    assert.equal(feed.episodes[0].mediaUrl, 'https://cdn.example.com/only.m4a');
  });

  it('parses MM:SS durations', () => {
    assert.equal(feed.episodes[0].duration, 2710);
  });

  it('reads artwork from <image><url> and resolves it', () => {
    assert.equal(feed.imageUrl, 'https://feeds.example.com/art/cover.png');
  });

  it('lets per-episode artwork override the channel artwork', () => {
    assert.equal(feed.episodes[0].imageUrl, 'https://cdn.example.com/ep.jpg');
  });

  it('falls back to the media URL when <guid> is missing', () => {
    assert.equal(feed.episodes[0].guid, 'https://cdn.example.com/only.m4a');
  });

  it('parses ISO-8601 publish dates as well as RFC-822', () => {
    assert.equal(
      new Date(feed.episodes[0].publishedAt as number).toISOString(),
      '2025-08-01T10:30:00.000Z'
    );
  });
});

describe('parseFeed — Atom and rejects', () => {
  const feed = parseFeed(ATOM, BASE);

  it('parses Atom <entry> elements', () => {
    assert.equal(feed.title, 'Atom Cast');
    assert.equal(feed.episodes[0].guid, 'urn:uuid:alpha');
  });

  it('drops duplicate GUIDs and entries with no playable media', () => {
    // The unique (feed_id, guid) index would reject a duplicate on insert, and
    // an entry with no enclosure has nothing to play.
    assert.deepEqual(
      feed.episodes.map((e) => e.title),
      ['Alpha']
    );
  });

  it('rejects a document that is not a feed', () => {
    assert.throws(() => parseFeed(NOT_A_FEED, BASE), /Not a podcast feed/);
  });
});
