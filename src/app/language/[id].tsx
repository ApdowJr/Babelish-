import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { getLanguage, languageStatus } from '@/data/languages';
import { usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { isChapterUnlocked, loadCurriculum } from '@/lib/curriculum/store';
import type { Chapter } from '@/lib/curriculum/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function LanguageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = getLanguage(String(id));
  const { targetLanguageId, setTargetLanguage } = usePreferences();
  const isCurrent = language.id === targetLanguageId;

  const { progress } = useLearning();
  const [data, setData] = useState<{ languageId: string; chapters: Chapter[] } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Result is keyed by language — the render pass derives "loaded" from the
    // key, so the effect body never sets state synchronously.
    loadCurriculum(language.id)
      .then((loaded) => {
        if (!cancelled) setData({ languageId: language.id, chapters: loaded });
      })
      .catch(() => {
        // stays null → rendered as "no chapters yet"
      });
    return () => {
      cancelled = true;
    };
  }, [language.id]);

  const chaptersLoaded = data?.languageId === language.id;
  const chapters = chaptersLoaded ? data.chapters : [];
  // Collapse is stored as '' so the first chapter can be collapsed too;
  // stale ids from another language simply fall back to the first chapter.
  const expandedIdEffective =
    expandedId === ''
      ? null
      : expandedId !== null && chapters.some((chapter) => chapter.id === expandedId)
        ? expandedId
        : (chapters[0]?.id ?? null);

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.flag}>{language.flag}</Text>
        <Text style={styles.name}>{language.name}</Text>
        <Text style={styles.native}>{language.nativeName}</Text>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>
            {languageStatus(language.id) === 'beta'
              ? 'BETA — weekly reviewed updates'
              : 'PREVIEW — sampler chapter'}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{language.nativeSpeakers}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="text-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{language.script}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.blurb}>{language.blurb}</Text>

      <Text style={styles.sectionLabel}>DIALECTS WE TEACH</Text>
      <View style={styles.chipsWrap}>
        {language.dialects.map((dialect) => (
          <Chip key={dialect} label={dialect} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>CHAPTERS · CEFR A1</Text>
      {!chaptersLoaded ? (
        <View style={styles.chapterLoading}>
          <ActivityIndicator color={colors.primarySoft} />
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
          const pct = chapter.lessons.length
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
                  <Text
                    style={[styles.chapterTitle, !unlocked && styles.chapterTitleLocked]}
                    numberOfLines={1}
                  >
                    {chapter.title}
                  </Text>
                  <Text style={styles.chapterDesc} numberOfLines={2}>
                    {unlocked
                      ? chapter.description
                      : 'Score 70%+ on the previous chapter to unlock'}
                  </Text>
                  {unlocked && doneCount > 0 ? (
                    <View style={styles.chapterProgressRow}>
                      <View style={styles.chapterProgressTrack}>
                        <View style={[styles.chapterProgressFill, { width: `${pct}%` }]} />
                      </View>
                      <Text style={styles.chapterProgressText}>{pct}%</Text>
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
                          onPress={() =>
                            router.push({
                              pathname: '/lesson/[id]',
                              params: { id: lesson.id, lang: language.id },
                            })
                          }
                          style={styles.lessonRow}
                          accessibilityRole="button"
                        >
                          <View style={[styles.lessonDot, mastered && styles.lessonDotDone]}>
                            <Text
                              style={[styles.lessonDotText, mastered && styles.lessonDotTextDone]}
                            >
                              {mastered ? '✓' : lessonIndex + 1}
                            </Text>
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
                            <Ionicons name="play-circle-outline" size={24} color={colors.accent} />
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

      <Text style={styles.sectionLabel}>REAL-LIFE SCENARIOS</Text>
      <View style={styles.group}>
        {language.scenarios.map((scenario, index) => (
          <View key={scenario.id}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            <View style={styles.scenarioRow}>
              <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
              <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            </View>
          </View>
        ))}
      </View>

      <Button
        label={isCurrent ? `Continue speaking ${language.name}` : `Start speaking ${language.name}`}
        onPress={() => {
          setTargetLanguage(language.id);
          router.push('/speak');
        }}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { alignItems: 'center', marginTop: spacing.lg },
  flag: { fontSize: 64 },
  statusChip: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginTop: spacing.sm,
  },
  statusChipText: { ...typography.micro, color: colors.accent, fontWeight: '600' as const },
  name: { ...typography.display, color: colors.text, marginTop: spacing.md },
  native: { ...typography.heading, color: colors.textMuted, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metaPill: {
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
  metaText: { ...typography.caption, color: colors.textMuted },
  blurb: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    paddingVertical: spacing.md,
  },
  scenarioEmoji: { fontSize: 22 },
  scenarioTitle: { ...typography.body, color: colors.text },
  rowDivider: { height: 1, backgroundColor: colors.border },
  chapterLoading: { paddingVertical: spacing.xl, alignItems: 'center' },
  chapterCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  chapterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  chapterBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chapterBadgeLocked: { backgroundColor: colors.surfaceHigh },
  chapterNum: { ...typography.bodyStrong, color: colors.primary },
  chapterTitle: { ...typography.bodyStrong, color: colors.text },
  chapterTitleLocked: { color: colors.textFaint },
  chapterDesc: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  chapterProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  chapterProgressTrack: {
    flex: 1,
    height: 5,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  chapterProgressFill: { height: '100%', backgroundColor: colors.success, borderRadius: radii.pill },
  chapterProgressText: { ...typography.micro, color: colors.success },
  lessonList: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 60,
    paddingVertical: spacing.md,
  },
  lessonDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lessonDotDone: { backgroundColor: colors.successSoft, borderColor: colors.success },
  lessonDotText: { ...typography.micro, color: colors.textMuted },
  lessonDotTextDone: { color: colors.success, fontSize: 13 },
  lessonTitle: { ...typography.body, color: colors.text, fontWeight: '600' },
  lessonGoal: { ...typography.micro, color: colors.textFaint, marginTop: 2 },
  lessonScore: { ...typography.caption, color: colors.textMuted },
  lessonScoreDone: { color: colors.success, fontWeight: '700' },
  comingSoon: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
