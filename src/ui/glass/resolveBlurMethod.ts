import type { BlurMethod, BlurViewProps } from 'expo-blur';

/**
 * Resolves the Android blur method safely.
 * When blurTarget is absent, defaults to 'none' to avoid console warnings and native errors.
 */
export function resolveBlurMethod(
  blurTarget?: BlurViewProps['blurTarget'],
  blurMethod?: BlurMethod
): BlurMethod {
  if (!blurTarget) {
    return 'none';
  }
  return blurMethod ?? 'dimezisBlurView';
}
