import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

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

  if (reduceTransparency) {
    return 'solid_surface';
  }

  if (hasNativeGlass) {
    return 'native_liquid_glass';
  }

  // Web and platforms without blur support can fallback to solid surface if needed
  if (Platform.OS === 'web') {
    return 'blur_fallback';
  }

  return 'blur_fallback';
}
