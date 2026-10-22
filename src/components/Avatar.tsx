import { StyleSheet, Text, View } from 'react-native';
import { avatarInitials, type AvatarColor } from '@/lib/learnerProfile';
import { colors, radii } from '@/theme/tokens';

/**
 * The learner's avatar: an emoji on a tinted disc, or their initials when no
 * emoji is chosen. One component everywhere, so the profile header, the
 * editor preview and the home greeting cannot disagree.
 */

const TINTS: Record<AvatarColor, { background: string; ink: string; ring: string }> = {
  forest: { background: colors.primaryTint, ink: colors.primary, ring: colors.primary },
  mint: { background: colors.mintSoft, ink: colors.success, ring: colors.mint },
  tangerine: { background: colors.accentSoft, ink: colors.accentPressed, ring: colors.accent },
  sun: { background: colors.sunSoft, ink: '#8A6412', ring: colors.sun },
  sky: { background: colors.skySoft, ink: '#2C6C8B', ring: colors.sky },
  lilac: { background: colors.lilacSoft, ink: '#5F4E96', ring: colors.lilac },
};

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
  const tint = TINTS[color] ?? TINTS.forest;
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

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  // Kept for callers that want the pill shape (chips in the editor preview).
  pill: { borderRadius: radii.pill },
});
