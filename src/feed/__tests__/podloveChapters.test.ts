import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { parseChapters } from '../../player/chapters';
import { parseFeed } from '../parser';
import { parseNormalPlayTime } from '../podloveChapters';

const BASE = 'https://feeds.example.com/show.xml';

describe('parseNormalPlayTime', () => {
  it('reads hours, minutes and seconds', () => {
    assert.equal(parseNormalPlayTime('01:02:03.500'), 3723.5);
    assert.equal(parseNormalPlayTime('12:34'), 754);
    assert.equal(parseNormalPlayTime('42'), 42);
    assert.equal(parseNormalPlayTime('7.25'), 7.25);
  });

  it('rejects anything else', () => {
    assert.equal(parseNormalPlayTime(''), null);
    assert.equal(parseNormalPlayTime('1:2:3:4'), null);
    assert.equal(parseNormalPlayTime('ab:cd'), null);
    assert.equal(parseNormalPlayTime('1.5:00'), null);
    assert.equal(parseNormalPlayTime(null), null);
  });
});

function feed(chapters: string): string {
  return `<?xml version="1.0"?>
<rss version="2.0" xmlns:psc="http://podlove.org/simple-chapters">
  <channel>
    <title>Show</title>
    <item>
      <title>Episode</title>
      <guid>ep-1</guid>
      <enclosure url="https://cdn.example.com/ep1.mp3" type="audio/mpeg"/>
      ${chapters}
    </item>
  </channel>
</rss>`;
}

describe('parseFeed — Podlove Simple Chapters', () => {
  it('reads every chapter, sorted, with links resolved', () => {
    const [episode] = parseFeed(
      feed(`<psc:chapters version="1.2">
        <psc:chapter start="00:12:00" title="Interview" href="/notes#interview" image="https://img.example.com/2.jpg"/>
        <psc:chapter start="00:00:00.000" title="Intro"/>
        <psc:chapter start="bad" title="Skipped"/>
        <psc:chapter start="30:00" title="Link" href="javascript:alert(1)"/>
      </psc:chapters>`),
      BASE
    ).episodes;
    assert.deepEqual(episode.chapters, [
      { startTime: 0, title: 'Intro', url: undefined, img: undefined },
      {
        startTime: 720,
        title: 'Interview',
        url: 'https://feeds.example.com/notes#interview',
        img: 'https://img.example.com/2.jpg',
      },
      { startTime: 1800, title: 'Link', url: undefined, img: undefined },
    ]);
  });

  it('reads a single chapter', () => {
    const [episode] = parseFeed(feed(`<psc:chapters><psc:chapter start="5" title="Only"/></psc:chapters>`), BASE).episodes;
    assert.deepEqual(episode.chapters, [{ startTime: 5, title: 'Only', url: undefined, img: undefined }]);
  });

  it('is null without chapters', () => {
    assert.equal(parseFeed(feed(''), BASE).episodes[0].chapters, null);
    assert.equal(parseFeed(feed('<psc:chapters/>'), BASE).episodes[0].chapters, null);
  });

  it('survives the round trip through the database', () => {
    const [episode] = parseFeed(feed(`<psc:chapters><psc:chapter start="1:00" title="One"/></psc:chapters>`), BASE).episodes;
    const stored = JSON.stringify(episode.chapters);
    assert.deepEqual(parseChapters({ chapters: JSON.parse(stored) }), [{ startTime: 60, title: 'One', img: undefined, url: undefined }]);
  });
});
