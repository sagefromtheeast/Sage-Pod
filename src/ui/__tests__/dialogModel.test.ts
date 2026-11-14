import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { arrangeButtons, buttonLayout, createDialogQueue, dismissButton, toneFor } from '../dialogModel';

describe('arrangeButtons', () => {
  it('gives a bare dialog an OK button', () => {
    assert.deepEqual(arrangeButtons(undefined), [{ text: 'OK' }]);
    assert.deepEqual(arrangeButtons([]), [{ text: 'OK' }]);
  });

  it('puts Cancel first and keeps the rest in order', () => {
    const order = arrangeButtons([
      { text: 'Delete', style: 'destructive' },
      { text: 'Cancel', style: 'cancel' },
      { text: 'Keep', style: 'default' },
    ]).map((b) => b.text);
    assert.deepEqual(order, ['Cancel', 'Delete', 'Keep']);
  });
});

describe('toneFor', () => {
  it('is danger when anything is destructive', () => {
    assert.equal(toneFor([{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive' }]), 'danger');
    assert.equal(toneFor([{ text: 'OK' }]), 'notice');
  });
});

describe('dismissButton', () => {
  const buttons = [{ text: 'Cancel', style: 'cancel' as const }, { text: 'Go' }];

  it('maps Back and the scrim to the cancel button', () => {
    assert.equal(dismissButton({ buttons, cancelable: true })?.text, 'Cancel');
  });

  it('does nothing for a dialog that cannot be cancelled, or has no cancel button', () => {
    assert.equal(dismissButton({ buttons, cancelable: false }), null);
    assert.equal(dismissButton({ buttons: [{ text: 'OK' }], cancelable: true }), null);
  });
});

describe('buttonLayout', () => {
  it('sits two short buttons side by side', () => {
    assert.equal(buttonLayout([{ text: 'Cancel' }, { text: 'Delete' }]), 'row');
  });

  it('stacks three buttons or a long label', () => {
    assert.equal(buttonLayout([{ text: 'A' }, { text: 'B' }, { text: 'C' }]), 'stack');
    assert.equal(buttonLayout([{ text: 'Cancel' }, { text: 'Download on mobile data' }]), 'stack');
  });
});

describe('createDialogQueue', () => {
  it('shows one dialog at a time, in the order asked', () => {
    const queue = createDialogQueue();
    const first = queue.push('First');
    const second = queue.push('Second', 'More');
    assert.equal(queue.current()?.id, first.id);
    queue.close(second.id); // not on screen: ignored
    assert.equal(queue.size(), 2);
    queue.close(first.id);
    assert.equal(queue.current()?.title, 'Second');
    assert.equal(queue.current()?.message, 'More');
    queue.close(second.id);
    assert.equal(queue.current(), null);
  });

  it('is cancelable unless told otherwise', () => {
    const queue = createDialogQueue();
    assert.equal(queue.push('A').cancelable, true);
    queue.close(1);
    assert.equal(queue.push('B', undefined, undefined, { cancelable: false }).cancelable, false);
  });
});
