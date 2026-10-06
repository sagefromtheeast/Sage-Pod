import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createStore } from '../store';

describe('createStore', () => {
  it('notifies subscribers on change and stops after unsubscribe', () => {
    const store = createStore(1);
    let calls = 0;
    const unsubscribe = store.subscribe(() => calls++);
    store.set(2);
    unsubscribe();
    store.set(3);
    assert.equal(calls, 1);
    assert.equal(store.get(), 3);
  });

  it('skips notifying when the value is unchanged', () => {
    const store = createStore('a');
    let calls = 0;
    store.subscribe(() => calls++);
    store.set('a');
    assert.equal(calls, 0);
  });

  it('tolerates a listener unsubscribing during notify', () => {
    const store = createStore(0);
    let second = 0;
    const off = store.subscribe(() => off());
    store.subscribe(() => second++);
    store.set(1);
    assert.equal(second, 1);
  });
});
