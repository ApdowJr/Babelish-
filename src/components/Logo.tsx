import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing, typography } from '@/theme/tokens';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.mark, { width: size, height: size, borderRadius: size * 0.32 }]}
      >
        <Text style={[styles.markText, { fontSize: size * 0.5 }]}>N</Text>
      </LinearGradient>
      <Text style={[styles.wordmark, { fontSize: size * 0.78 }]}>
        Babelish<Text style={{ color: colors.accent }}>.</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mark: { alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.white, fontWeight: '800' },
  wordmark: { ...typography.title, color: colors.text },
});
