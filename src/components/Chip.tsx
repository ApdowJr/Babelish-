import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useThemedStyles } from '@/theme/theme';

type Props = {
  label: string;
  onPress?: () => void;
  selected?: boolean;
  icon?: ReactNode;
};

export function Chip({ label, onPress, selected = false, icon }: Props) {
  const styles = useThemedStyles(createStyles);
  const content = (
    <View style={[styles.chip, selected && styles.chipSelected]}>
      {icon}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      // The pill is ~36pt tall; grow the touch area to the 44pt guideline
      // without changing the visual rhythm.
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
    >
      {content}
    </Pressable>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.pill,
    paddingHorizontal: 15,
    paddingVertical: 9,
  },
  chipSelected: {
    backgroundColor: c.primary,
    borderColor: c.primary,
  },
  label: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  labelSelected: { color: c.onDark, fontWeight: '700' },
});
