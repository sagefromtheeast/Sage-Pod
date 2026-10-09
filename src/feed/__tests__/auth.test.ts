import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { basicAuthHeader, credentialsFor, splitCredentials } from '../auth';

describe('feed credentials', () => {
  it('takes the username and password out of a feed URL', () => {
    assert.deepEqual(splitCredentials('https://ann:p%40ss@example.com/feed.xml'), {
      url: 'https://example.com/feed.xml',
      credentials: { username: 'ann', password: 'p@ss' },
    });
    assert.deepEqual(splitCredentials('https://example.com/feed.xml'), {
      url: 'https://example.com/feed.xml',
      credentials: null,
    });
  });

  it('sends them only to the host they were saved for', () => {
    const stored = { username: 'ann', password: 'pw', host: 'example.com' };
    assert.deepEqual(credentialsFor('https://EXAMPLE.com/ep1.mp3', stored), { username: 'ann', password: 'pw' });
    assert.equal(credentialsFor('https://cdn.example.net/ep1.mp3', stored), null);
    assert.equal(credentialsFor('https://example.com/ep1.mp3', null), null);
    assert.equal(credentialsFor('https://example.com/ep1.mp3', { ...stored, username: '', password: '' }), null);
  });

  it('encodes Basic auth as UTF-8', () => {
    assert.equal(
      basicAuthHeader({ username: 'Aladdin', password: 'open sesame' }),
      'Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ=='
    );
    assert.equal(
      basicAuthHeader({ username: 'zoë', password: '€' }),
      `Basic ${Buffer.from('zoë:€').toString('base64')}`
    );
  });
});
