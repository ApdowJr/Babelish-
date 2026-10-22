import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'light';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const isBlocked = disabled || loading;

  if (variant === 'primary') {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isBlocked, busy: loading }}
        onPress={onPress}
        disabled={isBlocked}
        style={({ pressed }) => [
          styles.base,
          styles.primaryShadow,
          { opacity: isBlocked ? 0.55 : pressed ? 0.9 : 1 },
          style,
        ]}
      >
        <LinearGradient
          colors={[colors.gradientFrom, colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={[styles.label, styles.primaryLabel]}>{label}</Text>
          )}
        </LinearGradient>
      </Pressable>
    );
  }

  const tone =
    variant === 'secondary'
      ? { bg: colors.surfaceHigh, border: colors.border, text: colors.primary }
      : variant === 'danger'
        ? { bg: colors.dangerSoft, border: 'transparent', text: colors.danger }
        : variant === 'light'
          ? { bg: colors.onDark, border: 'transparent', text: colors.primary }
          : { bg: 'transparent', border: 'transparent', text: colors.primary };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isBlocked, busy: loading }}
      onPress={onPress}
      disabled={isBlocked}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: tone.bg,
          borderColor: tone.border,
          opacity: isBlocked ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tone.text} />
      ) : (
        <Text style={[styles.label, { color: variant === 'ghost' ? colors.primary : tone.text }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  primaryShadow: {
    shadowColor: colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  label: { ...typography.bodyStrong, fontSize: 15.5, textAlign: 'center', letterSpacing: 0.1 },
  primaryLabel: { color: colors.white },
});
