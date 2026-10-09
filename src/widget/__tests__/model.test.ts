import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EMPTY_WIDGET, widgetKey, widgetModel } from '../model';

const episode = {
  id: 7,
  title: 'Episode seven',
  feed_title: 'A podcast',
  image_url: null,
  feed_image_url: 'https://example.com/cover.jpg',
};

describe('widget model', () => {
  it('shows an invitation when nothing is loaded', () => {
    assert.deepEqual(widgetModel({ episode: null, playing: false, position: 0, duration: 0 }), EMPTY_WIDGET);
  });

  it('describes the loaded episode', () => {
    const model = widgetModel({ episode, playing: true, position: 600, duration: 1800 });
    assert.equal(model.episodeId, 7);
    assert.equal(model.title, 'Episode seven');
    assert.equal(model.podcast, 'A podcast');
    assert.equal(model.playing, true);
    assert.equal(model.progress, 1 / 3);
    assert.equal(model.remaining, '20 min left');
  });

  it('uses only artwork the launcher can fetch, episode art first', () => {
    assert.equal(
      widgetModel({ episode, playing: false, position: 0, duration: 0 }).artwork,
      'https://example.com/cover.jpg'
    );
    const own = { ...episode, image_url: 'http://example.com/ep.png' };
    assert.equal(
      widgetModel({ episode: own, playing: false, position: 0, duration: 0 }).artwork,
      'http://example.com/ep.png'
    );
    const local = { ...episode, image_url: 'file:///art.jpg', feed_image_url: null };
    assert.equal(widgetModel({ episode: local, playing: false, position: 0, duration: 0 }).artwork, null);
  });

  it('copes with an unknown length', () => {
    const model = widgetModel({ episode, playing: false, position: 90, duration: 0 });
    assert.equal(model.progress, 0);
    assert.equal(model.remaining, '');
  });

  it('changes key only when something visible changes', () => {
    const at = (position: number, playing = true) =>
      widgetKey(widgetModel({ episode, playing, position, duration: 3600 }));
    assert.equal(at(600), at(605));
    assert.notEqual(at(600), at(700));
    assert.notEqual(at(600), at(600, false));
  });
});
