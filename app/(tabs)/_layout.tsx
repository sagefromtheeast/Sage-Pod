import { Ionicons } from '@expo/vector-icons';
import { BottomTabBar, Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { View } from 'react-native';

import { MiniPlayer } from '@/ui/MiniPlayer';
import { useTheme } from '@/ui/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Queue', icon: 'list-outline', iconActive: 'list' },
  { name: 'inbox', title: 'Inbox', icon: 'file-tray-outline', iconActive: 'file-tray' },
  { name: 'discover', title: 'Discover', icon: 'search-outline', iconActive: 'search' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconActive: 'library' },
  { name: 'settings', title: 'Settings', icon: 'settings-outline', iconActive: 'settings' },
];

/**
 * Tab bar with the mini player stacked directly on top of it.
 *
 * Rendering the mini player here rather than in each screen keeps it mounted
 * across tab switches — so playback controls never flicker, and the audio never
 * hitches from a component remount.
 */
function TabBarWithMiniPlayer(props: BottomTabBarProps) {
  return (
    <View>
      <MiniPlayer />
      <BottomTabBar {...props} />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <TabBarWithMiniPlayer {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
      }}
    >
      {TABS.map(({ name, title, icon, iconActive }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
