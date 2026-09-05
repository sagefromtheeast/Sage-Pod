import * as Haptics from 'expo-haptics';

export type HapticType = 'selection' | 'light' | 'medium' | 'heavy' | 'success' | 'warning';

/**
 * Fires sensory haptic feedback with silent fallback on unsupported platforms.
 */
export function triggerHaptic(type: HapticType = 'light'): void {
  try {
    switch (type) {
      case 'selection':
        void Haptics.selectionAsync();
        break;
      case 'light':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    // Fail silently on devices or web where haptics are not supported
  }
}
