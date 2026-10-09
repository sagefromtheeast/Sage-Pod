import { Stack } from 'expo-router';

import { useTheme } from '@/ui/useTheme';

/** Settings opens as one modal with its own stack of pages (AntennaPod's sub-screens). */
export default function SettingsLayout() {
  const theme = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Settings' }} />
      <Stack.Screen name="interface" options={{ title: 'User interface' }} />
      <Stack.Screen name="swipes" options={{ title: 'Swipe actions' }} />
      <Stack.Screen name="playback" options={{ title: 'Playback' }} />
      <Stack.Screen name="downloads" options={{ title: 'Downloads' }} />
      <Stack.Screen name="import-export" options={{ title: 'Import and export' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
