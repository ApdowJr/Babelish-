import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '@/components/Button';
import { findLesson, loadCurriculum } from '@/lib/curriculum/store';
import type { Exercise, Lesson, VocabSeed } from '@/lib/curriculum/types';
import { getLanguage } from '@/data/languages';
import { speakNative, stopSpeaking } from '@/lib/ai';
import { useLearning } from '@/state/learning';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/** Lenient matching: accents, case, punctuation, and spacing don't block you. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?¡¿;:„"'`]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

type StepResult = { correct: boolean; vocab?: VocabSeed };

export default function LessonScreen() {
  const params = useLocalSearchParams<{ id: string; lang: string }>();
  const lessonId = String(params.id);
  const languageId = String(params.lang);
  const language = getLanguage(languageId);

  const { progress, recordLesson } = useLearning();

  const [data, setData] = useState<{
    key: string;
    lesson: Lesson | null;
    nextLessonId: string | null;
  } | null>(null);

  const [step, setStep] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<null | boolean>(null); // null = unanswered
  const [showHint, setShowHint] = useState(false);
  const [results, setResults] = useState<StepResult[]>([]);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState<{ score: number; xpEarned: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Loaded state is keyed by route params, so the effect body never resets
    // anything synchronously (react-hooks/set-state-in-effect).
    const key = `${languageId}:${lessonId}`;
    (async () => {
      const found = await findLesson(languageId, lessonId).catch(() => null);
      if (cancelled) return;
      if (!found) {
        setData({ key, lesson: null, nextLessonId: null });
        return;
      }
      const chapters = await loadCurriculum(languageId).catch(() => []);
      if (cancelled) return;
      const flat = chapters.flatMap((chapter) => chapter.lessons);
      const index = flat.findIndex((item) => item.id === lessonId);
      const nextId = index >= 0 && index < flat.length - 1 ? flat[index + 1].id : null;
      setData({ key, lesson: found, nextLessonId: nextId });
    })();
    return () => {
      cancelled = true;
      stopSpeaking();
    };
  }, [languageId, lessonId]);

  const routeKey = `${languageId}:${lessonId}`;
  const loaded = data?.key === routeKey;
  const lesson = loaded && data ? data.lesson : null;
  const nextLessonId = loaded && data ? data.nextLessonId : null;
  const loadState: 'loading' | 'ready' | 'missing' = !loaded
    ? 'loading'
    : lesson
      ? 'ready'
      : 'missing';

  const exercise: Exercise | undefined = lesson?.exercises[step];
  const isLast = lesson ? step >= lesson.exercises.length - 1 : false;

  // Native voice reads listen-exercises aloud, automatically.
  useEffect(() => {
    if (exercise?.type === 'listen' && !answered) {
      speakNative(exercise.question, language.ttsLocale);
    }
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, exercise?.type]);

  function checkAnswer() {
    if (!exercise || answered !== null) return;
    let correct = false;
    if (exercise.type === 'choose' || exercise.type === 'listen') {
      correct = selected !== null && exercise.answer.includes(selected);
    } else if (exercise.type === 'type') {
      const attempt = normalize(typed);
      correct = attempt.length > 0 && exercise.answer.some((a) => normalize(a) === attempt);
    }
    setAnswered(correct);
    if (!correct) setShowHint(true);
  }

  function advance() {
    if (!lesson || !exercise || answered === null) return;
    const playable = exercise.type !== 'speak';
    const entry: StepResult | null =
      playable && exercise.vocab
        ? { correct: Boolean(answered), vocab: answered ? undefined : exercise.vocab }
        : playable
          ? { correct: Boolean(answered) }
          : null;

    const nextResults = entry ? [...results, entry] : results;
    setResults(nextResults);

    setSelected(null);
    setTyped('');
    setAnswered(null);
    setShowHint(false);

    if (isLast) {
      void finish(nextResults);
      return;
    }
    setStep((s) => s + 1);
  }

  async function finish(finalResults: StepResult[]) {
    if (!lesson || finishing) return;
    setFinishing(true);
    stopSpeaking();
    const correct = finalResults.filter((r) => r.correct).length;
    const playable = finalResults.length;
    const missed = finalResults
      .filter((r) => !r.correct && r.vocab)
      .map((r) => r.vocab as VocabSeed);
    try {
      const result = await recordLesson({
        lessonId: lesson.id,
        languageId,
        correct,
        playable,
        missed,
        firstCompletion: progress[lesson.id] === undefined,
      });
      setSummary(result);
    } catch {
      setSummary({ score: playable ? Math.round((correct / playable) * 100) : 100, xpEarned: correct * 10 });
    } finally {
      setFinishing(false);
    }
  }

  /* ── Loading / missing ─────────────────────────────────────────────── */

  if (loadState === 'loading') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primarySoft} />
        </View>
      </SafeAreaView>
    );
  }

  if (loadState === 'missing' || !lesson) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.missingText}>Lesson not found.</Text>
          <Button label="Go back" variant="secondary" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  /* ── Completion ────────────────────────────────────────────────────── */

  if (summary) {
    const missed = results.filter((r) => !r.correct && r.vocab);
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.completeWrap}>
          <Text style={styles.completeEmoji}>{summary.score >= 90 ? '🏆' : summary.score >= 70 ? '🎉' : '💪'}</Text>
          <Text style={styles.completeTitle}>
            {summary.score >= 70 ? 'Lesson complete!' : 'Good practice!'}
          </Text>
          <Text style={styles.completeScore}>{summary.score}% correct</Text>

          <LinearGradient
            colors={[colors.gradientFrom, colors.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.xpBadge}
          >
            <Ionicons name="star" size={16} color={colors.white} />
            <Text style={styles.xpText}>+{summary.xpEarned} XP</Text>
          </LinearGradient>

          {missed.length > 0 ? (
            <View style={styles.missedCard}>
              <Text style={styles.missedTitle}>Added to your review queue:</Text>
              {missed.map((entry, index) => (
                <View key={index} style={styles.missedRow}>
                  <View style={styles.flex}>
                    <Text style={styles.missedTarget}>{entry.vocab!.target}</Text>
                    <Text style={styles.missedTranslation}>{entry.vocab!.translation}</Text>
                  </View>
                  <Pressable
                    onPress={() => speakNative(entry.vocab!.target, language.ttsLocale)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Hear ${entry.vocab!.target}`}
                  >
                    <Ionicons name="volume-medium-outline" size={20} color={colors.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.perfectText}>Perfect run — nothing to review. 🌟</Text>
          )}

          {nextLessonId ? (
            <Button
              label="Next lesson"
              onPress={() =>
                router.replace({ pathname: '/lesson/[id]', params: { id: nextLessonId, lang: languageId } })
              }
              style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
            />
          ) : null}
          <Button
            label="Back to chapters"
            variant="secondary"
            onPress={() => router.back()}
            style={{ alignSelf: 'stretch', marginTop: spacing.md }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  /* ── Player ────────────────────────────────────────────────────────── */

  if (!exercise) return null;

  const total = lesson.exercises.length;
  const progressRatio = (step + (answered !== null ? 1 : 0)) / total;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close lesson">
          <Ionicons name="close" size={24} color={colors.textMuted} />
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.max(4, progressRatio * 100)}%` }]} />
        </View>
        <View style={styles.scoreChip}>
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
          <Text style={styles.scoreText}>{results.filter((r) => r.correct).length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.lessonMeta}>{lesson.title} · {step + 1} of {total}</Text>
        <Text style={styles.prompt}>{exercise.prompt}</Text>

        {exercise.type === 'speak' ? (
          <View style={styles.lockedCard}>
            <View style={styles.lockedIcon}>
              <Ionicons name="mic-off-outline" size={28} color={colors.warning} />
            </View>
            <Text style={styles.lockedTitle}>Speaking practice</Text>
            <Text style={styles.lockedText}>
              “{exercise.question}” — pronunciation scoring arrives in Phase 2 with speech
              recognition. For now, say it out loud on your own!
            </Text>
          </View>
        ) : exercise.type === 'type' ? (
          <View>
            <Text style={styles.question}>{exercise.question}</Text>
            <TextInput
              style={styles.typeInput}
              value={typed}
              onChangeText={setTyped}
              editable={answered === null}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Type your answer…"
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
              onSubmitEditing={checkAnswer}
              accessibilityLabel="Your answer"
            />
          </View>
        ) : exercise.type === 'listen' ? (
          <View>
            <Pressable
              onPress={() => speakNative(exercise.question, language.ttsLocale)}
              style={styles.listenCard}
              accessibilityRole="button"
              accessibilityLabel="Play audio again"
            >
              <LinearGradient
                colors={[colors.gradientFrom, colors.gradientTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.listenCircle}
              >
                <Ionicons name="volume-high" size={34} color={colors.white} />
              </LinearGradient>
              <Text style={styles.listenHint}>Tap to listen again</Text>
            </Pressable>
            <Text style={styles.optionsLabel}>What did you hear?</Text>
          </View>
        ) : (
          <Text style={styles.questionBig}>{exercise.question}</Text>
        )}

        {(exercise.type === 'choose' || exercise.type === 'listen') && exercise.options ? (
          <View style={styles.options}>
            {exercise.options.map((option) => {
              const isCorrectOption = exercise.answer.includes(option);
              const isChosen = selected === option;
              const state =
                answered === null
                  ? 'idle'
                  : isCorrectOption
                    ? 'correct'
                    : isChosen
                      ? 'wrong'
                      : 'dim';
              return (
                <Pressable
                  key={option}
                  disabled={answered !== null}
                  onPress={() => setSelected(option)}
                  style={[
                    styles.option,
                    state === 'idle' && styles.optionIdle,
                    state === 'correct' && styles.optionCorrect,
                    state === 'wrong' && styles.optionWrong,
                    state === 'dim' && styles.optionDim,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isChosen }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      state === 'correct' && styles.optionTextCorrect,
                      state === 'wrong' && styles.optionTextWrong,
                    ]}
                  >
                    {option}
                  </Text>
                  {state === 'correct' ? (
                    <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                  ) : state === 'wrong' ? (
                    <Ionicons name="close-circle" size={18} color={colors.danger} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {answered !== null && exercise.type === 'type' ? (
          <View style={[styles.feedback, answered ? styles.feedbackGood : styles.feedbackBad]}>
            <Ionicons
              name={answered ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={answered ? colors.success : colors.danger}
            />
            <View style={styles.flex}>
              <Text style={[styles.feedbackTitle, { color: answered ? colors.success : colors.danger }]}>
                {answered ? 'Correct' : `Answer: ${exercise.answer[0]}`}
              </Text>
            </View>
          </View>
        ) : answered !== null && exercise.type !== 'speak' ? (
          <View style={[styles.feedback, answered ? styles.feedbackGood : styles.feedbackBad]}>
            <Ionicons
              name={answered ? 'checkmark-circle' : 'close-circle'}
              size={18}
              color={answered ? colors.success : colors.danger}
            />
            <Text style={[styles.feedbackTitle, { color: answered ? colors.success : colors.danger }]}>
              {answered ? 'Correct!' : 'Not quite'}
            </Text>
          </View>
        ) : null}

        {!answered && showHint && exercise.hint ? (
          <View style={styles.hintBox}>
            <Ionicons name="bulb-outline" size={16} color={colors.warning} />
            <Text style={styles.hintText}>{exercise.hint}</Text>
          </View>
        ) : null}

        {answered !== null && exercise.note ? (
          <View style={styles.noteBox}>
            <Ionicons name="book-outline" size={16} color={colors.accent} />
            <Text style={styles.noteText}>{exercise.note}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {finishing ? (
          <ActivityIndicator color={colors.primarySoft} />
        ) : answered === null && exercise.type !== 'speak' ? (
          <Button
            label="Check"
            onPress={checkAnswer}
            disabled={
              exercise.type === 'type'
                ? typed.trim().length === 0
                : selected === null
            }
          />
        ) : exercise.type === 'speak' ? (
          <Button label={isLast ? 'Finish lesson' : 'Continue'} onPress={advance} />
        ) : (
          <Button label={isLast ? 'Finish lesson' : 'Continue'} onPress={advance} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  missingText: { ...typography.body, color: colors.textMuted },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  scoreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  scoreText: { ...typography.micro, color: colors.success },
  body: { padding: spacing.xl, paddingBottom: spacing.xxxl },
  lessonMeta: { ...typography.micro, color: colors.textFaint, textTransform: 'uppercase' },
  prompt: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  question: { ...typography.heading, color: colors.text, marginTop: spacing.lg, fontSize: 22, lineHeight: 30 },
  questionBig: {
    ...typography.title,
    color: colors.text,
    marginTop: spacing.lg,
    fontSize: 28,
    textAlign: 'center',
    lineHeight: 36,
  },
  optionsLabel: { ...typography.caption, color: colors.textMuted, marginTop: spacing.lg, marginBottom: spacing.sm },
  options: { gap: spacing.sm, marginTop: spacing.xl },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 54,
    borderRadius: radii.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  optionIdle: { backgroundColor: colors.surface, borderColor: colors.border },
  optionCorrect: { backgroundColor: colors.successSoft, borderColor: colors.success },
  optionWrong: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  optionDim: { backgroundColor: colors.surface, borderColor: colors.border, opacity: 0.5 },
  optionText: { ...typography.body, color: colors.text, flex: 1 },
  optionTextCorrect: { color: colors.success, fontWeight: '600' },
  optionTextWrong: { color: colors.danger, fontWeight: '600' },
  typeInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
  },
  listenCard: { alignItems: 'center', marginTop: spacing.xl, gap: spacing.md },
  listenCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  listenHint: { ...typography.caption, color: colors.textMuted },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xl,
  },
  feedbackGood: { backgroundColor: colors.successSoft },
  feedbackBad: { backgroundColor: colors.dangerSoft },
  feedbackTitle: { ...typography.bodyStrong },
  hintBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: 'rgba(255, 197, 66, 0.10)',
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  hintText: { ...typography.caption, color: colors.warning, flex: 1, lineHeight: 18 },
  noteBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  noteText: { ...typography.caption, color: colors.text, flex: 1, lineHeight: 18 },
  lockedCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  lockedIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 197, 66, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockedTitle: { ...typography.heading, color: colors.text },
  lockedText: { ...typography.caption, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  completeWrap: { padding: spacing.xl, alignItems: 'center', paddingTop: spacing.xxxl },
  completeEmoji: { fontSize: 64 },
  completeTitle: { ...typography.display, color: colors.text, marginTop: spacing.lg },
  completeScore: { ...typography.heading, color: colors.textMuted, marginTop: spacing.sm },
  xpBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.lg,
  },
  xpText: { ...typography.bodyStrong, color: colors.white },
  missedCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  missedTitle: { ...typography.bodyStrong, color: colors.text, marginBottom: spacing.md },
  missedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  missedTarget: { ...typography.bodyStrong, color: colors.text },
  missedTranslation: { ...typography.caption, color: colors.textMuted },
  perfectText: { ...typography.caption, color: colors.success, marginTop: spacing.xl },
  missingTextStyle: { ...typography.body, color: colors.textMuted },
});
