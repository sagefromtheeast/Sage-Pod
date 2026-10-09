import type { AudioPlayer } from 'expo-audio';

/**
 * What patches/expo-audio+57.0.5.patch adds to expo-audio (D-025): skip
 * silence and volume boost (Android), the listener's skip amounts and a next
 * button on the lock screen, and a "remoteNext" event when it is pressed.
 * Every call checks the patched function exists, so web and an unpatched
 * build simply go without.
 */

export type LockScreenOptions = {
  showSeekForward: boolean;
  showSeekBackward: boolean;
  isLiveStream?: boolean;
  seekForwardSeconds?: number;
  seekBackwardSeconds?: number;
  showNext?: boolean;
};

type PatchedPlayer = AudioPlayer & {
  setSkipSilence?: (enabled: boolean) => void;
  setVolumeBoost?: (millibels: number) => void;
  addListener(event: 'remoteNext', listener: () => void): { remove: () => void };
};

export function setSkipSilence(player: AudioPlayer, enabled: boolean): void {
  (player as PatchedPlayer).setSkipSilence?.(enabled);
}

export function setVolumeBoost(player: AudioPlayer, millibels: number): void {
  (player as PatchedPlayer).setVolumeBoost?.(Math.max(0, Math.round(millibels)));
}

/** Skip silence and volume boost need the Android engine. */
export function supportsAudioEffects(platform: string): boolean {
  return platform === 'android';
}

export function onRemoteNext(player: AudioPlayer, listener: () => void): { remove: () => void } {
  return (player as PatchedPlayer).addListener('remoteNext', listener);
}

export function lockScreenOptions(skipForward: number, skipBackward: number): LockScreenOptions {
  return {
    showSeekForward: true,
    showSeekBackward: true,
    isLiveStream: false,
    seekForwardSeconds: skipForward,
    seekBackwardSeconds: skipBackward,
    showNext: true,
  };
}
