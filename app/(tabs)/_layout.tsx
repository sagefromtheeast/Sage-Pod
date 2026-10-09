import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getInboxCount } from '@/db/episodes';
import { useQuery } from '@/db/useQuery';
import { GlassContainer, GlassTabBar } from '@/ui/glass';
import { MiniPlayer } from '@/ui/MiniPlayer';
import { space } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Home', icon: 'home-outline', iconActive: 'home' },
  { name: 'queue', title: 'Queue', icon: 'list-outline', iconActive: 'list' },
  { name: 'inbox', title: 'Inbox', icon: 'file-tray-outline', iconActive: 'file-tray' },
  { name: 'discover', title: 'Discover', icon: 'search-outline', iconActive: 'search' },
  { name: 'library', title: 'Library', icon: 'library-outline', iconActive: 'library' },
];

function TabBarWithMiniPlayer(props: BottomTabBarProps) {
  const insets = props.insets;
  return (
    <View
      style={[
        styles.floatingContainer,
        { paddingBottom: Math.max(insets.bottom, space.xs) },
      ]}
      pointerEvents="box-none"
    >
      <GlassContainer spacing={12} style={styles.glassContainer}>
        <MiniPlayer />
        <GlassTabBar {...props} />
      </GlassContainer>
    </View>
  );
}

function SettingsButton() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={12}
      style={{ marginRight: 16 }}
      accessibilityRole="button"
      accessibilityLabel="Settings"
    >
      <Ionicons name="settings-outline" size={24} color={theme.text} />
    </Pressable>
  );
}

/** Library's header: local search (AntennaPod's Subscriptions search icon), then Settings. */
function LibraryHeaderButtons() {
  const router = useRouter();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
      <Pressable onPress={() => router.push('/search')} hitSlop={12} accessibilityRole="button" accessibilityLabel="Search">
        <Ionicons name="search" size={22} color={theme.text} />
      </Pressable>
      <SettingsButton />
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();

  const { data: inboxCount = 0 } = useQuery(
    () => getInboxCount(),
    ['episodes']
  );

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <TabBarWithMiniPlayer {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: theme.bg },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: theme.bg },
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarActiveTintColor: theme.accent,
        tabBarInactiveTintColor: theme.textFaint,
      }}
    >
      {TABS.map(({ name, title, icon, iconActive }) => {
        let badgeValue = undefined;
        if (name === 'inbox' && inboxCount > 0) {
          badgeValue = inboxCount > 99 ? '99+' : String(inboxCount);
        }

        return (
          <Tabs.Screen
            key={name}
            name={name}
            options={{
              title,
              tabBarIcon: ({ color, size, focused }) => (
                <Ionicons name={focused ? iconActive : icon} size={size} color={color} />
              ),
              tabBarBadge: badgeValue,
              tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#fff' },
              headerRight:
                name === 'library'
                  ? () => <LibraryHeaderButtons />
                  : name === 'index'
                    ? () => <SettingsButton />
                    : undefined,
            }}
          />
        );
      })}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    backgroundColor: 'transparent',
  },
  glassContainer: {
    paddingTop: space.xs,
  },
});
