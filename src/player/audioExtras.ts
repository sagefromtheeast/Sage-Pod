import type { AudioLockScreenOptions, AudioPlayer } from 'expo-audio';

/**
 * What the expo-audio patch adds (D-025, `patches/expo-audio+*.patch`): skip
 * silence and volume boost (Android), and a "remoteNext" event when a single
 * player's Next button is pressed (notification, lock screen, headset).
 * expo-audio 58 draws the listener's skip amounts and the Next button itself.
 * Every call checks the patched function exists, so web and an unpatched
 * build simply go without.
 */

export type LockScreenOptions = AudioLockScreenOptions;

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
    seekForwardIntervalSeconds: skipForward,
    seekBackwardIntervalSeconds: skipBackward,
    showNextTrack: true,
  };
}
