import { useLocalSearchParams, Stack } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View, Text } from 'react-native';

import { getFeed, setFeedFlags } from '@/db/feeds';
import type { FeedRow } from '@/db/types';
import { useQuery } from '@/db/useQuery';
import { PLAYBACK_RATES, player } from '@/player';
import { SettingsOptions, SettingsSection, SettingsSwitch } from '@/ui/SettingsRow';
import { space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

const SKIP_INTRO_OPTIONS = [-1, 0, 10, 15, 30, 45, 60] as const;
const SPEED_OPTIONS = [-1, ...PLAYBACK_RATES] as const;

export default function FeedSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const feedId = Number(id);
  const theme = useTheme();

  const { data: feed } = useQuery<FeedRow | null>(
    () => getFeed(feedId),
    ['feeds'],
    [feedId]
  );

  const update = useCallback(
    async (
      flags: {
        autoDownload?: boolean;
        keepUpdated?: boolean;
        playbackSpeed?: number | null;
        skipIntroSeconds?: number | null;
      }
    ) => {
      await setFeedFlags(feedId, flags);
      
      // If we're updating the playback speed and this feed is currently playing, update the player
      if (flags.playbackSpeed !== undefined) {
        const current = player.getState();
        if (current.episode?.feed_id === feedId) {
          if (flags.playbackSpeed === null) {
            // Revert to global
            const { getSettings } = require('@/db/settings');
            player.setRate(getSettings().playbackRate);
          } else {
            player.setRate(flags.playbackSpeed);
          }
        }
      }
    },
    [feedId]
  );

  if (!feed) {
    return <View style={[styles.root, { backgroundColor: theme.bg }]} />;
  }

  const speedVal = feed.playback_speed === null ? -1 : feed.playback_speed;
  const skipIntroVal = feed.skip_intro_seconds === null ? -1 : feed.skip_intro_seconds;

  return (
    <ScrollView style={[styles.root, { backgroundColor: theme.bg }]}>
      <Stack.Screen options={{ title: 'Podcast Settings' }} />
      
      <SettingsSection title="Overrides" />
      <SettingsOptions
        label="Playback speed"
        description="Override the global playback speed for this podcast."
        value={speedVal}
        options={SPEED_OPTIONS}
        format={(rate) => (rate === -1 ? 'Global' : `${rate}×`)}
        onChange={(val) => void update({ playbackSpeed: val === -1 ? null : val })}
      />
      <SettingsOptions
        label="Skip intro"
        description="Automatically skip the first few seconds of every episode."
        value={skipIntroVal}
        options={SKIP_INTRO_OPTIONS}
        format={(seconds) => (seconds === -1 ? 'Global' : seconds === 0 ? 'Off' : `${seconds}s`)}
        onChange={(val) => void update({ skipIntroSeconds: val === -1 ? null : val })}
      />

      <SettingsSection title="Updates" />
      <SettingsSwitch
        label="Include in global refresh"
        description="Check for new episodes when refreshing all feeds."
        value={feed.keep_updated === 1}
        onValueChange={(val) => void update({ keepUpdated: val })}
      />
      <SettingsSwitch
        label="Auto-download"
        description="Automatically download new episodes (respects global limit)."
        value={feed.auto_download === 1}
        onValueChange={(val) => void update({ autoDownload: val })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
