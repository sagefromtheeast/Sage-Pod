import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { initDb } from '@/db';
import { removeStalePreviews } from '@/db/feeds';
import { getMeta, getSettings, loadSettings } from '@/db/settings';
import { refreshAllFeeds } from '@/feed/sync';
import { player } from '@/player';
import { manageAutoDownloads } from '@/player/downloads';
import { EpisodeActionsHost } from '@/ui/EpisodeActionsHost';
import { palettes, space, type as typography } from '@/ui/theme';
import type { ThemePreference } from '@/ui/theme';
import { UndoToastHost } from '@/ui/UndoToast';
import { ThemeProvider, useTheme } from '@/ui/useTheme';

// Hold the native splash until migrations have run and the player has restored
// its last episode, so the first frame is the real UI rather than an empty list.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  const [startupError, setStartupError] = useState<string | null>(null);
  const [initialPref, setInitialPref] = useState<ThemePreference>('system');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await initDb();
        await loadSettings();
        if (!cancelled) setInitialPref(getSettings().themePreference);
        // Previews looked at but not subscribed to go now, before the player
        // restores its episode (which keeps that one's podcast).
        const restoring = await getMeta('lastEpisodeId');
        await removeStalePreviews(restoring ? Number(restoring) : null).catch(() => 0);
        await player.init();

        // Check for new episodes in the background. Not awaited: the UI should
        // appear immediately, and `refreshAllFeeds` skips any feed refreshed
        // more recently than the user's interval, so opening the app
        // repeatedly costs nothing.
        void refreshAllFeeds().catch(() => {
          // A failed background refresh is not worth interrupting startup for;
          // per-feed failures surface on the feed's own screen.
        });
        
        // Also manage auto downloads and cleanup
        void manageAutoDownloads().catch(() => {});
      } catch (error) {
        if (!cancelled) {
          setStartupError(error instanceof Error ? error.message : String(error));
        }
      } finally {
        if (!cancelled) {
          setReady(true);
          await SplashScreen.hideAsync();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <View style={[styles.centered, { backgroundColor: palettes.dark.bg }]}>
        <ActivityIndicator color={palettes.dark.accent} />
      </View>
    );
  }

  if (startupError) {
    return (
      <View style={[styles.centered, { backgroundColor: palettes.dark.bg }]}>
        <Text style={[styles.errorTitle, { color: palettes.dark.text }]}>Sage Pod could not start</Text>
        <Text style={[styles.errorBody, { color: palettes.dark.textMuted }]}>{startupError}</Text>
      </View>
    );
  }

  return (
    <ThemeProvider initialPreference={initialPref}>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const theme = useTheme();

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar style={theme.scheme === 'dark' || theme.scheme === 'oled' ? 'light' : 'dark'} />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: theme.bg },
            headerTintColor: theme.text,
            headerTitleStyle: { color: theme.text },
            contentStyle: { backgroundColor: theme.bg },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="player"
            options={{
              presentation: 'modal',
              headerShown: false,
              // A modal that slides from the bottom reads as "now playing",
              // matching what listeners expect from every other podcast app.
              animation: 'slide_from_bottom',
            }}
          />
          <Stack.Screen name="feed/[id]" options={{ title: '' }} />
          <Stack.Screen name="feed/settings/[id]" options={{ title: 'Podcast Settings', presentation: 'modal' }} />
          <Stack.Screen name="feed/info/[id]" options={{ title: 'Podcast info' }} />
          <Stack.Screen name="episode/[id]" options={{ title: '' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen name="opml-import" options={{ title: 'Import podcasts' }} />
          <Stack.Screen name="archive" options={{ title: 'Archived podcasts' }} />
          <Stack.Screen name="episodes" options={{ title: 'Episodes' }} />
          {/* Has its own title and close button. */}
          <Stack.Screen name="add-feed" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
          <Stack.Screen name="stats" options={{ title: 'Statistics', presentation: 'modal' }} />
        </Stack>
        {/* App-wide overlays: the episode long-press menu and the undo toast. */}
        <EpisodeActionsHost />
        <UndoToastHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  errorTitle: {
    ...typography.heading,
    textAlign: 'center',
  },
  errorBody: {
    ...typography.body,
    textAlign: 'center',
  },
});
