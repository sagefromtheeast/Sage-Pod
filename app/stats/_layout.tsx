import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Pressable } from 'react-native';

import { space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/** Statistics opens as one modal with its own stack: the tabs, then a podcast's numbers. */
export default function StatisticsLayout() {
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
          title: 'Statistics',
          // The root of this stack has no back button of its own: this closes the modal.
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Close statistics"
              style={{ marginRight: space.md }}
            >
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen name="feed/[id]" options={{ title: 'Podcast statistics' }} />
    </Stack>
  );
}
