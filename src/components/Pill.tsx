import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radii, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

export type PillTone = 'free' | 'beta' | 'new' | 'muted' | 'accent' | 'sky' | 'lilac' | 'dark';

const tones = (c: Palette): Record<PillTone, { bg: string; fg: string }> => ({
  free: { bg: c.successSoft, fg: c.success },
  beta: { bg: c.accentSoft, fg: c.accentInk },
  new: { bg: c.sunSoft, fg: c.sunInk },
  muted: { bg: c.surfaceHigh, fg: c.textMuted },
  accent: { bg: c.accentSoft, fg: c.accentInk },
  sky: { bg: c.skySoft, fg: c.skyInk },
  lilac: { bg: c.lilacSoft, fg: c.lilacInk },
  dark: { bg: 'rgba(255,255,255,0.14)', fg: c.onDark },
});

type Props = {
  label: string;
  tone?: PillTone;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
};

export function Pill({ label, tone = 'muted', icon, style }: Props) {
  const styles = useThemedStyles(createStyles);
  const palette = tones(useTheme().colors)[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      {icon ? <Ionicons name={icon} size={11} color={palette.fg} /> : null}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
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
