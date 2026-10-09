import { Alert } from 'react-native';

import { getSettings } from '@/db/settings';
import type { EpisodeWithFeed } from '@/db/types';

import { onCellular } from './downloads';

/**
 * AntennaPod's "Confirm mobile streaming": with streaming over mobile data
 * turned off in Settings › Downloads, playing an episode that isn't
 * downloaded on a cellular connection asks first. Resolves true to go ahead.
 */
export async function confirmMeteredStreaming(episode: EpisodeWithFeed): Promise<boolean> {
  if (getSettings().mobileStreaming || episode.download_state === 'done') return true;
  if (!(await onCellular())) return true;
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
