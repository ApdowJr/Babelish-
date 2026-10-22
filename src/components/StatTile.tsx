import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  value: string | number;
  label: string;
  tint?: string;
  tintSoft?: string;
  style?: StyleProp<ViewStyle>;
};

/** Home's three-up summary tiles (streak · XP · words). */
export function StatTile({
  icon,
  value,
  label,
  tint = colors.accent,
  tintSoft = colors.accentSoft,
  style,
}: Props) {
  return (
    <View style={[styles.tile, style]}>
      <View style={[styles.icon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  value: { ...typography.title, color: colors.text, fontSize: 22 },
  label: { ...typography.micro, color: colors.textFaint, marginTop: 2, letterSpacing: 0.6 },
});
