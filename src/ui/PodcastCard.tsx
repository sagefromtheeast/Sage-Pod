import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Artwork } from './Artwork';
import { radius, space, type as typography } from './theme';
import { useTheme } from './useTheme';

type Props = {
  title: string;
  subtitle?: string | null;
  artworkUrl?: string | null;
  /** Small badge in the artwork corner — used for unplayed counts. */
  badge?: number | null;
  size: number;
  onPress: () => void;
  onLongPress?: () => void;
  /** Library multi-select: shows a check circle, filled when selected. */
  selecting?: boolean;
  selected?: boolean;
  /** The last refresh failed: a warning mark on the artwork. */
  warning?: boolean;
  /** The Library can hide titles for a cover-only grid. */
  showTitle?: boolean;
};

/** A podcast tile for the library grid and discovery carousels. */
export function PodcastCard({
  title,
  subtitle,
  artworkUrl,
  badge,
  size,
  onPress,
  onLongPress,
  selecting = false,
  selected = false,
  warning = false,
  showTitle = true,
}: Props) {
  const theme = useTheme();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      style={({ pressed }) => [styles.container, { width: size, opacity: pressed ? 0.7 : 1 }]}
      accessibilityRole={selecting ? 'checkbox' : 'button'}
      accessibilityState={selecting ? { checked: selected } : undefined}
      accessibilityLabel={[title, subtitle, warning ? 'last refresh failed' : null].filter(Boolean).join(', ')}
    >
      <View>
        <Artwork uri={artworkUrl} size={size} />
        {selecting && selected ? (
          <View style={[styles.selectScrim, { width: size, height: size, backgroundColor: theme.bg }]} />
        ) : null}
        {selecting ? (
          <View style={styles.check}>
            <Ionicons
              name={selected ? 'checkmark-circle' : 'ellipse-outline'}
              size={26}
              color={selected ? theme.accent : theme.text}
            />
          </View>
        ) : null}
        {warning ? (
          <View style={[styles.warning, { backgroundColor: theme.danger }]}>
            <Ionicons name="alert" size={14} color={theme.onAccent} />
          </View>
        ) : null}
        {badge && badge > 0 ? (
          <View style={[styles.badge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.badgeText, { color: theme.onAccent }]} numberOfLines={1}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        ) : null}
      </View>

      {showTitle ? (
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {showTitle && subtitle ? (
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
  selectScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    opacity: 0.35,
    borderRadius: radius.md,
  },
  check: {
    position: 'absolute',
    top: 6,
    left: 6,
  },
  warning: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
