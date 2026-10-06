import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import { player } from '@/player';
import {
  clampSpeed,
  formatSpeed,
  MAX_SPEED,
  MIN_SPEED,
  parsePresets,
  serializePresets,
  SPEED_STEP,
  togglePreset,
} from '@/player/speed';
import { BottomSheet } from '@/ui/ActionSheet';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type Props = {
  visible: boolean;
  rate: number;
  /** The podcast whose own speed this changes, or null when it changes the global speed. */
  feedTitle: string | null;
  onClose: () => void;
};

/**
 * AntennaPod's speed dialog: a 0.5×–4× slider in 0.05 steps, − / + nudges,
 * and preset chips the listener can add to or remove from.
 */
export function SpeedSheet({ visible, rate, feedTitle, onClose }: Props) {
  const theme = useTheme();
  const presets = parsePresets(useSetting('speedPresets'));
  // Follow the finger while sliding; the engine only changes on release.
  const [draft, setDraft] = useState(rate);
  useEffect(() => setDraft(rate), [rate]);

  const apply = (value: number) => {
    const next = clampSpeed(value);
    setDraft(next);
    void player.setSpeed(next);
  };
  const isPreset = presets.includes(clampSpeed(draft));

  return (
    <BottomSheet visible={visible} title="Playback speed" subtitle={feedTitle ? `Saved for ${feedTitle}` : 'Saved for all podcasts'} onClose={onClose}>
      <View style={styles.body}>
        <Text style={[styles.readout, { color: theme.text }]} accessibilityLiveRegion="polite">
          {formatSpeed(draft)}
        </Text>

        <View style={styles.sliderRow}>
          <Nudge icon="remove" label="Slower" onPress={() => apply(draft - SPEED_STEP)} disabled={draft <= MIN_SPEED} />
          <Slider
            style={styles.slider}
            value={draft}
            minimumValue={MIN_SPEED}
            maximumValue={MAX_SPEED}
            step={SPEED_STEP}
            minimumTrackTintColor={theme.accent}
            maximumTrackTintColor={theme.track}
            thumbTintColor={theme.accent}
            onValueChange={(value) => setDraft(clampSpeed(value))}
            onSlidingComplete={apply}
            accessibilityLabel="Playback speed"
          />
          <Nudge icon="add" label="Faster" onPress={() => apply(draft + SPEED_STEP)} disabled={draft >= MAX_SPEED} />
        </View>

        <View style={styles.presets}>
          {presets.map((preset) => {
            const selected = preset === clampSpeed(draft);
            return (
              <Pressable
                key={preset}
                onPress={() => apply(preset)}
                style={[styles.chip, { backgroundColor: selected ? theme.accent : theme.surfaceAlt }]}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.chipLabel, { color: selected ? theme.onAccent : theme.text }]}>
                  {formatSpeed(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => void setSetting('speedPresets', serializePresets(togglePreset(presets, draft)))}
          // Keep at least one chip, so the row never vanishes.
          disabled={isPreset && presets.length <= 1}
          style={styles.presetToggle}
          accessibilityRole="button"
        >
          <Ionicons name={isPreset ? 'bookmark' : 'bookmark-outline'} size={16} color={theme.accent} />
          <Text style={[styles.presetToggleLabel, { color: theme.accent }]}>
            {isPreset ? `Remove ${formatSpeed(draft)} from presets` : `Save ${formatSpeed(draft)} as a preset`}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

function Nudge({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: 'add' | 'remove';
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={[styles.nudge, { backgroundColor: theme.surfaceAlt, opacity: disabled ? 0.4 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.lg,
  },
  readout: {
    ...typography.title,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  nudge: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space.sm,
  },
  chip: {
    minWidth: 60,
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  presetToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
  },
  presetToggleLabel: {
    ...typography.label,
    fontWeight: '600',
  },
});
