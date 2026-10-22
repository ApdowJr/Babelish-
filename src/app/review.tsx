import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAnalytics } from '@/state/analytics';
import { useLearning } from '@/state/learning';
import { getLanguage } from '@/data/languages';
import { speakNative } from '@/lib/ai';
import type { VocabItem } from '@/lib/curriculum/types';
import { colors, radii, spacing, typography } from '@/theme/tokens';

/** Same lenient matching as the lesson player. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?¡¿;:„"'`]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export default function ReviewScreen() {
  const { vocab, ready, reviewWord, wordsMastered } = useLearning();
  const { logEvent } = useAnalytics();

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
      setQueue(
        Object.values(vocab)
          .filter((item) => new Date(item.dueAt).getTime() <= Date.now())
          .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
      );
    });
    return () => {
      cancelled = true;
    };
  }, [ready, vocab, queue]);

  const [index, setIndex] = useState(0);
  const [typed, setTyped] = useState('');
  const [answered, setAnswered] = useState<null | boolean>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const item = queue?.[index];

  function check() {
    if (!item || answered !== null || typed.trim().length === 0) return;
    const correct = normalize(typed) === normalize(item.target);
    setAnswered(correct);
    if (correct) setCorrectCount((c) => c + 1);
    void reviewWord(item.itemKey, correct);
  }

  function next() {
    if (!queue || index >= queue.length - 1) {
      setDone(true);
      // Finishing a session counts as activity (streaks) and earns review XP.
      logEvent('review_completed');
      return;
    }
    setIndex((i) => i + 1);
    setTyped('');
    setAnswered(null);
  }

  /* ── Empty / completion states ─────────────────────────────────────── */

  if (queue !== null && (done || queue.length === 0)) {
    return (
      <Screen scroll>
        <View style={styles.stateWrap}>
          <Text style={styles.stateEmoji}>{queue.length === 0 && !done ? '🎉' : '⭐'}</Text>
          <Text style={styles.stateTitle}>
            {queue.length === 0 && !done ? 'All caught up!' : 'Review complete!'}
          </Text>
          <Text style={styles.stateBody}>
            {queue.length === 0 && !done
              ? `No words are due right now. ${wordsMastered} word${wordsMastered === 1 ? '' : 's'} already mastered — missed words from lessons land here automatically.`
              : `You reviewed ${queue.length} word${queue.length === 1 ? '' : 's'} and got ${correctCount} right. Come back tomorrow — each correct answer pushes the word a box further out.`}
          </Text>
          <Button
            label="Back home"
            variant="secondary"
            onPress={() => router.back()}
            style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
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
              { width: `${Math.max(6, ((index + (answered !== null ? 1 : 0)) / queue.length) * 100)}%` },
            ]}
          />
        </View>
        <Text style={styles.progressLabel}>
          {index + 1} / {queue.length}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>REVIEW · {language.flag} {language.name.toUpperCase()}</Text>
        <Text style={styles.translation}>{item.translation}</Text>
        <Text style={styles.cardHint}>Say it or type it in {language.name}:</Text>

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
                  ? `Next review in ${describeBox(shown.box)}`
                  : 'Back to box 1 — you’ll see it again tomorrow.'}
              </Text>
            </View>
            <Pressable
              onPress={() => speakNative(item.target, language.ttsLocale)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Hear ${item.target}`}
            >
              <Ionicons name="volume-medium-outline" size={24} color={colors.accent} />
            </Pressable>
          </View>
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
      </View>

      <Button
        label={answered === null ? 'Check' : index >= queue.length - 1 ? 'Finish review' : 'Next word'}
        onPress={answered === null ? check : next}
        disabled={answered === null && typed.trim().length === 0}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

function describeBox(box: number): string {
  const days = [1, 2, 4, 8, 15][Math.min(box, 5) - 1] ?? 1;
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stateWrap: { alignItems: 'center', paddingTop: spacing.xxxl, paddingHorizontal: spacing.sm },
  stateEmoji: { fontSize: 64 },
  stateTitle: { ...typography.title, color: colors.text, marginTop: spacing.lg },
  stateBody: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.accent, borderRadius: radii.pill },
  progressLabel: { ...typography.micro, color: colors.textFaint },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
  cardLabel: { ...typography.micro, color: colors.textFaint },
  translation: { ...typography.display, color: colors.text, marginTop: spacing.md },
  cardHint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1.5,
    borderColor: colors.border,
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
  resultGood: { backgroundColor: colors.successSoft },
  resultBad: { backgroundColor: colors.dangerSoft },
  resultText: { ...typography.bodyStrong },
  resultSub: { ...typography.micro, color: colors.textMuted, marginTop: 2 },
  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
  },
  boxDot: { width: 10, height: 10, borderRadius: 5 },
  boxDotOn: { backgroundColor: colors.primary },
  boxDotOff: { backgroundColor: colors.surfaceHigh },
  boxLabel: { ...typography.micro, color: colors.textFaint, marginLeft: spacing.xs },
});
