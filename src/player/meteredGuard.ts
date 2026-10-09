import { Alert, Platform } from 'react-native';

import { getSettings } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';

import { onCellular } from './downloads';

/**
 * AntennaPod's "Confirm mobile streaming": with streaming over mobile data
 * turned off in Settings › Downloads, playing an episode that isn't
 * downloaded on a cellular connection asks first. Resolves true to go ahead.
 * With `ask: false` (nobody tapped play) it answers no instead of asking.
 */
export async function confirmMeteredStreaming(
  episode: EpisodeWithFeed,
  { ask }: { ask: boolean }
): Promise<boolean> {
  if (getSettings().mobileStreaming || episode.download_state === 'done') return true;
  // react-native-web's Alert does nothing, so the promise below would never settle.
  if (Platform.OS === 'web') return true;
  if (!(await onCellular())) return true;
  if (!ask) return false;
  return new Promise((resolve) => {
    Alert.alert(
      'Stream over mobile data?',
      'This episode isn’t downloaded. You can allow streaming over mobile data in Settings › Downloads.',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Stream', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
