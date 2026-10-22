import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '@/components/BrandMark';
import { colors, spacing, typography } from '@/theme/tokens';

/** Mark + wordmark, the lockup used in headers and the welcome flow. */
export function Logo({ size = 28, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Babelish">
      <BrandMark size={size * 1.06} tone={tone} />
      <Text
        style={[
          styles.wordmark,
          { fontSize: size * 0.78 },
          tone === 'light' && styles.wordmarkLight,
        ]}
      >
        Babelish
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wordmark: { ...typography.title, color: colors.text, letterSpacing: -0.9 },
  wordmarkLight: { color: colors.onDark },
});
