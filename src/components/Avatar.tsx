import { StyleSheet, Text, View } from 'react-native';
import { avatarInitials, type AvatarColor } from '@/lib/learnerProfile';
import { radii, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

/**
 * The learner's avatar: an emoji on a tinted disc, or their initials when no
 * emoji is chosen. One component everywhere, so the profile header, the
 * editor preview and the home greeting cannot disagree.
 */

const tints = (c: Palette): Record<AvatarColor, { background: string; ink: string; ring: string }> => ({
  forest: { background: c.primaryTint, ink: c.primary, ring: c.primary },
  mint: { background: c.mintSoft, ink: c.mintInk, ring: c.mint },
  tangerine: { background: c.accentSoft, ink: c.accentInk, ring: c.accent },
  sun: { background: c.sunSoft, ink: c.sunInk, ring: c.sun },
  sky: { background: c.skySoft, ink: c.skyInk, ring: c.sky },
  lilac: { background: c.lilacSoft, ink: c.lilacInk, ring: c.lilac },
});

export function Avatar({
  name,
  emoji,
  color = 'forest',
  size = 56,
  onDark = false,
  ring = false,
}: {
  name?: string | null;
  emoji?: string;
  color?: AvatarColor;
  size?: number;
  /** Sits on the dark profile gradient — uses a translucent white disc. */
  onDark?: boolean;
  /** Adds a 2 px brand ring (used on the profile hero). */
  ring?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const allTints = tints(colors);
  const tint = allTints[color] ?? allTints.forest;
  const initials = avatarInitials(name);

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: onDark ? 'rgba(244, 248, 243, 0.16)' : tint.background,
          borderWidth: ring ? 2 : 0,
          borderColor: onDark ? 'rgba(244, 248, 243, 0.5)' : tint.ring,
        },
      ]}
      // The name is always spoken by the row/card that contains the avatar;
      // announcing it twice is noise.
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text
        style={{
          fontSize: emoji ? size * 0.48 : size * 0.36,
          color: onDark ? colors.onDark : tint.ink,
          fontWeight: '800',
          letterSpacing: emoji ? 0 : -0.5,
        }}
      >
        {emoji || initials}
      </Text>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Kept for callers that want the pill shape (chips in the editor preview).
  pill: { borderRadius: radii.pill },
});
