import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

type Props = {
  /** 0–1 (clamped). */
  value: number;
  height?: number;
  color?: string;
  trackColor?: string;
  label?: string;
  /** Show the rounded percentage on the right. */
  showPct?: boolean;
  /** Light text for use on the dark hero gradients. */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function ProgressBar({
  value,
  height = 8,
  color,
  trackColor,
  label,
  showPct = false,
  onDark = false,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const fill = color ?? colors.primary;
  const track = trackColor ?? colors.surfaceHigh;
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View style={style}>
      {label || showPct ? (
        <View style={styles.row}>
          <Text style={[styles.label, onDark && styles.labelOnDark]}>{label ?? ''}</Text>
          {showPct ? (
            <Text style={[styles.pct, onDark && styles.pctOnDark]}>{Math.round(pct * 100)}%</Text>
          ) : null}
        </View>
      ) : null}
      <View
        style={[styles.track, { height, borderRadius: height / 2, backgroundColor: track }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: fill, borderRadius: height / 2 },
          ]}
        />
      </View>
    </View>
  );
}

type DotsProps = {
  total: number;
  filled: number;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** Compact segmented progress (Leitner boxes, difficulty, lesson steps). */
export function ProgressDots({
  total,
  filled,
  color,
  size = 6,
  style,
}: DotsProps) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={[styles.dots, style]} accessibilityElementsHidden>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: index < filled ? (color ?? colors.primary) : colors.border,
          }}
        />
      ))}
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: { ...typography.caption, color: c.textMuted },
  labelOnDark: { color: c.onDarkMuted },
  pct: { ...typography.caption, color: c.text, fontWeight: '700' },
  pctOnDark: { color: c.onDark },
  track: { overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: radii.xs / 2 },
});
