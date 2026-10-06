import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { setSetting, useSetting } from '@/db/settings';
import { player } from '@/player';
import { describeTimer, type SleepTimer } from '@/player/sleepTimer';
import { BottomSheet } from '@/ui/ActionSheet';
import { SettingsSwitch } from '@/ui/SettingsRow';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const QUICK_MINUTES = [5, 10, 15, 30, 45, 60] as const;
const MAX_MINUTES = 600;
const MAX_EPISODES = 20;

type Props = {
  visible: boolean;
  timer: SleepTimer | null;
  onClose: () => void;
};

const formatHour = (hour: number) => `${String(hour).padStart(2, '0')}:00`;

/**
 * AntennaPod's sleep timer dialog: minutes (quick picks or a custom amount,
 * remembered), a number of episodes, extend / turn off while running, and the
 * shake, vibrate and auto-enable options.
 */
export function SleepSheet({ visible, timer, onClose }: Props) {
  const theme = useTheme();
  const lastMinutes = useSetting('sleepMinutes');
  const shake = useSetting('sleepShakeToReset');
  const vibrate = useSetting('sleepVibrate');
  const autoEnable = useSetting('sleepAutoEnable');
  const autoFrom = useSetting('sleepAutoFrom');
  const autoTo = useSetting('sleepAutoTo');

  const [minutes, setMinutes] = useState(lastMinutes);
  const [episodes, setEpisodes] = useState(1);

  const startMinutes = (value: number) => {
    player.startSleepTimer(value);
    void setSetting('sleepMinutes', value);
    setMinutes(value);
    onClose();
  };
  const startEpisodes = (count: number) => {
    player.startEpisodesSleepTimer(count);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      title="Sleep timer"
      subtitle={timer ? describeTimer(timer, Date.now()).long : 'Off'}
      onClose={onClose}
    >
      <ScrollView bounces={false} contentContainerStyle={styles.body}>
        {timer ? (
          <View style={styles.row}>
            {(timer.kind === 'minutes' ? [5, 10, 15] : [1]).map((amount) => (
              <Chip
                key={amount}
                label={timer.kind === 'minutes' ? `+${amount} min` : '+1 episode'}
                onPress={() => player.extendSleepTimer(amount)}
              />
            ))}
            <Chip label="Turn off" danger onPress={() => player.cancelSleepTimer()} />
          </View>
        ) : null}

        <Text style={[styles.section, { color: theme.textMuted }]}>MINUTES</Text>
        <View style={styles.row}>
          {QUICK_MINUTES.map((value) => (
            <Chip key={value} label={`${value} min`} onPress={() => startMinutes(value)} />
          ))}
        </View>
        <View style={styles.customRow}>
          <Stepper
            value={minutes}
            format={(value) => `${value} min`}
            onChange={(value) => setMinutes(Math.min(MAX_MINUTES, Math.max(1, value)))}
            step={minutes < 10 ? 1 : 5}
            label="minutes"
          />
          <Chip label="Start" primary onPress={() => startMinutes(minutes)} />
        </View>

        <Text style={[styles.section, { color: theme.textMuted }]}>EPISODES</Text>
        <View style={styles.customRow}>
          <Stepper
            value={episodes}
            format={(value) => (value === 1 ? 'End of episode' : `${value} episodes`)}
            onChange={(value) => setEpisodes(Math.min(MAX_EPISODES, Math.max(1, value)))}
            step={1}
            label="episodes"
          />
          <Chip label="Start" primary onPress={() => startEpisodes(episodes)} />
        </View>

        <Text style={[styles.section, { color: theme.textMuted }]}>OPTIONS</Text>
        <SettingsSwitch
          label="Shake to reset"
          description="In the last 10 seconds, shake the phone to start the timer again."
          value={shake}
          onValueChange={(value) => void setSetting('sleepShakeToReset', value)}
        />
        <SettingsSwitch
          label="Vibrate"
          description="Vibrate when the timer has 10 seconds left."
          value={vibrate}
          onValueChange={(value) => void setSetting('sleepVibrate', value)}
        />
        <SettingsSwitch
          label="Turn on automatically"
          description={`Starts a ${lastMinutes} min timer when you press play between ${formatHour(autoFrom)} and ${formatHour(autoTo)}.`}
          value={autoEnable}
          onValueChange={(value) => void setSetting('sleepAutoEnable', value)}
        />
        {autoEnable ? (
          <View style={styles.windowRow}>
            <Text style={[styles.windowLabel, { color: theme.textMuted }]}>From</Text>
            <Stepper
              value={autoFrom}
              format={formatHour}
              onChange={(value) => void setSetting('sleepAutoFrom', (value + 24) % 24)}
              step={1}
              label="start hour"
            />
            <Text style={[styles.windowLabel, { color: theme.textMuted }]}>to</Text>
            <Stepper
              value={autoTo}
              format={formatHour}
              onChange={(value) => void setSetting('sleepAutoTo', (value + 24) % 24)}
              step={1}
              label="end hour"
            />
          </View>
        ) : null}
      </ScrollView>
    </BottomSheet>
  );
}

function Chip({
  label,
  onPress,
  primary = false,
  danger = false,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: primary ? theme.accent : theme.surfaceAlt }]}
      accessibilityRole="button"
    >
      <Text
        style={[styles.chipLabel, { color: primary ? theme.onAccent : danger ? theme.danger : theme.text }]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Stepper({
  value,
  format,
  onChange,
  step,
  label,
}: {
  value: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  step: number;
  label: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[styles.stepper, { backgroundColor: theme.surfaceAlt }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: format(value) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onChange(value + (event.nativeEvent.actionName === 'increment' ? step : -step))
      }
    >
      <Pressable onPress={() => onChange(value - step)} hitSlop={8} style={styles.stepperButton}>
        <Ionicons name="remove" size={18} color={theme.text} />
      </Pressable>
      <Text style={[styles.stepperValue, { color: theme.text }]} numberOfLines={1}>
        {format(value)}
      </Text>
      <Pressable onPress={() => onChange(value + step)} hitSlop={8} style={styles.stepperButton}>
        <Ionicons name="add" size={18} color={theme.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  section: {
    ...typography.caption,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: space.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
  },
  chipLabel: {
    ...typography.label,
    fontWeight: '600',
  },
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: space.xs,
  },
  stepperButton: {
    padding: space.sm,
  },
  stepperValue: {
    ...typography.label,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  windowLabel: {
    ...typography.label,
  },
});
