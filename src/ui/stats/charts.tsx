import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { donutArc, type Slice } from '@/stats/aggregate';
import { space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/**
 * Slice shades: the accent at falling strengths, so the charts stay in the
 * app's palette. "Other" is drawn in the faint text colour.
 */
const SHADES = [1, 0.78, 0.6, 0.45, 0.33, 0.24];

export function sliceShade(index: number): number {
  return SHADES[Math.min(index, SHADES.length - 1)];
}

/** The colour and strength for a slice, shared by the chart and its legend dots. */
export function useSliceColor() {
  const theme = useTheme();
  return (key: unknown, index: number) =>
    key === 'other' ? { color: theme.textFaint, opacity: 1 } : { color: theme.accent, opacity: sliceShade(index) };
}

/** A donut of shares with a total in the middle (AntennaPod's statistics pie). */
export function DonutChart<K>({
  slices,
  size = 180,
  value,
  caption,
}: {
  slices: readonly Slice<K>[];
  size?: number;
  value: string;
  caption: string;
}) {
  const theme = useTheme();
  const colorFor = useSliceColor();
  const outer = size / 2;
  const inner = outer * 0.64;
  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${value} ${caption}`}>
      <Svg width={size} height={size}>
        {slices.length === 0 ? (
          <Path d={donutArc(outer, outer, outer, inner, 0, 1)} fill={theme.track} fillRule="evenodd" />
        ) : (
          slices.map((slice, index) => {
            const { color, opacity } = colorFor(slice.key, index);
            // A hair of gap between slices, unless there is only one.
            const gap = slices.length > 1 && slice.end - slice.start > 0.01 ? 0.003 : 0;
            return (
              <Path
                key={String(slice.key)}
                d={donutArc(outer, outer, outer, inner, slice.start + gap, slice.end - gap)}
                fill={color}
                fillOpacity={opacity}
                fillRule="evenodd"
              />
            );
          })
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.centre]} pointerEvents="none">
        <Text style={[styles.value, { color: theme.text }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.caption, { color: theme.textMuted }]}>{caption}</Text>
      </View>
    </View>
  );
}

/** Vertical bars with a label under each, e.g. the last twelve months. */
export function BarChart({
  bars,
  height = 140,
  accessibilityLabel,
}: {
  bars: readonly { key: string; label: string; value: number }[];
  height?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const last = bars.length - 1;
  return (
    <View accessibilityLabel={accessibilityLabel}>
      <View style={[styles.bars, { height }]}>
        {bars.map((bar, index) => {
          const barHeight = bar.value > 0 ? Math.max(3, (bar.value / max) * height) : 0;
          return (
            <View key={bar.key} style={styles.barCell}>
              <Svg width="100%" height={height}>
                <Rect x="0" y={0} width="100%" height={height} rx={4} fill={theme.track} fillOpacity={0.5} />
                {barHeight > 0 ? (
                  <Rect
                    x="0"
                    y={height - barHeight}
                    width="100%"
                    height={barHeight}
                    rx={4}
                    fill={theme.accent}
                    fillOpacity={index === last ? 1 : 0.7}
                  />
                ) : null}
              </Svg>
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {bars.map((bar) => (
          <Text key={bar.key} style={[styles.barLabel, { color: theme.textFaint }]}>
            {bar.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** A thin horizontal share bar, under a row's title. */
export function ShareBar({ share, color, opacity = 1 }: { share: number; color: string; opacity?: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.shareTrack, { backgroundColor: theme.track }]}>
      <View
        style={[
          styles.shareFill,
          { width: `${Math.max(0, Math.min(1, share)) * 100}%`, backgroundColor: color, opacity },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  value: {
    ...typography.heading,
    fontVariant: ['tabular-nums'],
  },
  caption: {
    ...typography.caption,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  barCell: {
    flex: 1,
  },
  labels: {
    flexDirection: 'row',
    gap: 6,
    marginTop: space.xs,
  },
  barLabel: {
    ...typography.caption,
    flex: 1,
    textAlign: 'center',
  },
  shareTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  shareFill: {
    height: 4,
    borderRadius: 2,
  },
});
