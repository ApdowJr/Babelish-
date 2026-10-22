import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

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
  tint,
  tintSoft,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  // Callers usually pass a tint pair; when they only pass `tint`, the soft disc
  // still needs a colour or the icon floats on nothing.
  const ink = tint ?? colors.accentInk;
  const soft = tintSoft ?? colors.accentSoft;
  return (
    <View style={[styles.tile, style]}>
      <View style={[styles.icon, { backgroundColor: soft }]}>
        <Ionicons name={icon} size={16} color={ink} />
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

const createStyles = (c: Palette) => StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
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
  value: { ...typography.title, color: c.text, fontSize: 22 },
  label: { ...typography.micro, color: c.textFaint, marginTop: 2, letterSpacing: 0.6 },
});
