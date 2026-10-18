import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/state/preferences';
import { getLanguage } from '@/data/languages';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { user, isDemo } = useAuth();
  const { targetLanguageId } = usePreferences();
  const language = getLanguage(targetLanguageId);

  const hour = new Date().getHours();
  const greeting =
    hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen scroll>
      <View style={styles.topRow}>
        <View>
          <Text style={styles.greeting}>{greeting},</Text>
          <Text style={styles.name}>{user?.displayName ?? 'friend'} 👋</Text>
        </View>
        <View style={styles.streakChip}>
          <Text style={styles.streakEmoji}>🔥</Text>
          <Text style={styles.streakText}>Day 1</Text>
        </View>
      </View>

      {isDemo ? (
        <View style={styles.demoBanner}>
          <Ionicons name="flask-outline" size={15} color={colors.warning} />
          <Text style={styles.demoBannerText}>
            Demo mode — add Supabase & AI keys to .env for real accounts and a live tutor
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>CONTINUE LEARNING</Text>
      <Pressable onPress={() => router.push(`/language/${language.id}`)} accessibilityRole="button">
        {({ pressed }) => (
          <LinearGradient
            colors={[colors.gradientFrom, colors.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.heroCard, pressed && styles.pressed]}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroFlag}>{language.flag}</Text>
              <View style={styles.flex}>
                <Text style={styles.heroTitle}>{language.name}</Text>
                <Text style={styles.heroSubtitle}>
                  {language.nativeName} · {language.nativeSpeakers}
                </Text>
              </View>
              <Ionicons name="arrow-forward-circle" size={28} color={colors.white} />
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroBottom}>
              <Text style={styles.heroChapter}>Chapter 1 · First words</Text>
              <Text style={styles.heroProgress}>Not started</Text>
            </View>
          </LinearGradient>
        )}
      </Pressable>

      <Text style={styles.sectionLabel}>PRACTICE</Text>
      <View style={styles.actionsRow}>
        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
          onPress={() => router.push('/speak')}
          accessibilityRole="button"
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name="mic" size={22} color={colors.accent} />
          </View>
          <Text style={styles.actionTitle}>Talk to your tutor</Text>
          <Text style={styles.actionSubtitle}>AI conversation in your language</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.actionCard, pressed && styles.pressed]}
          onPress={() => router.push('/learn')}
          accessibilityRole="button"
        >
          <View style={[styles.actionIcon, { backgroundColor: colors.primarySoft }]}>
            <Ionicons name="globe" size={22} color={colors.primarySoft} />
          </View>
          <Text style={styles.actionTitle}>Browse languages</Text>
          <Text style={styles.actionSubtitle}>10 languages live today</Text>
        </Pressable>
      </View>

      <View style={styles.tipCard}>
        <Text style={styles.tipEmoji}>💡</Text>
        <View style={styles.flex}>
          <Text style={styles.tipTitle}>10 minutes a day beats 2 hours on Sunday</Text>
          <Text style={styles.tipBody}>
            Your tutor keeps every session short, spoken, and personal. Consistency is the whole trick.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  greeting: { ...typography.caption, color: colors.textMuted },
  name: { ...typography.title, color: colors.text, marginTop: 2 },
  streakChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakEmoji: { fontSize: 14 },
  streakText: { ...typography.caption, color: colors.text, fontWeight: '600' },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 197, 66, 0.10)',
    borderColor: 'rgba(255, 197, 66, 0.35)',
    borderWidth: 1,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  demoBannerText: { ...typography.caption, color: colors.warning, flex: 1, lineHeight: 18 },
  sectionLabel: {
    ...typography.micro,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  heroCard: { borderRadius: radii.lg, padding: spacing.xl },
  pressed: { opacity: 0.85 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroFlag: { fontSize: 40 },
  heroTitle: { ...typography.heading, color: colors.white, fontSize: 22 },
  heroSubtitle: { ...typography.caption, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  heroDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginVertical: spacing.lg,
  },
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroChapter: { ...typography.bodyStrong, color: colors.white },
  heroProgress: { ...typography.caption, color: 'rgba(255,255,255,0.8)' },
  actionsRow: { flexDirection: 'row', gap: spacing.md },
  actionCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  actionTitle: { ...typography.bodyStrong, color: colors.text },
  actionSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  tipCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  tipEmoji: { fontSize: 22 },
  tipTitle: { ...typography.bodyStrong, color: colors.text },
  tipBody: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 18 },
});
