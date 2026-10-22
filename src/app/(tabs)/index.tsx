import { useEffect, useMemo, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Avatar } from '@/components/Avatar';
import { SectionHeader } from '@/components/SectionHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatTile } from '@/components/StatTile';
import { WeeklyBars } from '@/components/WeeklyBars';
import { Pill } from '@/components/Pill';
import { useAuth } from '@/context/AuthContext';
import { usePreferences, dailyGoalXp } from '@/state/preferences';
import { useLearning, normalizeKey } from '@/state/learning';
import { useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { FEATURED_LANGUAGES, LANGUAGES, getLanguage } from '@/data/languages';
import { progressForLanguage } from '@/lib/catalog';
import { activeToday, activityByDay, computeStreak, weekdayLabels, weakestSkill } from '@/lib/analytics';
import { buildDailyPlan, planTotalMinutes } from '@/lib/dailyPlan';
import { levelForXp, todayXp, weekKey, weeklyXp } from '@/lib/xp';
import { rankLabel, tierForXp, weeklyProgress } from '@/lib/league';
import { fetchLeague, postWeeklyXp } from '@/lib/neonApi';
import { isNeonConfigured } from '@/lib/neon';
import { loadCurriculum } from '@/lib/curriculum/store';
import { wordOfTheDay } from '@/lib/phrasebook';
import { speakNative } from '@/lib/ai';
import type { Chapter, Lesson } from '@/lib/curriculum/types';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

export default function HomeScreen() {
  const { user, isDemo, getAccessToken } = useAuth();
  const {
    targetLanguageId,
    activeLanguageIds,
    dailyGoalMinutes,
    setTargetLanguage,
  } = usePreferences();
  const language = getLanguage(targetLanguageId);
  const { progress, dueCount, vocab, addWord } = useLearning();
  const { profile } = useProfile();
  const { state: analytics } = useAnalytics();

  const [chapters, setChapters] = useState<{ lang: string; chapters: Chapter[] } | null>(null);
  const [fade] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let cancelled = false;
    loadCurriculum(targetLanguageId)
      .then((loaded) => {
        if (!cancelled) setChapters({ lang: targetLanguageId, chapters: loaded });
      })
      .catch(() => {
        if (!cancelled) setChapters({ lang: targetLanguageId, chapters: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [targetLanguageId]);

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 460,
      useNativeDriver: true,
    }).start();
  }, [fade]);

  const loaded = useMemo(
    () => (chapters?.lang === targetLanguageId ? chapters.chapters : []),
    [chapters, targetLanguageId]
  );

  const next = useMemo(() => {
    const flat: { lesson: Lesson; chapter: Chapter }[] = [];
    for (const chapter of loaded) {
      for (const lesson of chapter.lessons) flat.push({ lesson, chapter });
    }
    if (flat.length === 0) return null;
    return (
      flat.find((entry) => (progress[entry.lesson.id]?.score ?? 0) < 70) ?? flat[flat.length - 1]
    );
  }, [loaded, progress]);

  const nextScore = next ? progress[next.lesson.id]?.score : undefined;
  const chapterLessons = next?.chapter.lessons.length ?? 0;
  const chapterDone = next
    ? next.chapter.lessons.filter((lesson) => (progress[lesson.id]?.score ?? 0) >= 70).length
    : 0;
  const chapterPct = chapterLessons > 0 ? chapterDone / chapterLessons : 0;

  const streak = computeStreak(analytics.events);
  const streakAtRisk = streak > 0 && !activeToday(analytics.events);
  const speakAverage =
    analytics.speak.count > 0 ? analytics.speak.scoreSum / analytics.speak.count : null;

  const now = new Date();
  const weeklyNow = weeklyXp(analytics.xp, now);
  const dailyNow = todayXp(analytics.xp, now);
  const goal = dailyGoalXp(dailyGoalMinutes);
  const goalPct = Math.min(1, dailyNow / goal);
  const level = levelForXp(analytics.xp.lifetime);
  const tier = tierForXp(analytics.xp.lifetime);
  const weekProgress = weeklyProgress(weeklyNow, tier);
  const week = weekKey(now);
  const weekValues = activityByDay(analytics.events);
  const weekLabels = weekdayLabels();

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
        // offline or leaderboard not deployed yet — the tier card stands alone
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

  const hour = now.getHours();
  const greeting =
    hour < 5 ? 'Good night' : hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = (profile.displayName || user?.displayName || 'friend').split(' ')[0];

  const myLanguages = activeLanguageIds.filter((id) => LANGUAGES.some((l) => l.id === id));

  const word = useMemo(() => wordOfTheDay(language.id, loaded), [language.id, loaded]);
  const wordSaved = word
    ? Boolean(vocab[`${word.languageId}:${normalizeKey(word.target)}`])
    : false;

  return (
    <Screen scroll tabBarSpace>
      <Animated.View
        style={{
          opacity: fade,
          transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        <View style={styles.topRow}>
          <View style={styles.flex}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name}>{firstName}</Text>
          </View>
          <View style={styles.topActions}>
            <View style={styles.freeChip}>
              <View style={styles.freeDot} />
              <Text style={styles.freeText}>FREE</Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open your profile"
              hitSlop={6}
            >
              <Avatar
                name={profile.displayName || user?.displayName}
                emoji={profile.avatar}
                color={profile.avatarColor}
                size={38}
                onDark
              />
            </Pressable>
          </View>
        </View>

        {isDemo ? (
          <View style={styles.demoBanner}>
            <Ionicons name="flask-outline" size={14} color={colors.warning} />
            <Text style={styles.demoBannerText}>
              Demo build — accounts and progress stay on this device. Everything is still free.
            </Text>
          </View>
        ) : null}

        {/* ── Continue hero ─────────────────────────────────────────── */}
        <Pressable
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
          accessibilityRole="button"
          accessibilityLabel={next ? `Continue ${next.lesson.title}` : `Open ${language.name}`}
          style={({ pressed }) => [pressed && styles.pressed]}
        >
          <LinearGradient
            colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroOrbA} />
            <View style={styles.heroOrbB} />
            <View style={styles.heroTop}>
              <View style={styles.heroFlagWrap}>
                <Text style={styles.heroFlag}>{language.flag}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.heroKicker}>CONTINUE LEARNING</Text>
                <Text style={styles.heroTitle}>{language.name}</Text>
                <Text style={styles.heroNative}>
                  {language.nativeName} · {language.nativeSpeakers}
                </Text>
              </View>
              <View style={styles.heroArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.onDark} />
              </View>
            </View>

            <View style={styles.heroDivider} />

            <View style={styles.heroBottom}>
              <View style={styles.flex}>
                <Text style={styles.heroChapter} numberOfLines={1}>
                  {next ? next.chapter.title : 'Your starter pack'}
                </Text>
                <Text style={styles.heroLesson} numberOfLines={1}>
                  {next ? next.lesson.title : 'Open the first lesson'}
                </Text>
              </View>
              <View style={styles.heroScore}>
                <Text style={styles.heroScoreText}>
                  {nextScore !== undefined ? `${nextScore}%` : 'NEW'}
                </Text>
              </View>
            </View>

            <View style={styles.heroProgressRow}>
              <View style={styles.heroTrack}>
                <View style={[styles.heroFill, { width: `${Math.max(4, chapterPct * 100)}%` }]} />
              </View>
              <Text style={styles.heroProgressText}>
                {chapterDone}/{chapterLessons || '–'} lessons
              </Text>
            </View>

            <View style={styles.heroCta}>
              <Ionicons name="play" size={13} color={colors.gradientFrom} />
              <Text style={styles.heroCtaText}>
                {next ? 'Continue lesson' : 'Start learning'} · {next ? `${Math.max(3, Math.round(next.lesson.exercises.length * 1.2))} min` : '5 min'}
              </Text>
            </View>
          </LinearGradient>
        </Pressable>

        {/* ── Summary ───────────────────────────────────────────────── */}
        <View style={styles.statRow}>
          <StatTile
            icon="flame"
            value={streak}
            label="DAY STREAK"
            tint={colors.accent}
            tintSoft={colors.accentSoft}
          />
          <StatTile icon="sparkles" value={dailyNow} label="XP TODAY" tint={colors.sun} tintSoft={colors.sunSoft} />
          <StatTile
            icon="book"
            value={Object.keys(vocab).length}
            label="WORDS SAVED"
            tint={colors.lilac}
            tintSoft={colors.lilacSoft}
          />
        </View>

        {/* ── Daily goal ────────────────────────────────────────────── */}
        <View style={styles.goalCard}>
          <View style={styles.goalTop}>
            <View style={styles.goalIcon}>
              <Ionicons name="flag" size={16} color={colors.primary} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.goalTitle}>Today’s {dailyGoalMinutes}-minute goal</Text>
              <Text style={styles.goalSub}>
                {goalPct >= 1
                  ? 'Goal met — anything else is a bonus 🎉'
                  : `${Math.max(0, Math.ceil((goal - dailyNow) / 10))} min left · ${dailyNow}/${goal} XP`}
              </Text>
            </View>
            <Text style={styles.goalPct}>{Math.round(goalPct * 100)}%</Text>
          </View>
          <ProgressBar
            value={goalPct}
            height={9}
            color={goalPct >= 1 ? colors.success : colors.primary}
            trackColor={colors.surfaceHigh}
            style={styles.goalBar}
          />
          <Pressable
            onPress={() => router.push('/profile')}
            hitSlop={8}
            accessibilityRole="button"
            style={styles.goalEdit}
          >
            <Text style={styles.goalEditText}>Change goal</Text>
          </Pressable>
        </View>

        {/* ── Daily plan ────────────────────────────────────────────── */}
        <SectionHeader
          title={`Today’s plan · ~${planTotalMinutes(plan)} min`}
          icon="checkmark-circle-outline"
        />
        <View style={styles.planCard}>
          {plan.map((item, index) => (
            <Pressable
              key={item.id}
              onPress={() => router.push(item.route)}
              style={({ pressed }) => [
                styles.planRow,
                index < plan.length - 1 && styles.planDivider,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}. ${item.subtitle}`}
            >
              <View style={styles.planNumber}>
                <Text style={styles.planNumberText}>{index + 1}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.planTitle}>{item.title}</Text>
                <Text style={styles.planSubtitle} numberOfLines={1}>
                  {item.subtitle}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
            </Pressable>
          ))}
        </View>

        {/* ── My languages ──────────────────────────────────────────── */}
        <SectionHeader
          title="My languages"
          action="Add another"
          onAction={() => router.push('/learn')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.langRail}
        >
          {myLanguages.map((id) => {
            const option = getLanguage(id);
            const summary = progressForLanguage(id, progress);
            const active = id === targetLanguageId;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  setTargetLanguage(id);
                  router.push(`/language/${id}`);
                }}
                style={({ pressed }) => [
                  styles.langCard,
                  active && styles.langCardActive,
                  pressed && styles.pressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${option.name}, ${summary.completedLessons} of ${summary.lessons} lessons`}
              >
                <View style={styles.langTop}>
                  <Text style={styles.langFlag}>{option.flag}</Text>
                  {active ? <Pill label="ACTIVE" tone="free" /> : null}
                </View>
                <Text style={styles.langName} numberOfLines={1}>
                  {option.name}
                </Text>
                <Text style={styles.langMeta}>
                  {summary.completedLessons}/{summary.lessons} lessons
                </Text>
                <ProgressBar
                  value={summary.pct}
                  height={5}
                  color={active ? colors.primary : colors.textFaint}
                  style={styles.langProgress}
                />
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => router.push('/learn')}
            style={({ pressed }) => [styles.langAdd, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <View style={styles.langAddIcon}>
              <Ionicons name="add" size={22} color={colors.primary} />
            </View>
            <Text style={styles.langAddText}>Add a{'\n'}language</Text>
          </Pressable>
        </ScrollView>

        {/* ── Word of the day ───────────────────────────────────────── */}
        {word ? (
          <>
            <SectionHeader
              title="Word of the day"
              action="Phrasebook"
              onAction={() => router.push('/words?tab=phrasebook')}
            />
            <View style={styles.wordCard}>
              <View style={styles.wordMain}>
                <Text
                  style={[
                    styles.wordTarget,
                    language.direction === 'rtl' && styles.rtl,
                  ]}
                >
                  {word.target}
                </Text>
                {word.roman ? <Text style={styles.wordRoman}>{word.roman}</Text> : null}
                <Text style={styles.wordEnglish}>{word.english}</Text>
                <View style={styles.wordTags}>
                  <Pill label={language.flag + ' ' + language.name} tone="muted" />
                  <Pill label={word.category.toUpperCase()} tone="lilac" />
                </View>
              </View>
              <View style={styles.wordActions}>
                <Pressable
                  onPress={() => speakNative(word.target, language.ttsLocale)}
                  style={styles.wordAction}
                  accessibilityRole="button"
                  accessibilityLabel={`Hear ${word.target}`}
                >
                  <Ionicons name="volume-high" size={19} color={colors.primary} />
                </Pressable>
                <Pressable
                  onPress={() =>
                    void addWord({
                      languageId: language.id,
                      target: word.target,
                      translation: word.english,
                    })
                  }
                  disabled={wordSaved}
                  style={[styles.wordAction, wordSaved && styles.wordActionSaved]}
                  accessibilityRole="button"
                  accessibilityLabel={wordSaved ? 'Saved to review' : 'Save to review'}
                >
                  <Ionicons
                    name={wordSaved ? 'checkmark' : 'add'}
                    size={20}
                    color={wordSaved ? colors.success : colors.primary}
                  />
                </Pressable>
              </View>
            </View>
          </>
        ) : null}

        {/* ── Rhythm ────────────────────────────────────────────────── */}
        <SectionHeader title="Your rhythm" action="Badges" onAction={() => router.push('/words?tab=badges')} />
        <View style={styles.rhythmCard}>
          <View style={styles.rhythmHead}>
            <View>
              <Text style={styles.rhythmTitle}>
                {tier.emoji} {tier.name} league
              </Text>
              <Text style={styles.rhythmSub}>
                Level {level.level} · {weeklyNow}/{weekProgress.goal} XP this week
              </Text>
            </View>
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>LV {level.level}</Text>
            </View>
          </View>
          <WeeklyBars values={weekValues} labels={weekLabels} height={54} />
          <Text style={styles.rhythmNote}>
            {rankText ?? 'Tiers come from lifetime XP and never demote — the weekly bar is a guide.'}
          </Text>
        </View>

        {/* ── Explore ───────────────────────────────────────────────── */}
        <SectionHeader
          title={`Explore ${LANGUAGES.length} languages`}
          action="See all"
          onAction={() => router.push('/learn')}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.exploreRail}
        >
          {FEATURED_LANGUAGES.filter((item) => item.id !== targetLanguageId)
            .slice(0, 5)
            .map((option) => (
              <Pressable
                key={option.id}
                onPress={() => {
                  setTargetLanguage(option.id);
                  router.push(`/language/${option.id}`);
                }}
                style={({ pressed }) => [styles.exploreCard, pressed && styles.pressed]}
                accessibilityRole="button"
              >
                <Text style={styles.exploreFlag}>{option.flag}</Text>
                <Text style={styles.exploreName}>{option.name}</Text>
                <Text
                  style={[styles.exploreHello, option.direction === 'rtl' && styles.rtl]}
                  numberOfLines={1}
                >
                  {option.greeting.text}
                </Text>
                <Text style={styles.exploreMeaning} numberOfLines={1}>
                  {option.greeting.meaning}
                </Text>
              </Pressable>
            ))}
          <Pressable
            onPress={() => router.push('/learn')}
            style={({ pressed }) => [styles.exploreAll, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Ionicons name="globe-outline" size={24} color={colors.primary} />
            <Text style={styles.exploreAllText}>All {LANGUAGES.length}{'\n'}languages</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.primary} />
          </Pressable>
        </ScrollView>

        <View style={styles.freeCard}>
          <Text style={styles.freeEmoji}>🌍</Text>
          <View style={styles.flex}>
            <Text style={styles.freeTitle}>Every language. Every lesson. Free.</Text>
            <Text style={styles.freeBody}>
              No trial timers, no locked chapters, no card required. Babelish is free during beta —
              and the core course stays free after launch.
            </Text>
            <View style={styles.freePerks}>
              <Text style={styles.freePerk}>✓ Offline packs</Text>
              <Text style={styles.freePerk}>✓ Native voices</Text>
              <Text style={styles.freePerk}>✓ No ads</Text>
            </View>
          </View>
        </View>

        <Text style={styles.footerNote}>
          10 minutes a day beats 2 hours on Sunday. Your tutor keeps every session short, spoken,
          and personal.
        </Text>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.86 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  greeting: { ...typography.caption, color: colors.textMuted },
  name: { ...typography.title, color: colors.text, marginTop: 1 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  freeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primaryTint,
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  freeDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.success },
  freeText: { ...typography.micro, fontSize: 9.5, color: colors.primary },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
    ...shadows.card,
  },
  avatarText: { ...typography.bodyStrong, color: colors.onDark, fontSize: 14 },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  demoBannerText: { ...typography.caption, color: colors.warning, flex: 1, lineHeight: 18 },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroOrbA: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255,255,255,0.05)',
    top: -110,
    right: -70,
  },
  heroOrbB: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(242,193,78,0.10)',
    bottom: -60,
    left: -20,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroFlagWrap: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroFlag: { fontSize: 30 },
  heroKicker: { ...typography.micro, color: colors.onDarkFaint, fontSize: 9.5 },
  heroTitle: { ...typography.heading, color: colors.onDark, fontSize: 21, marginTop: 2 },
  heroNative: { ...typography.caption, color: colors.onDarkMuted, marginTop: 2, fontSize: 12 },
  heroArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.16)', marginVertical: spacing.lg },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroChapter: { ...typography.micro, color: colors.onDarkMuted, letterSpacing: 0.5 },
  heroLesson: { ...typography.bodyStrong, color: colors.onDark, marginTop: 3, fontSize: 16 },
  heroScore: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
  },
  heroScoreText: { ...typography.micro, color: colors.onDark, fontSize: 10 },
  heroProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  heroTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
    overflow: 'hidden',
  },
  heroFill: { height: '100%', borderRadius: 3, backgroundColor: colors.sun },
  heroProgressText: { ...typography.micro, fontSize: 9, color: colors.onDarkMuted },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: colors.sun,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 9,
    marginTop: spacing.lg,
  },
  heroCtaText: { ...typography.caption, color: colors.gradientFrom, fontWeight: '800', fontSize: 12 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  goalCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  goalTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  goalIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalTitle: { ...typography.bodyStrong, color: colors.text },
  goalSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  goalPct: { ...typography.heading, color: colors.primary, fontSize: 17 },
  goalBar: { marginTop: spacing.md },
  goalEdit: { alignSelf: 'flex-end', marginTop: spacing.sm },
  goalEditText: { ...typography.micro, color: colors.textFaint, fontSize: 9.5 },
  planCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  planRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  planDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  planNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planNumberText: { ...typography.bodyStrong, color: colors.primary, fontSize: 13 },
  planTitle: { ...typography.bodyStrong, color: colors.text, fontSize: 14 },
  planSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2, fontSize: 12 },
  langRail: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  langCard: {
    width: 150,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  langCardActive: { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: '#FBFDFB' },
  langTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  langFlag: { fontSize: 24 },
  langName: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm, fontSize: 14 },
  langMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1, fontSize: 11 },
  langProgress: { marginTop: spacing.sm },
  langAdd: {
    width: 108,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  langAddIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langAddText: { ...typography.caption, color: colors.primary, textAlign: 'center', fontSize: 11, fontWeight: '600' },
  wordCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  wordMain: { flex: 1 },
  wordTarget: { ...typography.title, color: colors.text, fontSize: 24 },
  wordRoman: { ...typography.caption, color: colors.textFaint, fontStyle: 'italic', marginTop: 2 },
  wordEnglish: { ...typography.body, color: colors.textMuted, marginTop: 4 },
  wordTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.md },
  wordActions: { justifyContent: 'center', gap: spacing.sm },
  wordAction: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordActionSaved: { backgroundColor: colors.successSoft },
  rhythmCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  rhythmHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  rhythmTitle: { ...typography.bodyStrong, color: colors.text },
  rhythmSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  levelChip: {
    backgroundColor: colors.primaryTint,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  levelChipText: { ...typography.micro, color: colors.primary, fontSize: 10 },
  rhythmNote: { ...typography.micro, color: colors.textFaint, marginTop: spacing.md, letterSpacing: 0.2, lineHeight: 15, fontWeight: '500' },
  exploreRail: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  exploreCard: {
    width: 138,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  exploreFlag: { fontSize: 24 },
  exploreName: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm, fontSize: 13 },
  exploreHello: { ...typography.caption, color: colors.primary, marginTop: 3, fontSize: 12, fontWeight: '600' },
  exploreMeaning: { ...typography.micro, color: colors.textFaint, marginTop: 1, fontSize: 9, letterSpacing: 0.2, fontWeight: '500' },
  exploreAll: {
    width: 108,
    borderRadius: radii.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  exploreAllText: { ...typography.caption, color: colors.primary, textAlign: 'center', fontWeight: '700', fontSize: 12 },
  freeCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surfaceTint,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  freeEmoji: { fontSize: 26 },
  freeTitle: { ...typography.bodyStrong, color: colors.text },
  freeBody: { ...typography.caption, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  freePerks: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  freePerk: { ...typography.micro, color: colors.success, fontSize: 9.5, letterSpacing: 0.2 },
  footerNote: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xl,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
});
