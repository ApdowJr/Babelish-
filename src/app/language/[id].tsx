import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { Pill } from '@/components/Pill';
import { Button } from '@/components/Button';
import { DIFFICULTY_LABEL, getLanguage, languageStatus } from '@/data/languages';
import { starterPhrasebook } from '@/lib/phrasebook';
import { usePreferences } from '@/state/preferences';
import { normalizeKey, useLearning } from '@/state/learning';
import { isChapterUnlocked, loadCurriculum } from '@/lib/curriculum/store';
import { courseStatus } from '@/lib/curriculum/status';
import { speakNative } from '@/lib/ai';
import type { Chapter, Lesson } from '@/lib/curriculum/types';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

export default function LanguageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = getLanguage(String(id));
  const {
    targetLanguageId,
    setTargetLanguage,
    activeLanguageIds,
    toggleMyLanguage,
  } = usePreferences();
  const isCurrent = language.id === targetLanguageId;
  const inMyLanguages = activeLanguageIds.includes(language.id);

  const { progress, addWord, vocab } = useLearning();
  const [data, setData] = useState<{ languageId: string; chapters: Chapter[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCurriculum(language.id)
      .then((loaded) => {
        if (!cancelled) setData({ languageId: language.id, chapters: loaded });
      })
      .catch(() => {
        if (!cancelled) setData({ languageId: language.id, chapters: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [language.id]);

  const chaptersLoaded = data?.languageId === language.id;
  const chapters = useMemo(
    () => (data?.languageId === language.id ? data.chapters : []),
    [data, language.id]
  );
  const expandedIdEffective =
    expandedId === ''
      ? null
      : expandedId !== null && chapters.some((chapter) => chapter.id === expandedId)
        ? expandedId
        : (chapters[0]?.id ?? null);

  const totalLessons = chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  const completedLessons = chapters.reduce(
    (sum, chapter) =>
      sum + chapter.lessons.filter((lesson) => (progress[lesson.id]?.score ?? 0) >= 70).length,
    0
  );
  const pct = totalLessons > 0 ? completedLessons / totalLessons : 0;
  const firstIncomplete = useMemo(() => {
    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        if ((progress[lesson.id]?.score ?? 0) < 70) return lesson;
      }
    }
    return chapters[0]?.lessons[0] ?? null;
  }, [chapters, progress]);

  const phrases = useMemo(() => starterPhrasebook(language.id).slice(0, 3), [language.id]);

  function startLesson(lesson: Lesson | null) {
    if (!lesson) return;
    setTargetLanguage(language.id);
    router.push({ pathname: '/lesson/[id]', params: { id: lesson.id, lang: language.id } });
  }

  const status = languageStatus(language.id);
  const course = courseStatus(language.id);

  return (
    <Screen scroll>
      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.orbA} />
        <View style={styles.orbB} />
        <View style={styles.heroTop}>
          <Text style={styles.flag}>{language.flag}</Text>
          <View style={styles.heroPills}>
            <Pill label="FREE" tone="dark" icon="sparkles" />
            <Pill label={status === 'beta' ? 'WEEKLY UPDATES' : 'STARTER PACK'} tone="dark" />
          </View>
        </View>
        <Text style={styles.name}>{language.name}</Text>
        <Text style={styles.native}>
          {language.nativeName} · {language.nativeSpeakers}
        </Text>
        <Text
          style={[styles.hello, language.direction === 'rtl' && styles.rtl]}
        >
          {language.greeting.text}
        </Text>
        <Text style={styles.helloMeaning}>
          “{language.greeting.meaning}”
          {language.greeting.roman ? ` · ${language.greeting.roman}` : ''}
        </Text>

        <View style={styles.heroMeta}>
          <Meta icon="text-outline" label={language.script} />
          <Meta icon="layers-outline" label={language.family} />
          <Meta icon="speedometer-outline" label={DIFFICULTY_LABEL[language.difficulty]} />
        </View>

        <Button
          label={
            completedLessons > 0
              ? `Continue ${language.name}`
              : `Start ${language.name} — free`
          }
          variant="light"
          onPress={() => startLesson(firstIncomplete)}
          style={styles.heroCta}
        />
        <Pressable
          onPress={() => toggleMyLanguage(language.id)}
          style={styles.addToggle}
          accessibilityRole="button"
          accessibilityState={{ selected: inMyLanguages }}
        >
          <Ionicons
            name={inMyLanguages ? 'checkmark-circle' : 'add-circle-outline'}
            size={17}
            color={colors.onDark}
          />
          <Text style={styles.addToggleText}>
            {inMyLanguages ? 'In my languages' : 'Add to my languages'}
          </Text>
        </Pressable>
      </LinearGradient>

      <View style={styles.progressCard}>
        <View style={styles.progressTop}>
          <View>
            <Text style={styles.progressTitle}>
              {completedLessons > 0 ? 'Your progress' : 'Ready when you are'}
            </Text>
            <Text style={styles.progressSub}>
              {chaptersLoaded
                ? `${completedLessons} of ${totalLessons} lessons mastered · ${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`
                : 'Loading your course…'}
            </Text>
          </View>
          <Text style={styles.progressPct}>{Math.round(pct * 100)}%</Text>
        </View>
        <ProgressBar value={pct} height={9} style={styles.progressBar} />
        <View style={styles.progressStats}>
          <ProgressStat value={chapters.length} label="CHAPTERS" />
          <View style={styles.progressDivider} />
          <ProgressStat value={totalLessons} label="LESSONS" />
          <View style={styles.progressDivider} />
          <ProgressStat value="∞" label="RETAKES" />
        </View>
      </View>

      <Text style={styles.blurb}>{language.blurb}</Text>

      <SectionHeader title="Dialects we teach" icon="chatbubbles-outline" />
      <View style={styles.chipsWrap}>
        {language.dialects.map((dialect) => (
          <View key={dialect} style={styles.dialectChip}>
            <Text style={styles.dialectText}>{dialect}</Text>
          </View>
        ))}
      </View>

      <SectionHeader
        title={`Course · ${course.level}`}
        action={completedLessons > 0 ? 'Start over' : undefined}
        onAction={firstIncomplete ? () => startLesson(chapters[0]?.lessons[0] ?? null) : undefined}
      />

      <View style={styles.courseCard}>
        <View style={styles.courseTop}>
          <Pill
            label={course.tier === 'authored' ? 'AUTHORED' : 'STARTER COURSE'}
            tone={course.tier === 'authored' ? 'free' : 'sky'}
            icon={course.tier === 'authored' ? 'checkmark-circle' : 'construct'}
          />
          <Text style={styles.courseMeta}>
            {course.chapters} chapters · {course.lessons} lessons · {course.exercises} exercises
          </Text>
        </View>
        <Text style={styles.courseNote}>{course.note}</Text>
      </View>

      {!chaptersLoaded ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : chapters.length === 0 ? (
        <Text style={styles.comingSoon}>
          This language’s first chapter is still being written — the Speak tab is live today.
        </Text>
      ) : (
        chapters.map((chapter, chapterIndex) => {
          const unlocked = isChapterUnlocked(chapters, chapterIndex, progress);
          const doneCount = chapter.lessons.filter(
            (lesson) => (progress[lesson.id]?.score ?? 0) >= 70
          ).length;
          const chapterPct = chapter.lessons.length
            ? Math.round((doneCount / chapter.lessons.length) * 100)
            : 0;
          const expanded = expandedIdEffective === chapter.id;
          return (
            <View key={chapter.id} style={styles.chapterCard}>
              <Pressable
                disabled={!unlocked}
                onPress={() => setExpandedId(expanded ? '' : chapter.id)}
                style={styles.chapterHeader}
                accessibilityRole="button"
                accessibilityState={{ expanded, disabled: !unlocked }}
              >
                <View style={[styles.chapterBadge, !unlocked && styles.chapterBadgeLocked]}>
                  {unlocked ? (
                    <Text style={styles.chapterNum}>{chapterIndex + 1}</Text>
                  ) : (
                    <Ionicons name="lock-closed" size={13} color={colors.textFaint} />
                  )}
                </View>
                <View style={styles.flex}>
                  <View style={styles.chapterTitleRow}>
                    <Text
                      style={[styles.chapterTitle, !unlocked && styles.chapterTitleLocked]}
                      numberOfLines={1}
                    >
                      {chapter.title}
                    </Text>
                    {chapterPct === 100 ? <Pill label="DONE" tone="free" /> : null}
                  </View>
                  <Text style={styles.chapterDesc} numberOfLines={2}>
                    {unlocked
                      ? chapter.description
                      : 'Score 70%+ on the previous chapter to unlock'}
                  </Text>
                  {unlocked && doneCount > 0 ? (
                    <View style={styles.chapterProgressRow}>
                      <View style={styles.chapterProgressTrack}>
                        <View style={[styles.chapterProgressFill, { width: `${chapterPct}%` }]} />
                      </View>
                      <Text style={styles.chapterProgressText}>{chapterPct}%</Text>
                    </View>
                  ) : null}
                </View>
                {unlocked ? (
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                ) : null}
              </Pressable>

              {unlocked && expanded ? (
                <View style={styles.lessonList}>
                  {chapter.lessons.map((lesson, lessonIndex) => {
                    const score = progress[lesson.id]?.score;
                    const mastered = (score ?? 0) >= 70;
                    return (
                      <View key={lesson.id}>
                        {lessonIndex > 0 ? <View style={styles.rowDivider} /> : null}
                        <Pressable
                          onPress={() => startLesson(lesson)}
                          style={styles.lessonRow}
                          accessibilityRole="button"
                        >
                          <View style={[styles.lessonDot, mastered && styles.lessonDotDone]}>
                            {mastered ? (
                              <Ionicons name="checkmark" size={15} color={colors.success} />
                            ) : (
                              <Text style={styles.lessonDotText}>{lessonIndex + 1}</Text>
                            )}
                          </View>
                          <View style={styles.flex}>
                            <Text style={styles.lessonTitle}>{lesson.title}</Text>
                            <Text style={styles.lessonGoal}>
                              {lesson.goal} · {lesson.exercises.length} exercises
                            </Text>
                          </View>
                          {score !== undefined ? (
                            <Text style={[styles.lessonScore, mastered && styles.lessonScoreDone]}>
                              {score}%
                            </Text>
                          ) : (
                            <View style={styles.playDot}>
                              <Ionicons name="play" size={12} color={colors.accent} />
                            </View>
                          )}
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <SectionHeader
        title="Starter phrases"
        action="Full phrasebook"
        onAction={() => {
          setTargetLanguage(language.id);
          router.push('/words?tab=phrasebook');
        }}
      />
      <View style={styles.phraseList}>
        {phrases.map((phrase, index) => {
          const saved = Boolean(vocab[`${phrase.languageId}:${normalizeKey(phrase.target)}`]);
          return (
            <View key={phrase.id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <View style={styles.phraseRow}>
                <Pressable
                  onPress={() => speakNative(phrase.target, language.ttsLocale)}
                  style={styles.phrasePlay}
                  accessibilityRole="button"
                  accessibilityLabel={`Hear ${phrase.target}`}
                >
                  <Ionicons name="volume-medium" size={17} color={colors.primary} />
                </Pressable>
                <View style={styles.flex}>
                  <Text
                    style={[styles.phraseTarget, language.direction === 'rtl' && styles.rtl]}
                  >
                    {phrase.target}
                  </Text>
                  <Text style={styles.phraseEnglish}>
                    {phrase.english}
                    {phrase.roman ? ` · ${phrase.roman}` : ''}
                  </Text>
                </View>
                <Pressable
                  onPress={() =>
                    void addWord({
                      languageId: language.id,
                      target: phrase.target,
                      translation: phrase.english,
                    })
                  }
                  disabled={saved}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={saved ? 'Saved' : 'Save phrase'}
                >
                  <Ionicons
                    name={saved ? 'checkmark-circle' : 'add-circle-outline'}
                    size={21}
                    color={saved ? colors.success : colors.textFaint}
                  />
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <SectionHeader title="Real-life scenarios" icon="sparkles-outline" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scenarioRail}
      >
        {language.scenarios.map((scenario) => (
          <Pressable
            key={scenario.id}
            onPress={() => {
              setTargetLanguage(language.id);
              router.push('/speak');
            }}
            style={({ pressed }) => [styles.scenarioCard, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
            <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            <Text style={styles.scenarioMeta}>Talk it through →</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Button
        label={isCurrent ? `Speak ${language.name} now` : `Switch to ${language.name} & speak`}
        onPress={() => {
          setTargetLanguage(language.id);
          router.push('/speak');
        }}
        style={{ marginTop: spacing.xl }}
      />
      <Text style={styles.footerNote}>
        Every lesson here is free, including retakes. Your progress syncs when you are online and
        works offline too.
      </Text>
    </Screen>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={11} color={colors.onDarkMuted} />
      <Text style={styles.metaText} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function ProgressStat({ value, label }: { value: number | string; label: string }) {
  return (
    <View style={styles.progressStat}>
      <Text style={styles.progressStatValue}>{value}</Text>
      <Text style={styles.progressStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.85 },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    marginTop: spacing.sm,
    overflow: 'hidden',
    ...shadows.hero,
  },
  orbA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    right: -60,
  },
  orbB: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(242,193,78,0.12)',
    bottom: -40,
    left: -20,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flag: { fontSize: 56 },
  heroPills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', flex: 1 },
  name: { ...typography.display, color: colors.onDark, marginTop: spacing.md },
  native: { ...typography.body, color: colors.onDarkMuted, marginTop: 2 },
  hello: { ...typography.title, color: colors.sun, marginTop: spacing.lg, fontSize: 22 },
  helloMeaning: { ...typography.caption, color: colors.onDarkMuted, marginTop: 2 },
  heroMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.lg },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  metaText: { ...typography.micro, color: colors.onDarkMuted, fontSize: 9.5, letterSpacing: 0.3 },
  heroCta: { marginTop: spacing.lg },
  addToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.md,
    paddingVertical: spacing.xs,
  },
  addToggleText: { ...typography.caption, color: colors.onDark, fontWeight: '600' },
  progressCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.md,
    ...shadows.card,
  },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  progressTitle: { ...typography.bodyStrong, color: colors.text },
  progressSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  progressPct: { ...typography.title, color: colors.primary, fontSize: 22 },
  progressBar: { marginTop: spacing.md },
  progressStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.sm,
    paddingVertical: spacing.md,
  },
  progressStat: { flex: 1, alignItems: 'center' },
  progressStatValue: { ...typography.heading, color: colors.text, fontSize: 17 },
  progressStatLabel: { ...typography.micro, color: colors.textFaint, fontSize: 8.5, marginTop: 2 },
  progressDivider: { width: 1, height: 24, backgroundColor: colors.border },
  courseCard: {
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  courseTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  courseMeta: { ...typography.micro, color: colors.textFaint, flexShrink: 1, textAlign: 'right' },
  courseNote: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 18 },
  blurb: { ...typography.body, color: colors.text, lineHeight: 23, marginTop: spacing.xl },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dialectChip: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  dialectText: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  loading: { paddingVertical: spacing.xl, alignItems: 'center' },
  comingSoon: { ...typography.caption, color: colors.textFaint, lineHeight: 18 },
  chapterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.card,
  },
  chapterHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  chapterBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterBadgeLocked: { backgroundColor: colors.surfaceHigh },
  chapterNum: { ...typography.bodyStrong, color: colors.primary, fontSize: 14 },
  chapterTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  chapterTitle: { ...typography.bodyStrong, color: colors.text, flexShrink: 1 },
  chapterTitleLocked: { color: colors.textFaint },
  chapterDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 17 },
  chapterProgressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  chapterProgressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  chapterProgressFill: { height: '100%', backgroundColor: colors.success, borderRadius: radii.pill },
  chapterProgressText: { ...typography.micro, color: colors.success, fontSize: 9 },
  lessonList: { borderTopWidth: 1, borderTopColor: colors.border, paddingHorizontal: spacing.lg },
  lessonRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 60, paddingVertical: spacing.md },
  rowDivider: { height: 1, backgroundColor: colors.border },
  lessonDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonDotDone: { backgroundColor: colors.successSoft, borderColor: colors.success },
  lessonDotText: { ...typography.micro, color: colors.textMuted, fontSize: 10 },
  lessonTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  lessonGoal: { ...typography.micro, color: colors.textFaint, marginTop: 2, fontSize: 9, letterSpacing: 0.2, fontWeight: '500', lineHeight: 14 },
  lessonScore: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  lessonScoreDone: { color: colors.success, fontWeight: '800' },
  playDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseList: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    ...shadows.card,
  },
  phraseRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  phrasePlay: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseTarget: { ...typography.bodyStrong, color: colors.text, fontSize: 15 },
  phraseEnglish: { ...typography.caption, color: colors.textMuted, marginTop: 1, fontSize: 12 },
  scenarioRail: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  scenarioCard: {
    width: 160,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  scenarioEmoji: { fontSize: 24 },
  scenarioTitle: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm, fontSize: 13 },
  scenarioMeta: { ...typography.micro, color: colors.accent, marginTop: 4, fontSize: 9 },
  footerNote: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
});
