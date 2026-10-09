import Constants from 'expo-constants';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { SettingsNote, SettingsScreen } from '@/ui/settings/SettingsScreen';
import { SettingsSection } from '@/ui/SettingsRow';
import { space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** The libraries the app ships with; every one is MIT licensed. */
const LIBRARIES = [
  'React and React Native',
  'Expo (audio, file system, SQLite, router, and other modules)',
  'React Native Gesture Handler',
  'React Native Reanimated',
  'React Native Screens and Safe Area Context',
  'React Native SVG',
  'React Native Slider',
  'fast-xml-parser',
] as const;

/** AntennaPod's Settings › About: version, privacy and licences. */
export default function AboutSettings() {
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? 'unknown';

  return (
    <SettingsScreen>
      <View style={styles.header}>
        <Text style={[styles.name, { color: theme.text }]}>Sage Pod</Text>
        <Text style={[styles.version, { color: theme.textMuted }]}>
          Version {version} · {Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web'}
        </Text>
      </View>

      <SettingsSection title="Privacy" />
      <SettingsNote>
        Sage Pod has no account, no analytics and no ads. Your podcasts, queue, history and settings stay in a database
        on this device. The app contacts only the podcast feeds and audio you choose, and, when you use Discover, Apple
        Podcasts search and charts and fyyd’s podcast search.
      </SettingsNote>

      <SettingsSection title="Open-source licences" />
      <SettingsNote>
        Sage Pod is built with open-source software, all under the MIT licence:{'\n'}
        {LIBRARIES.map((library) => `• ${library}`).join('\n')}
      </SettingsNote>
      <SettingsNote>
        Feature design follows AntennaPod, the open-source podcast app. No AntennaPod code is used.
      </SettingsNote>
    </SettingsScreen>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: 'center', paddingTop: space.xl, paddingBottom: space.md, gap: space.xs },
  name: { ...typography.title },
  version: { ...typography.caption },
});
