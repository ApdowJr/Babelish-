import { StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '@/components/BrandMark';
import { spacing, typography, type Palette } from '@/theme/tokens';
import { useThemedStyles } from '@/theme/theme';

/** Mark + wordmark, the lockup used in headers and the welcome flow. */
export function Logo({ size = 28, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  const styles = useThemedStyles(createStyles);
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

const createStyles = (c: Palette) => StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wordmark: { ...typography.title, color: c.text, letterSpacing: -0.9 },
  wordmarkLight: { color: c.onDark },
});
