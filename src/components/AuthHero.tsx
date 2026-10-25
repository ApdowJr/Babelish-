import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  perks?: string[];
};

/**
 * Quiet, high-contrast auth header: forest green on a simple surface,
 * without decorative gradients or floating orbs competing with the form.
 */
export function AuthHero({ eyebrow, title, subtitle, perks }: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();

  return (
    <View style={styles.hero}>
      <Logo size={28} tone="light" />
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title} accessibilityRole="header">{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {perks && perks.length > 0 ? (
        <View style={styles.perks}>
          {perks.map((perk) => (
            <View key={perk} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={14} color={colors.onDark} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  hero: {
    backgroundColor: c.primary,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  eyebrow: {
    ...typography.micro,
    color: c.mint,
    marginTop: spacing.xl,
  },
  title: {
    ...typography.display,
    color: c.onDark,
    marginTop: spacing.sm,
    lineHeight: 38,
  },
  subtitle: {
    ...typography.body,
    color: c.onDarkMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  perks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkText: { ...typography.micro, color: c.onDarkMuted, letterSpacing: 0.2 },
});
