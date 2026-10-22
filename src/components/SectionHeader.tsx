import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

type SectionHeaderProps = {
  title: string;
  action?: string;
  onAction?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

/** Small caps label + optional "See all" action. Consistent on every screen. */
export function SectionHeader({ title, action, onAction, icon, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.titleRow}>
        {icon ? <Ionicons name={icon} size={14} color={colors.textFaint} /> : null}
        <Text style={styles.title}>{title.toUpperCase()}</Text>
      </View>
      {action && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={10}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Text style={styles.actionText}>{action}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  padded?: boolean;
  tone?: 'surface' | 'tint' | 'primary' | 'accent';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** The app's one surface. Hairline border, soft lift, generous radius. */
export function Card({
  children,
  onPress,
  padded = true,
  tone = 'surface',
  style,
  accessibilityLabel,
}: CardProps) {
  const toneStyle =
    tone === 'primary'
      ? styles.primary
      : tone === 'tint'
        ? styles.tint
        : tone === 'accent'
          ? styles.accent
          : styles.surface;
  const base = [styles.card, toneStyle, padded && styles.padded, style];

  if (!onPress) return <View style={base}>{children}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [base, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { ...typography.micro, color: colors.textFaint },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { ...typography.caption, color: colors.primary, fontWeight: '700' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.994 }] },
  card: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  surface: { backgroundColor: colors.surface, ...shadows.card },
  tint: { backgroundColor: colors.surfaceTint, borderColor: colors.border },
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  accent: { backgroundColor: colors.accentSoft, borderColor: 'rgba(233, 118, 79, 0.22)' },
  padded: { padding: spacing.lg },
});
