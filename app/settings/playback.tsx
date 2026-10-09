import { useSetting } from '@/db/settings';
import { formatSmartMark } from '@/player/playedRules';
import { clampSpeed, formatSpeed, parsePresets, serializePresets } from '@/player/speed';
import { ENQUEUE_LOCATION_LABELS, SETTING_OPTIONS } from '@/settings/options';
import { SettingsScreen } from '@/ui/settings/SettingsScreen';
import { useUpdateSetting } from '@/ui/settings/useUpdateSetting';
import { SettingsChoice, SettingsOptions, SettingsSection, SettingsSwitch, SettingsTextInput } from '@/ui/SettingsRow';

/** AntennaPod's Settings › Playback: controls, speed, and what happens around the queue. */
export default function PlaybackSettings() {
  const update = useUpdateSetting();
  const skipForward = useSetting('skipForward');
  const skipBackward = useSetting('skipBackward');
  const rate = useSetting('playbackRate');
  const presetsRaw = useSetting('speedPresets');
  const rewindOnResume = useSetting('rewindOnResume');
  const enqueueLocation = useSetting('enqueueLocation');
  const continuous = useSetting('continuousPlayback');
  const removeFinished = useSetting('removeFromQueueWhenFinished');
  const smartMark = useSetting('smartMarkSeconds');
  const keepSkipped = useSetting('keepSkippedEpisodes');

  const presets = parsePresets(presetsRaw);
  // The saved speed may come from the player's slider, so offer it even when it isn't a preset.
  const speeds = [...new Set([...presets, clampSpeed(rate)])].sort((a, b) => a - b);

  return (
    <SettingsScreen>
      <SettingsSection title="Controls" />
      <SettingsOptions
        label="Skip forward"
        value={skipForward}
        options={SETTING_OPTIONS.skipForward}
        format={(seconds) => `${seconds}s`}
        onChange={(value) => void update('skipForward', value)}
      />
      <SettingsOptions
        label="Skip back"
        value={skipBackward}
        options={SETTING_OPTIONS.skipBackward}
        format={(seconds) => `${seconds}s`}
        onChange={(value) => void update('skipBackward', value)}
      />
      <SettingsSwitch
        label="Rewind on resume"
        description="Backs up a little when you press play again: under a second after a quick pause, up to 20 seconds after a day away."
        value={rewindOnResume}
        onValueChange={(value) => void update('rewindOnResume', value)}
      />

      <SettingsSection title="Speed" />
      <SettingsOptions
        label="Default speed"
        description="Applied when a new episode starts, unless its podcast has its own speed."
        value={clampSpeed(rate)}
        options={speeds}
        format={formatSpeed}
        onChange={(value) => void update('playbackRate', value)}
      />
      <SettingsTextInput
        label="Speed presets"
        description="The quick choices in the player's speed sheet, 0.5–4, separated by commas."
        value={presets.join(', ')}
        keyboardType="default"
        autoCapitalize="none"
        onSubmit={(text) => void update('speedPresets', serializePresets(parsePresets(text)))}
      />

      <SettingsSection title="Queue" />
      <SettingsOptions
        label="Enqueue location"
        description="Where Add to queue puts an episode."
        value={enqueueLocation}
        options={SETTING_OPTIONS.enqueueLocation}
        format={(location) => ENQUEUE_LOCATION_LABELS[location]}
        onChange={(value) => void update('enqueueLocation', value)}
      />
      <SettingsSwitch
        label="Play the next episode"
        description="Continue with the queue when an episode finishes."
        value={continuous}
        onValueChange={(value) => void update('continuousPlayback', value)}
      />
      <SettingsSwitch
        label="Remove finished episodes"
        description="Take an episode out of the queue once it has played."
        value={removeFinished}
        onValueChange={(value) => void update('removeFromQueueWhenFinished', value)}
      />

      <SettingsSection title="Marking as played" />
      <SettingsChoice
        label="Smart mark as played"
        description="Stopping or skipping with this little left counts as finishing the episode."
        value={smartMark}
        options={SETTING_OPTIONS.smartMarkSeconds}
        format={formatSmartMark}
        icon="checkmark-done-outline"
        onChange={(value) => void update('smartMarkSeconds', value)}
      />
      <SettingsSwitch
        label="Keep skipped episodes"
        description="A skipped episode stays unplayed and in the queue. Off marks it played and removes it."
        value={keepSkipped}
        onValueChange={(value) => void update('keepSkippedEpisodes', value)}
      />
    </SettingsScreen>
  );
}
