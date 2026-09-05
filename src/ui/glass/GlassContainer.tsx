import React from 'react';
import { View, type ViewProps } from 'react-native';
import { GlassContainer as NativeGlassContainer } from 'expo-glass-effect';
import { useGlassCapability } from './useGlassCapability';

export interface GlassContainerProps extends ViewProps {
  /**
   * Distance in points at which child glass elements begin to merge effects on iOS 26+.
   * @default 16
   */
  spacing?: number;
  children?: React.ReactNode;
}

/**
 * Container that groups child GlassSurface elements so the native iOS compositor
 * renders them in a single pass and computes proximity fusion (liquid droplets merging).
 */
export function GlassContainer({
  spacing = 16,
  style,
  children,
  ...rest
}: GlassContainerProps) {
  const capability = useGlassCapability();

  if (capability === 'native_liquid_glass') {
    return (
      <NativeGlassContainer spacing={spacing} style={style} {...rest}>
        {children}
      </NativeGlassContainer>
    );
  }

  return (
    <View style={style} {...rest}>
      {children}
    </View>
  );
}
