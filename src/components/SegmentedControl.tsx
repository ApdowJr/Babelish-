import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  count?: number;
};

type Props<T extends string> = {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Scroll horizontally instead of stretching (good for many options). */
  scroll?: boolean;
};

/** iOS-style segmented switcher on a tinted track. */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  scroll = false,
}: Props<T>) {
  const content = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        onPress={() => onChange(option.value)}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        style={[styles.segment, selected && styles.segmentSelected, scroll && styles.segmentFixed]}
      >
        {option.icon ? (
          <Ionicons
            name={option.icon}
            size={14}
            color={selected ? colors.primary : colors.textMuted}
          />
        ) : null}
        <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
          {option.label}
        </Text>
        {typeof option.count === 'number' && option.count > 0 ? (
          <View style={[styles.count, selected && styles.countSelected]}>
            <Text style={[styles.countText, selected && styles.countTextSelected]}>
              {option.count}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  });

  if (scroll) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trackScroll}
      >
        {content}
      </ScrollView>
    );
  }

  return <View style={styles.track}>{content}</View>;
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    padding: 4,
    gap: 4,
  },
  trackScroll: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 38,
    borderRadius: radii.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
  },
  segmentFixed: { flex: 0, paddingHorizontal: spacing.lg },
  segmentSelected: { backgroundColor: colors.surface, ...shadows.card },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  labelSelected: { color: colors.primary, fontWeight: '800' },
  count: {
    minWidth: 18,
    paddingHorizontal: 4,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countSelected: { backgroundColor: colors.primaryTint },
  countText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  countTextSelected: { color: colors.primary },
});
