import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hostOf } from '@/feed/auth';
import type { FeedLink } from '@/feed/autodiscovery';
import { FeedError, normalizeFeedUrl } from '@/feed/fetch';
import { previewFeed } from '@/feed/sync';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/**
 * Subscribe by pasting a feed URL.
 *
 * A dedicated screen rather than `Alert.prompt`, which exists only on iOS —
 * on Android that call is a silent no-op, which would make the entire
 * "add by URL" path dead on half the platforms this app targets.
 *
 * As in AntennaPod, a web address copied to the clipboard is filled in, and a
 * website's address works too: its page is searched for feed links.
 */
/** The host a typed address will be fetched from ("example.com/feed" included). */
function hostFor(address: string): string | null {
  try {
    return hostOf(normalizeFeedUrl(address));
  } catch {
    return null;
  }
}

export default function AddFeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // A podcast link from another app (itpc://, feed://…) arrives as ?url=.
  const { url: linked } = useLocalSearchParams<{ url?: string }>();

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedLinks, setFeedLinks] = useState<FeedLink[]>([]);
  // The host that asked for a login: what's typed is sent only there.
  const [loginHost, setLoginHost] = useState<string | null>(null);
  const needsLogin = loginHost !== null;
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // A linked feed opens straight away, as a tap on Subscribe would.
  useEffect(() => {
    if (!linked) return;
    setUrl(linked);
    void submit(linked);
    // Only when a link arrives, not as the form changes.
  }, [linked]);

  // Prefill from the clipboard when it holds a web address.
  useEffect(() => {
    if (linked) return;
    let current = true;
    Clipboard.getStringAsync()
      .then((text) => {
        const candidate = text.trim();
        if (current && /^(?:https?|feed|itpc|pcast|podcast):\/\/\S+$/i.test(candidate)) {
          setUrl((value) => value || candidate);
        }
      })
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [linked]);

  async function submit(address = url) {
    let value = address.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    setFeedLinks([]);
    // Sent only to the host that asked for it, never to a feed a page links
    // to on another server.
    const loginFor = (address: string) =>
      loginHost !== null && hostFor(address) === loginHost && (username || password) ? { username, password } : null;
    try {
      // A preview, like a Discover result: Subscribe is on the podcast page.
      let opened: { feedId: number } | null = null;
      // At most two hops, so pages linking to each other can't loop.
      for (let hop = 0; !opened; hop++) {
        try {
          opened = await previewFeed(value, loginFor(value));
        } catch (err) {
          // A web page with exactly one feed: open that feed, as if it had
          // been pasted. Several feeds are offered as choices below.
          if (err instanceof FeedError && err.feedLinks.length === 1 && hop < 2) {
            value = err.feedLinks[0].url;
            setUrl(value);
            continue;
          }
          throw err;
        }
      }
      // Replace, so backing out of the podcast lands on Discover rather than
      // this form.
      router.replace(`/feed/${opened.feedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That feed could not be loaded.');
      if (err instanceof FeedError) {
        setFeedLinks(err.feedLinks);
        if (err.status === 401 || err.status === 403) setLoginHost(hostFor(value) ?? '');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>Add by RSS URL</Text>
          <Pressable
            // Opened from a link, there may be nothing behind it to go back to.
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={theme.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.help, { color: theme.textMuted }]}>
          Paste a podcast's feed address, or the address of its website and Sage Pod will look for the feed.
        </Text>

        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/feed.xml"
          placeholderTextColor={theme.textFaint}
          style={[
            styles.input,
            { color: theme.text, backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border },
          ]}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          keyboardType="url"
          returnKeyType="go"
          onSubmitEditing={() => void submit()}
          editable={!busy}
          accessibilityLabel="Feed URL"
        />

        {error ? <Text style={[styles.error, { color: theme.danger }]}>{error}</Text> : null}
        {needsLogin ? (
          <>
            <Text style={[styles.help, { color: theme.textMuted }]}>
              Enter the username and password the podcast gave you. They’re kept in the phone’s secure storage.
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="Username"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              editable={!busy}
              accessibilityLabel="Username"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.textFaint}
              style={[styles.input, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={() => void submit()}
              editable={!busy}
              accessibilityLabel="Password"
            />
          </>
        ) : null}
        {feedLinks.map((link) => (
          <Pressable
            key={link.url}
            onPress={() => {
              setUrl(link.url);
              void submit(link.url);
            }}
            style={({ pressed }) => [
              styles.feedLink,
              { borderColor: theme.border, backgroundColor: pressed ? theme.surfaceAlt : theme.surface },
            ]}
            accessibilityRole="button"
          >
            <Ionicons name="radio-outline" size={20} color={theme.accent} />
            <View style={styles.feedLinkText}>
              <Text style={[styles.feedLinkTitle, { color: theme.text }]} numberOfLines={1}>
                {link.title ?? 'Podcast feed'}
              </Text>
              <Text style={[styles.error, { color: theme.textMuted }]} numberOfLines={1}>
                {link.url}
              </Text>
            </View>
          </Pressable>
        ))}

        <Pressable
          onPress={() => void submit()}
          disabled={busy || url.trim().length === 0}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: theme.accent,
              opacity: busy || url.trim().length === 0 ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          {busy ? (
            <ActivityIndicator size="small" color={theme.onAccent} />
          ) : (
            <Text style={[styles.submitLabel, { color: theme.onAccent }]}>Subscribe</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    padding: space.lg,
    gap: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.heading,
  },
  help: {
    ...typography.body,
    lineHeight: 21,
  },
  input: {
    ...typography.body,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  error: {
    ...typography.caption,
  },
  feedLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedLinkText: {
    flex: 1,
    gap: 2,
  },
  feedLinkTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.md,
    borderRadius: radius.pill,
    marginTop: space.sm,
    minHeight: 48,
  },
  submitLabel: {
    ...typography.subheading,
  },
});
