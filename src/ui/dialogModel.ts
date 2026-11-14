/**
 * The logic behind Sage Pod's own alert dialog (`showDialog`), kept free of
 * React Native so the node test runner can load it. The API mirrors
 * `Alert.alert(title, message, buttons, options)` on purpose: every call site
 * moves over by changing one name, and the buttons keep Android's meaning
 * (a `cancel` button is what Back and tapping outside do).
 */

export type DialogButtonStyle = 'default' | 'cancel' | 'destructive';

export type DialogButton = {
  text: string;
  style?: DialogButtonStyle;
  onPress?: () => void | Promise<void>;
};

export type DialogOptions = {
  /** Back and a tap outside close the dialog. Default true, as on Android. */
  cancelable?: boolean;
  /** Runs when Back or a tap outside closes it, as `Alert`'s onDismiss does. */
  onDismiss?: () => void;
};

/** danger: something is about to be removed. notice: information or an error. */
export type DialogTone = 'danger' | 'notice';

export type DialogRequest = {
  id: number;
  title: string;
  message?: string;
  buttons: DialogButton[];
  cancelable: boolean;
  tone: DialogTone;
  onDismiss?: () => void;
};

/** A dialog with no buttons still needs a way out. */
const DEFAULT_BUTTONS: DialogButton[] = [{ text: 'OK' }];

/**
 * Button order on screen: the dismissive one first (left, or top when
 * stacked) and the confirming one last, where the thumb lands — Material's
 * order, and the order AntennaPod's dialogs use.
 */
export function arrangeButtons(buttons: readonly DialogButton[] | undefined): DialogButton[] {
  const list = buttons && buttons.length > 0 ? [...buttons] : [...DEFAULT_BUTTONS];
  const cancel = list.filter((b) => b.style === 'cancel');
  const rest = list.filter((b) => b.style !== 'cancel');
  return [...cancel, ...rest];
}

export function toneFor(buttons: readonly DialogButton[]): DialogTone {
  return buttons.some((b) => b.style === 'destructive') ? 'danger' : 'notice';
}

/** What Back or a tap on the scrim does: the cancel button, if there is one. */
export function dismissButton(request: Pick<DialogRequest, 'buttons' | 'cancelable'>): DialogButton | null {
  if (!request.cancelable) return null;
  return request.buttons.find((b) => b.style === 'cancel') ?? null;
}

/** Side by side for two short buttons; stacked otherwise, so no label is cut. */
export function buttonLayout(buttons: readonly DialogButton[]): 'row' | 'stack' {
  if (buttons.length > 2) return 'stack';
  return buttons.every((b) => b.text.length <= 14) ? 'row' : 'stack';
}

/**
 * Dialogs wait their turn, as stacked system alerts do: a second request made
 * while one is open shows once the first is answered.
 */
export function createDialogQueue() {
  let nextId = 1;
  const pending: DialogRequest[] = [];
  return {
    push(title: string, message?: string, buttons?: readonly DialogButton[], options?: DialogOptions): DialogRequest {
      const arranged = arrangeButtons(buttons);
      const request: DialogRequest = {
        id: nextId++,
        title,
        message: message || undefined,
        buttons: arranged,
        cancelable: options?.cancelable ?? true,
        tone: toneFor(arranged),
        onDismiss: options?.onDismiss,
      };
      pending.push(request);
      return request;
    },
    /** The dialog on screen, if any. */
    current(): DialogRequest | null {
      return pending[0] ?? null;
    },
    /** Closes the dialog with this id (a stale id does nothing). */
    close(id: number): void {
      if (pending[0]?.id === id) pending.shift();
    },
    size(): number {
      return pending.length;
    },
  };
}
