import { useEffect } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import type { EchoBackdrop as Backdrop } from '@/echo/cards';
import { echoPalette } from '@/ui/theme';

const SHAPES = echoPalette.shapes;
const shape = (i: number) => SHAPES[i % SHAPES.length];

/** A value that runs 0 → 1 over `duration` forever; it holds at 0 with reduce motion on. */
function useLoop(duration: number): SharedValue<number> {
  const still = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (still) return;
    t.value = withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1, false);
    return () => cancelAnimation(t);
  }, [still, duration, t]);
  return t;
}

const BUBBLES = [
  { x: 0.12, r: 46, phase: 0 },
  { x: 0.34, r: 22, phase: 0.55 },
  { x: 0.55, r: 64, phase: 0.25 },
  { x: 0.78, r: 30, phase: 0.8 },
  { x: 0.92, r: 52, phase: 0.4 },
  { x: 0.24, r: 36, phase: 0.7 },
  { x: 0.66, r: 18, phase: 0.1 },
];

function Bubble({ t, index, width, height }: { t: SharedValue<number>; index: number; width: number; height: number }) {
  const { x, r, phase } = BUBBLES[index];
  const style = useAnimatedStyle(() => {
    const p = (t.value + phase) % 1;
    return { transform: [{ translateY: height + r - p * (height + 2 * r) }] };
  });
  return (
    <Animated.View style={[styles.layer, { left: x * width - r, width: 2 * r, height: 2 * r }, style]}>
      <Svg width={2 * r} height={2 * r}>
        <Circle cx={r} cy={r} r={r} fill={shape(index)} />
      </Svg>
    </Animated.View>
  );
}

function Bubbles({ width, height }: { width: number; height: number }) {
  const t = useLoop(18_000);
  return (
    <>
      {BUBBLES.map((_, i) => (
        <Bubble key={i} t={t} index={i} width={width} height={height} />
      ))}
    </>
  );
}

const BARS = 22;

function Bar({
  t,
  index,
  width,
  barWidth,
}: {
  t: SharedValue<number>;
  index: number;
  width: number;
  barWidth: number;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scaleY: 0.35 + 0.65 * Math.abs(Math.sin(2 * Math.PI * t.value + index * 0.6)) }],
  }));
  return (
    <Animated.View
      style={[
        styles.bar,
        { left: (index * width) / BARS + barWidth / 2, width: barWidth, backgroundColor: shape(index) },
        style,
      ]}
    />
  );
}

function Waveform({ width }: { width: number }) {
  const t = useLoop(4_000);
  const barWidth = width / BARS / 2;
  return (
    <View style={styles.waveform}>
      {Array.from({ length: BARS }, (_, i) => (
        <Bar key={i} t={t} index={i} width={width} barWidth={barWidth} />
      ))}
    </View>
  );
}

const STRIPE = 64;

function Stripes({ width, height }: { width: number; height: number }) {
  const t = useLoop(6_000);
  const size = width + height + 2 * STRIPE;
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -t.value * 2 * STRIPE }] }));
  return (
    <Animated.View style={[styles.layer, { left: -height, top: 0 }, style]}>
      <Svg width={size + height} height={height}>
        {Array.from({ length: Math.ceil((size + height) / (2 * STRIPE)) }, (_, i) => (
          <Path
            key={i}
            d={`M ${i * 2 * STRIPE} ${height} L ${i * 2 * STRIPE + STRIPE} ${height} L ${
              i * 2 * STRIPE + STRIPE + height
            } 0 L ${i * 2 * STRIPE + height} 0 Z`}
            fill={shape(i)}
          />
        ))}
      </Svg>
    </Animated.View>
  );
}

function Square({ t, side, turns, color }: { t: SharedValue<number>; side: number; turns: number; color: string }) {
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${t.value * 360 * turns}deg` }] }));
  return (
    <Animated.View
      style={[styles.square, { width: side, height: side, marginLeft: -side / 2, marginTop: -side / 2 }, style]}
    >
      <Svg width={side} height={side}>
        <Rect x={0} y={0} width={side} height={side} fill="none" stroke={color} strokeWidth={18} />
      </Svg>
    </Animated.View>
  );
}

function Squares({ width, height }: { width: number; height: number }) {
  const t = useLoop(30_000);
  const base = Math.max(width, height);
  return (
    <>
      <Square t={t} side={base * 0.45} turns={1} color={shape(0)} />
      <Square t={t} side={base * 0.75} turns={-1} color={shape(3)} />
      <Square t={t} side={base * 1.05} turns={1} color={shape(2)} />
    </>
  );
}

/** A filled wave whose midline sits at `crest`, filled down to `bottom`. */
function wavePath(width: number, bottom: number, crest: number, amplitude: number, waves: number): string {
  const steps = 120;
  const points = Array.from({ length: steps + 1 }, (_, i) => {
    const x = (i / steps) * width;
    const y = crest - amplitude * Math.sin((i / steps) * waves * 2 * Math.PI);
    return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `M 0 ${bottom} ${points.join(' ')} L ${width} ${bottom} Z`;
}

function Waves({ width, height }: { width: number; height: number }) {
  const t = useLoop(9_000);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: -t.value * width }] }));
  return (
    <Animated.View style={[styles.layer, { left: 0, top: 0 }, style]}>
      <Svg width={2 * width} height={height}>
        <Path d={wavePath(2 * width, height, height * 0.62, 30, 2)} fill={shape(3)} />
        <Path d={wavePath(2 * width, height, height * 0.74, 44, 6)} fill={shape(0)} />
        <Path d={wavePath(2 * width, height, height * 0.86, 60, 4)} fill={shape(1)} />
      </Svg>
    </Animated.View>
  );
}

/** The moving shapes behind a story card, drawn faintly so the words stay readable. */
export function EchoBackdrop({ kind }: { kind: Backdrop }) {
  const { width, height } = useWindowDimensions();
  return (
    <View
      style={[StyleSheet.absoluteFill, styles.clip]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
    >
      <View style={[StyleSheet.absoluteFill, { opacity: echoPalette.shapeOpacity }]}>
        {kind === 'bubbles' ? <Bubbles width={width} height={height} /> : null}
        {kind === 'waveform' ? <Waveform width={width} /> : null}
        {kind === 'stripes' ? <Stripes width={width} height={height} /> : null}
        {kind === 'squares' ? <Squares width={width} height={height} /> : null}
        {kind === 'waves' ? <Waves width={width} height={height} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  layer: { position: 'absolute', top: 0 },
  waveform: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  bar: {
    position: 'absolute',
    bottom: 0,
    height: '100%',
    borderTopLeftRadius: 999,
    borderTopRightRadius: 999,
    transformOrigin: 'bottom',
  },
  square: { position: 'absolute', left: '50%', top: '50%' },
});
