import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
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

import { previewFeed } from '@/feed/sync';
import { radius, space, type as typography } from '@/ui/theme';
import { useTheme } from '@/ui/useTheme';

/**
 * Subscribe by pasting a feed URL.
 *
 * A dedicated screen rather than `Alert.prompt`, which exists only on iOS —
 * on Android that call is a silent no-op, which would make the entire
 * "add by URL" path dead on half the platforms this app targets.
 */
export default function AddFeedScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const value = url.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      // A preview, like a Discover result: Subscribe is on the podcast page.
      const { feedId } = await previewFeed(value);
      // Replace, so backing out of the podcast lands on Discover rather than
      // this form.
      router.replace(`/feed/${feedId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That feed could not be loaded.');
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
            onPress={() => router.back()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={26} color={theme.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.help, { color: theme.textMuted }]}>
          Paste the feed address of any podcast. Most shows link theirs from their website.
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
