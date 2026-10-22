import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, radii, spacing, typography } from '@/theme/tokens';

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
  color = colors.primary,
  trackColor = colors.surfaceHigh,
  label,
  showPct = false,
  onDark = false,
  style,
}: Props) {
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
        style={[styles.track, { height, borderRadius: height / 2, backgroundColor: trackColor }]}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}
      >
        <View
          style={[
            styles.fill,
            { width: `${pct * 100}%`, backgroundColor: color, borderRadius: height / 2 },
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
  color = colors.primary,
  size = 6,
  style,
}: DotsProps) {
  return (
    <View style={[styles.dots, style]} accessibilityElementsHidden>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: index < filled ? color : colors.border,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: { ...typography.caption, color: colors.textMuted },
  labelOnDark: { color: colors.onDarkMuted },
  pct: { ...typography.caption, color: colors.text, fontWeight: '700' },
  pctOnDark: { color: colors.onDark },
  track: { overflow: 'hidden', width: '100%' },
  fill: { height: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: radii.xs / 2 },
});
