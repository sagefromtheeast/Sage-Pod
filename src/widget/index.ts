import { Platform } from 'react-native';
import { registerWidgetTaskHandler, requestWidgetUpdate } from 'react-native-android-widget';

import { initDb } from '@/db';
import { loadSettings, settingsLoaded } from '@/db/settings';
import { player } from '@/player';
import { nowPlayingWidget, WIDGET_ACTIONS, WIDGET_NAME } from '@/widget/NowPlayingWidget';
import { widgetKey, widgetModel } from '@/widget/model';

/**
 * The Android home-screen widget (D-026). Its buttons run here, in the app's
 * own JavaScript: while Sage Pod is running they drive the same player as
 * the screens; when it isn't, Android starts the app's runtime without a
 * screen, and the player restores the last episode before acting on it.
 */

/** Settings, the database and the last episode, as app startup does them. */
async function ensurePlayer(): Promise<void> {
  await initDb();
  if (!settingsLoaded()) await loadSettings();
  await player.init();
}

// Registered when the bundle loads, before any screen: a widget tap may be
// what started the app.
if (Platform.OS === 'android') {
  registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, clickAction, renderWidget }) => {
    if (widgetAction === 'WIDGET_DELETED') return;
    try {
      await ensurePlayer();
      if (widgetAction === 'WIDGET_CLICK') {
        if (clickAction === WIDGET_ACTIONS.toggle) player.togglePlayPause();
        else if (clickAction === WIDGET_ACTIONS.back) await player.skipBackward();
        else if (clickAction === WIDGET_ACTIONS.forward) await player.skipForward();
        else if (clickAction === WIDGET_ACTIONS.next) await player.skipToNext();
      }
    } finally {
      // Draw whatever the player has, even when restoring it failed.
      renderWidget(nowPlayingWidget(widgetModel(player.getState()), widgetInfo.width, widgetInfo.height));
    }
  });

  // Follow the player from then on, redrawing only on a visible change.
  let lastKey = '';
  player.subscribe((state) => {
    const model = widgetModel(state);
    const key = widgetKey(model);
    if (key === lastKey) return;
    lastKey = key;
    void requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: ({ width, height }) => nowPlayingWidget(model, width, height),
    }).catch(() => {
      // No widget on the home screen, or the launcher is busy: nothing to do.
    });
  });
}
