import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { radius } from './theme';
import { useTheme } from './useTheme';

type Props = {
  uri?: string | null;
  size: number;
  /** Corner rounding. Defaults to the medium token. */
  borderRadius?: number;
};

/**
 * Podcast artwork with a graceful empty state.
 *
 * Feeds go dark, artwork 404s, and offline listeners still need a laid-out
 * list — so a missing image renders a placeholder tile of the right size
 * rather than collapsing the row.
 */
export function Artwork({ uri, size, borderRadius = radius.md }: Props) {
  const theme = useTheme();

  if (!uri) {
    return (
      <View
        style={[
          styles.placeholder,
          { width: size, height: size, borderRadius, backgroundColor: theme.surfaceAlt },
        ]}
      >
        <Ionicons name="mic-outline" size={size * 0.4} color={theme.textFaint} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size, borderRadius, backgroundColor: theme.surfaceAlt }}
      contentFit="cover"
      transition={180}
      // Artwork is reused across every screen, so a memory-and-disk cache keeps
      // scrolling smooth and avoids refetching the same tiles.
      cachePolicy="memory-disk"
      recyclingKey={uri}
    />
  );
}

const styles = StyleSheet.create({
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
