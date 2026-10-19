import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { getLanguage } from '@/data/languages';
import { findContinueLesson } from '@/lib/curriculum/store';
import { activeToday, computeStreak, weakestSkill } from '@/lib/analytics';
import { buildDailyPlan, planTotalMinutes } from '@/lib/dailyPlan';
import { levelForXp, weekKey, weeklyXp } from '@/lib/xp';
import { rankLabel, tierForXp, weeklyProgress } from '@/lib/league';
import { fetchLeague, postWeeklyXp } from '@/lib/neonApi';
import { isNeonConfigured } from '@/lib/neon';
import type { Lesson } from '@/lib/curriculum/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { user, isDemo, getAccessToken } = useAuth();
  const { targetLanguageId } = usePreferences();
  const language = getLanguage(targetLanguageId);
  const { progress, dueCount } = useLearning();
  const { profile } = useProfile();
  const { state: analytics } = useAnalytics();

  const [next, setNext] = useState<{ lesson: Lesson; chapterTitle: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    findContinueLesson(targetLanguageId, progress)
      .then((entry) => !cancelled && setNext(entry))
      .catch(() => !cancelled && setNext(null));
    return () => {
      cancelled = true;
    };
  }, [targetLanguageId, progress]);

  const nextScore = next ? progress[next.lesson.id]?.score : undefined;

  // Real streak + adaptive daily plan, derived from on-device activity.
  const streak = computeStreak(analytics.events);
  const streakAtRisk = streak > 0 && !activeToday(analytics.events);
  const speakAverage =
    analytics.speak.count > 0 ? analytics.speak.scoreSum / analytics.speak.count : null;

  // Gamification from the published rules (never manipulative): lifetime
  // level + tier, and this week's XP toward the tier's gentle target.
  const now = new Date();
  const weeklyNow = weeklyXp(analytics.xp, now);
  const level = levelForXp(analytics.xp.lifetime);
  const tier = tierForXp(analytics.xp.lifetime);
  const weekProgress = weeklyProgress(weeklyNow, tier);

  // Best-effort league rank: the leaderboard routes ship with the api
  // Function; until then (or while offline) the tier UI stands alone.
  const week = weekKey(now);
  const [rankText, setRankText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (isDemo || !isNeonConfigured) return;
    void (async () => {
      try {
        const jwt = await getAccessToken();
        if (!jwt || cancelled) return;
        await postWeeklyXp(jwt, week, weeklyNow);
        const board = await fetchLeague(jwt, week);
        if (!cancelled) setRankText(rankLabel(board.rank, board.total));
      } catch {
        // offline or leaderboard not deployed yet — silent, tier UI still works
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken, isDemo, week, weeklyNow]);

  const plan = buildDailyPlan({
    dueCount,
    weakSkill: weakestSkill(analytics),
    speakAverage,
    retakeLesson: next
      ? { id: next.lesson.id, title: next.lesson.title, languageId: targetLanguageId }
      : null,
    streakAtRisk,
    streak,
    goal: profile.goals[0],
  });

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
        <View style={styles.chipsRow}>
          <View style={styles.xpChip}>
            <Text style={styles.xpChipText}>✨ {analytics.xp.lifetime} XP</Text>
          </View>
          <View style={styles.streakChip}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakText}>{streak > 0 ? `Day ${streak}` : 'Start today'}</Text>
          </View>
        </View>
      </View>

      {isDemo ? (
        <View style={styles.demoBanner}>
          <Ionicons name="flask-outline" size={15} color={colors.warning} />
          <Text style={styles.demoBannerText}>
            Demo mode — on-device only (EXPO_PUBLIC_NEON_DISABLED=1). Remove it to reconnect the
            live backend, and add EXPO_PUBLIC_AI_* for a live tutor.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionLabel}>CONTINUE LEARNING</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (next) {
            router.push({
              pathname: '/lesson/[id]',
              params: { id: next.lesson.id, lang: language.id },
            });
          } else {
            router.push(`/language/${language.id}`);
          }
        }}
      >
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
              <View style={styles.flex}>
                <Text style={styles.heroChapter} numberOfLines={1}>
                  {next ? next.chapterTitle : `${language.name} · CEFR A1`}
                </Text>
                <Text style={styles.heroLesson} numberOfLines={1}>
                  {next ? next.lesson.title : 'Loading your next lesson…'}
                </Text>
              </View>
              <Text style={styles.heroProgress}>
                {next ? (nextScore !== undefined ? `Best ${nextScore}%` : 'Not started') : ''}
              </Text>
            </View>
          </LinearGradient>
        )}
      </Pressable>

      <Pressable
        style={({ pressed }) => [styles.reviewCard, pressed && styles.pressed]}
        onPress={() => router.push('/review')}
        accessibilityRole="button"
      >
        <View style={styles.reviewIcon}>
          <Text style={styles.reviewEmoji}>🔁</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.reviewTitle}>
            {dueCount > 0
              ? `Review ${dueCount} word${dueCount === 1 ? '' : 's'} due`
              : 'Daily review · all caught up'}
          </Text>
          <Text style={styles.reviewSubtitle}>
            {dueCount > 0
              ? 'Spaced repetition keeps words from fading'
              : 'Words you miss in lessons show up here'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Text style={styles.sectionLabel}>LEAGUE</Text>
      <View style={styles.leagueCard}>
        <View style={styles.leagueHead}>
          <Text style={styles.leagueTier}>
            {tier.emoji} {tier.name} league
          </Text>
          <Text style={styles.leagueLevel}>⭐ Level {level.level}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${Math.round(weekProgress.pct * 100)}%` }]} />
        </View>
        <Text style={styles.leagueSub}>
          {weeklyNow} / {weekProgress.goal} XP this week
          {weekProgress.met ? ' — target met 🎉' : ` · ${weekProgress.remaining} to go`}
        </Text>
        <Text style={styles.leagueNote}>
          {rankText ??
            'Tiers come from lifetime XP and never demote — the weekly bar is a guide, not a rule.'}
        </Text>
      </View>

      <Text style={styles.sectionLabel}>TODAY&apos;S PLAN · ~{planTotalMinutes(plan)} MIN</Text>
      <View style={styles.planCard}>
        {plan.map((item, index) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(item.route)}
            style={({ pressed }) => [
              styles.planRow,
              index < plan.length - 1 && styles.planRowDivider,
              pressed && styles.pressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${item.title}. ${item.subtitle}`}
          >
            <Text style={styles.planIcon}>{item.icon}</Text>
            <View style={styles.flex}>
              <Text style={styles.planTitle}>{item.title}</Text>
              <Text style={styles.planSubtitle}>{item.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>

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
          <Text style={styles.actionSubtitle}>10 languages to explore</Text>
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
  chipsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  xpChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  xpChipText: { ...typography.caption, color: colors.accent, fontWeight: '600' },
  leagueCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  leagueHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  leagueTier: { ...typography.bodyStrong, color: colors.text },
  leagueLevel: { ...typography.caption, color: colors.textMuted },
  xpTrack: {
    height: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  xpFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  leagueSub: { ...typography.caption, color: colors.text, marginTop: spacing.sm },
  leagueNote: { ...typography.micro, color: colors.textMuted, marginTop: spacing.xs },
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
  heroBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  heroChapter: { ...typography.micro, color: 'rgba(255,255,255,0.75)' },
  heroLesson: { ...typography.bodyStrong, color: colors.white, marginTop: 2 },
  heroProgress: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  reviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewEmoji: { fontSize: 20 },
  reviewTitle: { ...typography.bodyStrong, color: colors.text },
  reviewSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  planRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  planIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  planTitle: { ...typography.bodyStrong, color: colors.text },
  planSubtitle: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
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
