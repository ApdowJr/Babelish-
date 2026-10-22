import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: ReactNode;
};

export function Chip({ label, onPress, selected = false, icon }: Props) {
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  labelSelected: { color: colors.onDark, fontWeight: '700' },
});
