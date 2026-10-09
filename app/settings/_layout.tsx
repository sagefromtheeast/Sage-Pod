import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Settings opens as one modal with its own stack of pages (AntennaPod's sub-screens). */
export default function SettingsLayout() {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerTitleStyle: { color: theme.text },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Settings',
          // The first page is the root of this stack, so it has no back button
          // of its own: this closes the Settings modal.
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close settings"
              style={{ marginRight: space.md }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="interface" options={{ title: 'User interface' }} />
      <Stack.Screen name="swipes" options={{ title: 'Swipe actions' }} />
      <Stack.Screen name="playback" options={{ title: 'Playback' }} />
      <Stack.Screen name="downloads" options={{ title: 'Downloads' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="import-export" options={{ title: 'Import and export' }} />
      <Stack.Screen name="about" options={{ title: 'About' }} />
    </Stack>
  );
}
