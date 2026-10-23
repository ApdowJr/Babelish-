import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { Pill } from '@/components/Pill';
import { useAnalytics } from '@/state/analytics';
import { useLearning } from '@/state/learning';
import { usePreferences } from '@/state/preferences';
import { getLanguage } from '@/data/languages';
import { speakNative } from '@/lib/ai';
import { weakestSkill, type Skill } from '@/lib/analytics';
import {
  describeBox,
  dueWords,
  groupByLanguage,
  isTypedAnswerCorrect,
  summarizeSession,
} from '@/lib/review';
import type { VocabItem } from '@/lib/curriculum/types';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

type Mode = 'flashcards' | 'quiz';

const MODES: { value: Mode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'flashcards', label: 'Flashcards', icon: 'albums-outline' },
  { value: 'quiz', label: 'Quiz', icon: 'create-outline' },
];

const SKILL_LABEL: Record<Skill, string> = {
  read: 'reading',
  listen: 'listening',
  write: 'writing',
  speak: 'speaking',
};

export default function ReviewScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { vocab, ready, reviewWord, wordsMastered } = useLearning();
  const { state: analytics, logEvent } = useAnalytics();
  const { targetLanguageId } = usePreferences();

  // Snapshot the due queue ONCE when the store is ready — recomputing it as
  // words leave the due set would shift the index mid-review. The snapshot is
  // taken in a deferred task so nothing is set synchronously in the effect
  // body (react-hooks/set-state-in-effect).
  const [queue, setQueue] = useState<VocabItem[] | null>(null);
  useEffect(() => {
    if (!ready || queue !== null) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setQueue(dueWords(vocab));
    });
    return () => {
      cancelled = true;
    };
  }, [ready, vocab, queue]);

  const [mode, setMode] = useState<Mode>('flashcards');
  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [revealed, setRevealed] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const item = queue?.[index];
  const weak = weakestSkill(analytics);
  const weakLabel = weak ? SKILL_LABEL[weak] : null;

  const byLanguage = useMemo(() => groupByLanguage(queue ?? []), [queue]);
  const summary = summarizeSession(correctCount, queue?.length ?? 0);
  const focusLanguageId = byLanguage[0]?.languageId ?? targetLanguageId;
  const focusLanguage = getLanguage(focusLanguageId);

  function grade(correct: boolean) {
    if (!item) return;
    if (correct) setCorrectCount((count) => count + 1);
    void reviewWord(item.itemKey, correct);
    advance();
  }

  function check() {
    if (!item || answered !== null || typed.trim().length === 0) return;
    const correct = isTypedAnswerCorrect(typed, item.target);
    setAnswered(correct);
    if (correct) setCorrectCount((count) => count + 1);
    void reviewWord(item.itemKey, correct);
  }

  function advance() {
    if (!queue || index >= queue.length - 1) {
      if (queue && queue.length > 0 && !done) {
        logEvent('review_completed');
      }
      setDone(true);
      return;
    }
    setIndex((current) => current + 1);
    setTyped('');
    setAnswered(null);
    setRevealed(false);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setTyped('');
    setAnswered(null);
    setRevealed(false);
  }

  /* ── Empty / completion states ─────────────────────────────────────── */

  if (queue !== null && (done || queue.length === 0)) {
    const empty = queue.length === 0 && !done;
    return (
      <Screen scroll>
        <View style={styles.stateWrap}>
          <Text style={styles.stateEmoji}>{empty ? '🎉' : '⭐'}</Text>
          <Text style={styles.stateTitle}>{empty ? 'All caught up!' : 'Review complete!'}</Text>
          <Text style={styles.stateBody}>
            {empty
              ? `No words are due right now. ${wordsMastered} word${wordsMastered === 1 ? '' : 's'} already mastered — missed words from lessons land here automatically.`
              : `You reviewed ${summary.total} word${summary.total === 1 ? '' : 's'} and got ${summary.correct} right (${Math.round(summary.accuracy * 100)}%). Each correct answer pushes the word a box further out.`}
          </Text>

          <View style={styles.statRow}>
            <StatTile
              icon="checkmark-done"
              value={correctCount}
              label="CORRECT"
              tint={colors.success}
              tintSoft={colors.successSoft}
            />
            <StatTile
              icon="refresh"
              value={summary.incorrect}
              label="TO REVISIT"
              tint={colors.accentInk}
            />
            <StatTile icon="book" value={wordsMastered} label="MASTERED" tint={colors.lilacInk} />
          </View>

          {weakLabel ? (
            <View style={styles.recommendation}>
              <Ionicons name="compass-outline" size={18} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.recommendTitle}>
                  Weakest skill: {weakLabel}
                </Text>
                <Text style={styles.recommendBody}>
                  Based on your last answers, {weakLabel} needs the most practice. Try a lesson or a
                  short conversation to balance it out.
                </Text>
              </View>
            </View>
          ) : null}

          <Button
            label={weak ? `Practise ${weakLabel}` : 'Browse lessons'}
            onPress={() => {
              if (weak === 'speak') router.push('/speak');
              else router.push('/learn');
            }}
            style={{ alignSelf: 'stretch', marginTop: spacing.lg }}
          />
          <Button
            label="Back to Words"
            variant="secondary"
            onPress={() => router.back()}
            style={{ alignSelf: 'stretch', marginTop: spacing.md }}
          />
        </View>
      </Screen>
    );
  }

  if (!item || !queue) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </Screen>
    );
  }

  const language = getLanguage(item.languageId);
  // Read box state live from the store — reviewWord() replaces this entry
  // when answered, and the snapshotted `item` would show a stale box.
  const shown = vocab[item.itemKey] ?? item;

  /* ── Active review ─────────────────────────────────────────────────── */

  return (
    <Screen scroll>
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(6, ((index + (answered !== null || revealed ? 1 : 0)) / queue.length) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {index + 1} / {queue.length}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <Pill label={`${queue.length} DUE`} tone="sky" icon="time-outline" />
        <Pill label={`BOX ${shown.box} OF 5`} tone="muted" />
        {weakLabel ? <Pill label={`FOCUS · ${weakLabel.toUpperCase()}`} tone="lilac" /> : null}
      </View>

      <SegmentedControl options={MODES} value={mode} onChange={switchMode} />

      {mode === 'flashcards' ? (
        <Pressable
          style={styles.card}
          onPress={() => setRevealed(true)}
          accessibilityRole="button"
          accessibilityLabel={revealed ? undefined : 'Reveal the answer'}
        >
          <Text style={styles.cardLabel}>
            {language.flag} {language.name.toUpperCase()} · FLASHCARD
          </Text>
          <Text style={styles.translation}>{item.translation}</Text>
          {revealed ? (
            <>
              <View style={styles.divider} />
              <Text
                style={[styles.flashTarget, language.direction === 'rtl' && styles.rtl]}
              >
                {item.target}
              </Text>
              <Pressable
                onPress={() => speakNative(item.target, language.ttsLocale)}
                style={styles.listenRow}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Hear the answer"
              >
                <Ionicons name="volume-medium-outline" size={17} color={colors.accentInk} />
                <Text style={styles.listenLabel}>Hear it</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.cardHint}>Tap the card to reveal the {language.name} word.</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>
            {language.flag} {language.name.toUpperCase()} · QUIZ
          </Text>
          <Text style={styles.translation}>{item.translation}</Text>
          <Text style={styles.cardHint}>Type it in {language.name}:</Text>

          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            editable={answered === null}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="Your answer…"
            placeholderTextColor={colors.textFaint}
            returnKeyType="done"
            onSubmitEditing={check}
            accessibilityLabel="Your answer"
          />

          {answered !== null ? (
            <View style={[styles.result, answered ? styles.resultGood : styles.resultBad]}>
              <Ionicons
                name={answered ? 'checkmark-circle' : 'close-circle'}
                size={20}
                color={answered ? colors.success : colors.danger}
              />
              <View style={styles.flex}>
                <Text style={[styles.resultText, { color: answered ? colors.success : colors.danger }]}>
                  {answered ? 'Correct — box up!' : `It was “${item.target}”`}
                </Text>
                <Text style={styles.resultSub}>
                  {answered
                    ? `Next review ${describeBox(shown.box)}. Spaced repetition keeps it in memory.`
                    : 'Back to box 1 — this word comes back tomorrow so the mistake sticks.'}
                </Text>
              </View>
              <Pressable
                onPress={() => speakNative(item.target, language.ttsLocale)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={`Hear ${item.target}`}
              >
                <Ionicons name="volume-medium-outline" size={24} color={colors.accentInk} />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      {mode === 'flashcards' ? (
        revealed ? (
          <View style={styles.gradeRow}>
            <Button
              label="Again"
              variant="secondary"
              onPress={() => grade(false)}
              style={styles.gradeButton}
            />
            <Button label="Got it" onPress={() => grade(true)} style={styles.gradeButton} />
          </View>
        ) : (
          <Button
            label="Show answer"
            onPress={() => setRevealed(true)}
            style={{ marginTop: spacing.lg }}
          />
        )
      ) : (
        <Button
          label={
            answered === null ? 'Check' : index >= queue.length - 1 ? 'Finish review' : 'Next word'
          }
          onPress={answered === null ? check : advance}
          disabled={answered === null && typed.trim().length === 0}
          style={{ marginTop: spacing.lg }}
        />
      )}

      {mode === 'flashcards' && revealed ? (
        <Pressable
          onPress={() => speakNative(item.target, language.ttsLocale, 0.55)}
          style={styles.slowRow}
          accessibilityRole="button"
        >
          <Text style={styles.slowText}>🐢 Hear it slowly</Text>
        </Pressable>
      ) : null}

      <View style={styles.boxRow}>
        {[1, 2, 3, 4, 5].map((box) => (
          <View
            key={box}
            style={[styles.boxDot, box <= shown.box ? styles.boxDotOn : styles.boxDotOff]}
          />
        ))}
        <Text style={styles.boxLabel}>box {shown.box} of 5</Text>
      </View>

      <Text style={styles.focusHint}>
        Due words from {focusLanguage.name} ·{' '}
        {byLanguage[0]?.count ?? 0} of {queue.length} cards
      </Text>
    </Screen>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stateWrap: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.sm },
  stateEmoji: { fontSize: 64 },
  stateTitle: { ...typography.title, color: c.text, marginTop: spacing.lg },
  stateBody: {
    ...typography.body,
    color: c.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl, alignSelf: 'stretch' },
  recommendation: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: c.primaryTint,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
  recommendTitle: { ...typography.bodyStrong, color: c.text, textTransform: 'capitalize' },
  recommendBody: { ...typography.caption, color: c.textMuted, marginTop: 2, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: c.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: c.accentInk, borderRadius: radii.pill },
  progressLabel: { ...typography.micro, color: c.textFaint },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.md,
  },
  cardLabel: { ...typography.micro, color: c.textFaint },
  translation: { ...typography.display, color: c.text, marginTop: spacing.md },
  cardHint: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs },
  divider: { height: 1, backgroundColor: c.border, marginVertical: spacing.lg },
  flashTarget: { ...typography.title, color: c.primary },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm },
  listenLabel: { ...typography.caption, color: c.accent, fontWeight: '600' },
  input: {
    ...typography.body,
    color: c.text,
    backgroundColor: c.surfaceHigh,
    borderWidth: 1.5,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 54,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  resultGood: { backgroundColor: c.successSoft },
  resultBad: { backgroundColor: c.dangerSoft },
  resultText: { ...typography.bodyStrong },
  resultSub: { ...typography.micro, color: c.textMuted, marginTop: 2 },
  gradeRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  gradeButton: { flex: 1 },
  slowRow: { alignSelf: 'center', marginTop: spacing.md },
  slowText: { ...typography.caption, color: c.textMuted },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: spacing.lg,
  },
  boxDot: { width: 10, height: 10, borderRadius: 5 },
  boxDotOn: { backgroundColor: c.primary },
  boxDotOff: { backgroundColor: c.surfaceHigh },
  boxLabel: { ...typography.micro, color: c.textFaint, marginLeft: spacing.xs },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  focusHint: {
    ...typography.caption,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.xxl,
  },
});
