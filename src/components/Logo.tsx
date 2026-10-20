import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@/theme/tokens';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Babelish">
      <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
        <View style={[styles.markBubble, { width: size * 0.58, height: size * 0.42, borderRadius: size * 0.2 }]} />
        <View style={[styles.markTail, { borderTopWidth: size * 0.16, borderRightWidth: size * 0.14 }]} />
      </View>
      <Text style={[styles.wordmark, { fontSize: size * 0.78 }]}>Babelish</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  markBubble: { backgroundColor: colors.white, position: 'absolute', top: '24%' },
  markTail: { position: 'absolute', bottom: '20%', right: '22%', borderTopColor: colors.white, borderRightColor: 'transparent' },
  wordmark: { ...typography.title, color: colors.primary, letterSpacing: -0.6 },
});
