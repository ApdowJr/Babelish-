import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Logo } from '@/components/Logo';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

type Props = {
  eyebrow: string;
  title: string;
  subtitle: string;
  perks?: string[];
};

/** Branded gradient header shared by sign-in and sign-up. */
export function AuthHero({ eyebrow, title, subtitle, perks }: Props) {
  return (
    <LinearGradient
      colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.orbA} />
      <View style={styles.orbB} />
      <Logo size={28} tone="light" />
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {perks && perks.length > 0 ? (
        <View style={styles.perks}>
          {perks.map((perk) => (
            <View key={perk} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={13} color={colors.sun} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  orbA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -90,
    right: -70,
  },
  orbB: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(242,193,78,0.12)',
    bottom: -60,
    left: -20,
  },
  eyebrow: { ...typography.micro, color: colors.sun, marginTop: spacing.xl },
  title: { ...typography.display, color: colors.onDark, marginTop: spacing.sm, lineHeight: 38 },
  subtitle: {
    ...typography.body,
    color: colors.onDarkMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
  },
  perks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  perkText: { ...typography.micro, color: colors.onDarkMuted, letterSpacing: 0.3 },
});
