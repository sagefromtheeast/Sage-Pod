import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { useSetting } from '@/db/settings';

export type GlassCapabilityLevel =
  | 'native_liquid_glass' // iOS 26+ native UIGlassEffect and GlassContainer
  | 'blur_fallback'       // Android & iOS < 26 with BlurView
  | 'solid_surface';      // Reduce transparency enabled or low-spec fallback

function checkNativeGlass(): boolean {
  if (Platform.OS !== 'ios') return false;
  try {
    const { isGlassEffectAPIAvailable, isLiquidGlassAvailable } = require('expo-glass-effect');
    return Boolean(
      typeof isGlassEffectAPIAvailable === 'function' &&
      isGlassEffectAPIAvailable() &&
      typeof isLiquidGlassAvailable === 'function' &&
      isLiquidGlassAvailable()
    );
  } catch {
    return false;
  }
}

/**
 * Returns the active glass capability level for the current device and user settings.
 * Listens for system "Reduce Transparency" accessibility changes dynamically.
 */
export function useGlassCapability(): GlassCapabilityLevel {
  const enabled = useSetting('glassEffects');
  const [reduceTransparency, setReduceTransparency] = useState(false);
  const [hasNativeGlass] = useState(() => checkNativeGlass());

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceTransparencyEnabled().then((enabled) => {
      if (mounted) setReduceTransparency(enabled);
    });

    const subscription = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      (enabled) => {
        setReduceTransparency(enabled);
      }
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  // Glass is opt-in (Settings › User interface › Glass effects).
  if (!enabled || reduceTransparency) {
    return 'solid_surface';
  }

  if (hasNativeGlass) {
    return 'native_liquid_glass';
  }

  return 'blur_fallback';
}

/** Whether the tab bar and mini player float as glass capsules (opt-in) or dock as solid bars. */
export function useGlassEffects(): boolean {
  return useSetting('glassEffects');
}
