import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, typography } from '@/theme/tokens';

export type PillTone = 'free' | 'beta' | 'new' | 'muted' | 'accent' | 'sky' | 'lilac' | 'dark';

const TONES: Record<PillTone, { bg: string; fg: string }> = {
  free: { bg: colors.successSoft, fg: colors.success },
  beta: { bg: colors.accentSoft, fg: colors.accent },
  new: { bg: colors.sunSoft, fg: colors.warning },
  muted: { bg: colors.surfaceHigh, fg: colors.textMuted },
  accent: { bg: colors.accentSoft, fg: colors.accent },
  sky: { bg: colors.skySoft, fg: colors.sky },
  lilac: { bg: colors.lilacSoft, fg: colors.lilac },
  dark: { bg: 'rgba(255,255,255,0.14)', fg: colors.onDark },
};

type Props = {
  label: string;
  tone?: PillTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, tone = 'muted', icon, style }: Props) {
  const palette = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      {icon ? <Ionicons name={icon} size={11} color={palette.fg} /> : null}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  label: { ...typography.micro, fontSize: 10, letterSpacing: 0.7 },
});
