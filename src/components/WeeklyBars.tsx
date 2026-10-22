import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, typography } from '@/theme/tokens';

type Props = {
  /** Activity counts, oldest → newest (length 7). */
  values: number[];
  labels: string[];
  /** Index drawn as "today" (defaults to the last bar). */
  highlightIndex?: number;
  color?: string;
  height?: number;
};

/** Tiny, honest activity chart — one bar per day, no fake history. */
export function WeeklyBars({
  values,
  labels,
  highlightIndex,
  color = colors.primary,
  height = 56,
}: Props) {
  const max = Math.max(1, ...values);
  const active = highlightIndex ?? values.length - 1;

  return (
    <View style={styles.row}>
      {values.map((value, index) => {
        const isToday = index === active;
        const ratio = Math.max(value > 0 ? 0.18 : 0.06, value / max);
        return (
          <View key={`${labels[index]}-${index}`} style={styles.col}>
            <View style={[styles.track, { height }]}>
              <View
                style={[
                  styles.bar,
                  {
                    height: Math.max(4, Math.round(ratio * height)),
                    backgroundColor: value > 0 ? color : colors.border,
                    opacity: isToday ? 1 : value > 0 ? 0.42 : 0.6,
                  },
                ]}
              />
            </View>
            <Text style={[styles.label, isToday && styles.labelToday]}>{labels[index]}</Text>
            <View style={[styles.dot, isToday && { backgroundColor: color }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center' },
  track: { width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '68%', borderRadius: radii.pill },
  label: { ...typography.micro, color: colors.textFaint, marginTop: 6, letterSpacing: 0.4 },
  labelToday: { color: colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'transparent' },
});
