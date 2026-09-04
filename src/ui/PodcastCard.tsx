import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Artwork } from './Artwork';
import { space, type as typography } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  subtitle?: string | null;
  artworkUrl?: string | null;
  /** Small badge in the artwork corner — used for unplayed counts. */
  badge?: number | null;
  size: number;
  onPress: () => void;
};

/** A podcast tile for the library grid and discovery carousels. */
export function PodcastCard({ title, subtitle, artworkUrl, badge, size, onPress }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.container, { width: size, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
    >
      <View>
        <Artwork uri={artworkUrl} size={size} />
        {badge && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.onAccent }]} numberOfLines={1}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? (
        <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space.xs,
  },
  title: {
    ...typography.label,
    fontWeight: '600',
    marginTop: space.xs,
  },
  subtitle: {
    ...typography.caption,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
