import { StyleSheet, View } from 'react-native';

import { useTheme } from './useTheme';

type Props = {
  /** 0..1. Values outside the range are clamped. */
  progress: number;
  height?: number;
  color?: string;
};

/** A thin, non-interactive progress indicator for list rows. */
export function ProgressBar({ progress, height = 3, color }: Props) {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));

  return (
    <View style={[styles.track, { height, backgroundColor: theme.track }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color ?? theme.accent },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
