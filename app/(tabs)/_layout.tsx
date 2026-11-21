import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getInboxCount } from '@/db/episodes';
import { useQuery } from '@/db/useQuery';
import { usePlayerState } from '@/player';
import { GlassContainer, GlassTabBar, useGlassEffects } from '@/ui/glass';
import { MiniPlayer } from '@/ui/MiniPlayer';
import { TabBar } from '@/ui/TabBar';
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
  const theme = useTheme();
  const glass = useGlassEffects();
  const hasEpisode = usePlayerState().episode !== null;
  if (!glass) {
    // Solid and docked, AntennaPod's layout: player bar, a hairline, the tabs.
    return (
      <View
        style={[
          styles.docked,
          { backgroundColor: theme.surface, borderTopColor: theme.border, paddingBottom: insets.bottom },
        ]}
      >
        <MiniPlayer />
        {hasEpisode ? <View style={[styles.divider, { backgroundColor: theme.border }]} /> : null}
        <TabBar {...props} />
      </View>
    );
  }
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
                <Ionicons name={focused ? iconActive : icon} size={size} color={color as string} />
              ),
              tabBarBadge: badgeValue,
              tabBarBadgeStyle: { backgroundColor: theme.danger, color: '#fff' },
              headerRight:
                // Home and the Library draw their own header buttons.
                name === 'index' ? () => <SettingsButton /> : undefined,
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
  docked: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
});
