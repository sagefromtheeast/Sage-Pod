import { BlurView, type BlurMethod, type BlurViewProps } from 'expo-blur';
import { GlassView, type GlassStyle } from 'expo-glass-effect';
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';
import { resolveBlurMethod } from './resolveBlurMethod';
import { useGlassCapability } from './useGlassCapability';

export interface GlassSurfaceProps extends ViewProps {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Glass effect style to apply on iOS 26+.
   * @default 'regular'
   */
  glassEffectStyle?: GlassStyle;
  /**
   * Whether the native glass effect is interactive (touch-reactive).
   * @default false
   */
  isInteractive?: boolean;
  /**
   * Optional tint color to overlay on the glass.
   */
  tintColor?: string;
  /**
   * Corner radius for clipping.
   * @default radius.lg
   */
  borderRadius?: number;
  /**
   * A ref to a View or BlurTargetView that this BlurView will blur as its background on Android.
   * Required when using native Dimezis blur on Android.
   * @platform android
   */
  blurTarget?: BlurViewProps['blurTarget'];
  /**
   * Blur method to use on Android.
   * Defaults to 'dimezisBlurView' when `blurTarget` is configured, otherwise 'none' to avoid warnings.
   * @platform android
   */
  blurMethod?: BlurMethod;
  /**
   * Intensity of blur effect when falling back to BlurView.
   * @default 85
   */
  blurIntensity?: number;
}

export { resolveBlurMethod };

/**
 * Universal 3-tier Glass Surface component:
 * 1. Native iOS 26+ Liquid Glass (`GlassView`)
 * 2. Android & iOS < 26 BlurView with fallback rim
 * 3. High-contrast solid surface when Reduce Transparency is enabled
 */
export function GlassSurface({
  children,
  style,
  glassEffectStyle = 'regular',
  isInteractive = false,
  tintColor,
  borderRadius = radius.lg,
  blurTarget,
  blurMethod,
  blurIntensity = 85,
  ...rest
}: GlassSurfaceProps) {
  const theme = useTheme();
  const capability = useGlassCapability();

  const containerStyle: StyleProp<ViewStyle> = [
    styles.base,
    { borderRadius },
    style,
  ];

  if (capability === 'native_liquid_glass') {
    return (
      <View style={containerStyle} {...rest}>
        <GlassView
          style={StyleSheet.absoluteFill}
          glassEffectStyle={glassEffectStyle}
          isInteractive={isInteractive}
          tintColor={tintColor}
          colorScheme={theme.scheme === 'dark' || theme.scheme === 'oled' ? 'dark' : 'light'}
        />
        {children}
      </View>
    );
  }

  if (capability === 'blur_fallback') {
    const resolvedBlurMethod = resolveBlurMethod(blurTarget, blurMethod);

    return (
      <View
        style={[
          containerStyle,
          {
            borderColor: theme.border,
            borderWidth: StyleSheet.hairlineWidth,
            backgroundColor: theme.scheme === 'oled' ? 'rgba(0, 0, 0, 0.45)' : undefined,
          },
        ]}
        {...rest}
      >
        <BlurView
          style={StyleSheet.absoluteFill}
          tint={theme.scheme === 'dark' || theme.scheme === 'oled' ? 'dark' : 'light'}
          intensity={blurIntensity}
          blurMethod={resolvedBlurMethod}
          blurTarget={blurTarget}
        />
        {children}
      </View>
    );
  }

  // Accessibility / Reduce Transparency Solid Fallback
  return (
    <View
      style={[
        containerStyle,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
  },
});
