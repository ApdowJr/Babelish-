import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme/tokens';

export function Logo({ size = 28, tone = 'dark' }: { size?: number; tone?: 'dark' | 'light' }) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="Babelish">
      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mark, { width: size, height: size, borderRadius: size * 0.3 }]}
      >
        <View style={[styles.markBubble, { width: size * 0.58, height: size * 0.42, borderRadius: size * 0.2 }]} />
        <View style={[styles.markTail, { borderTopWidth: size * 0.16, borderRightWidth: size * 0.14 }]} />
      </LinearGradient>
      <Text style={[styles.wordmark, { fontSize: size * 0.78 }, tone === 'light' && styles.wordmarkLight]}>Babelish</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { alignItems: 'center', justifyContent: 'center' },
  markBubble: { backgroundColor: colors.white, position: 'absolute', top: '24%' },
  markTail: { position: 'absolute', bottom: '20%', right: '22%', borderTopColor: colors.white, borderRightColor: 'transparent' },
  wordmark: { ...typography.title, color: colors.text, letterSpacing: -0.9 },
  wordmarkLight: { color: colors.onDark },
});
