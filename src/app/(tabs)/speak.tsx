import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Chip } from '@/components/Chip';
import { useAuth } from '@/context/AuthContext';
import { usePreferences, languageName } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { getLanguage, LANGUAGES } from '@/data/languages';
import { bundledCurriculum } from '@/data/curriculum';
import { isMobileWeb, toggleSpeechTarget } from '@/lib/speech';
import { CHAR_BASED_LANGUAGES, getPracticePhrases, type PracticePhrase } from '@/data/practice';
import { suggestLevel } from '@/lib/adaptive';
import {
  fetchAiStatus,
  setSpeechErrorListener,
  speakNative,
  stopSpeaking,
  transcribeSpeech,
  tutorReply,
  type AiStatus,
  type TutorMessage,
} from '@/lib/ai';
import { loadModelSettings, saveModelSettings, useModelSettings } from '@/lib/models/settings';
import { isCancelled, QuotaExceeded } from '@/lib/models/types';
import { loadConversation, saveConversation } from '@/lib/conversationStorage';
import { ownerIdFor } from '@/lib/conversations';
import { scoreBand, scorePronunciation } from '@/lib/pronunciation';
import { showAlert } from '@/lib/alert';
import { NEON_API_URL } from '@/lib/neon';
import { loadSpeakingStats, recordPhraseAttempt, type SpeakingStats } from '@/lib/speaking';
import { ensureRecordingReady, useVoiceRecorder } from '@/lib/voice';
import { flushReportQueue, sendReport } from '@/lib/reports';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type ChatMessage = TutorMessage & {
  fromVoice?: boolean;
  tip?: string;
  runtime?: string;
  model?: string;
};

type PracticeState =
  | { phraseId: string; phase: 'recording' }
  | { phraseId: string; phase: 'scoring' }
  | { phraseId: string; phase: 'typing'; draft: string }
  | { phraseId: string; phase: 'done'; transcript: string; score: ReturnType<typeof scorePronunciation> };

/** Ink colours that stay readable on the soft chip backgrounds. */
const BAND_INK = {
  success: colors.success,
  warning: '#B07A00',
  danger: colors.danger,
} as const;

const BAND_SOFT_BG = {
  success: colors.successSoft,
  warning: 'rgba(241, 196, 15, 0.18)',
  danger: colors.dangerSoft,
} as const;

const SLOW_RATE = 0.55;

export default function SpeakScreen() {
  const { user, getAccessToken } = useAuth();
  const { targetLanguageId, nativeLanguageId, setTargetLanguage, setNativeLanguage } =
    usePreferences();
  const { settings } = useModelSettings();
  const { lessonsCompleted, progress } = useLearning();
  const { profile } = useProfile();
  const { logSpeakingScore } = useAnalytics();
  const language = getLanguage(targetLanguageId);
  // Ground the tutor in the course the learner is actually working through:
  // the first lesson they have not passed yet, or the last one they reached.
  const activeLesson = useMemo(() => {
    const chapters = bundledCurriculum(language.id);
    for (const chapter of chapters) {
      for (const lesson of chapter.lessons) {
        if ((progress[lesson.id]?.score ?? 0) < 70) return lesson;
      }
    }
    const lastChapter = chapters[chapters.length - 1];
    return lastChapter?.lessons[lastChapter.lessons.length - 1] ?? null;
  }, [language.id, progress]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [scenarioId, setScenarioId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [stats, setStats] = useState<SpeakingStats>({});
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [chatRecording, setChatRecording] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  // Spent daily budget: a dated pause, not an error. Kept separate from
  // `voiceError` because nothing went wrong and there is nothing to retry.
  const [quotaNote, setQuotaNote] = useState<string | null>(null);
  // Which line is playing right now (`msg-3`, `phrase-cafe-1`, …). One at a
  // time: starting another stops this one, so two lines never overlap.
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  // One picker for both tutor selectors: target language and explanation language.
  const [picker, setPicker] = useState<null | 'target' | 'explain'>(null);
  // A fixable voice problem (with a button that actually fixes it), as opposed
  // to `voiceError`, which is just a message.
  // Bumped by the coach strip's "Retry" action: re-probes the tutor without
  // a page reload (useful right after the server is configured).
  const [probeNonce, setProbeNonce] = useState(0);
  const [voiceHelp, setVoiceHelp] = useState<
    null | { message: string; action?: 'browser-stt' | 'open-settings' }
  >(null);
  // Server-reported AI capability (backend proxy probe) — null until the
  // first probe resolves. See voiceLive below.
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  // One in-flight turn at a time; Stop (or leaving the screen) aborts it.
  const abortRef = useRef<AbortController | null>(null);

  const recorder = useVoiceRecorder();
  const scenario = language.scenarios.find((s) => s.id === scenarioId);
  const phrases = scenario ? getPracticePhrases(language.id, scenario.id) : [];

  // Personalization: the tutor sees who the learner is + an adaptive CEFR level.
  const learnerName = profile.displayName || user?.displayName;
  const tutorProfile = {
    job: profile.job || undefined,
    interests: profile.interests,
    goals: profile.goals,
    nativeLanguageName: languageName(nativeLanguageId),
  };
  // CEFR: follow progress automatically, or honour the learner's override.
  const level = settings.level === 'auto' ? suggestLevel(lessonsCompleted) : settings.level;
  const explanationLanguage = languageName(nativeLanguageId);

  // Honest capability gates: "live" only when either transport can actually
  // serve it — the backend proxy (key lives server-side) or a direct
  // EXPO_PUBLIC_AI_* config. A null aiStatus means the probe hasn't resolved:
  // fall back to build-time knowledge, never claim live from wishful thinking.
  // null = still probing. Never claim "live" before a real probe answered.
  const voiceLive = aiStatus ? aiStatus.stt : null;
  // Voice needs both a speech model and the mic permission — two different
  // problems with two different fixes, so they are reported separately.
  // Offering a 150 MB on-device model on a phone is a bad trade, so the
  // browser fallback is only proposed on a desktop-sized browser.
  const browserSpeechPossible =
    Platform.OS === 'web' &&
    typeof WebAssembly === 'object' &&
    !isMobileWeb(typeof navigator === 'undefined' ? '' : navigator.userAgent);

  /**
   * One explanation for "the mic cannot record right now", used by both the
   * chat and the phrase practice. It never points at a settings screen.
   */
  function explainVoiceUnavailable() {
    setVoiceError(null);
    setVoiceHelp(
      browserSpeechPossible
        ? {
            message:
              'Voice input needs a speech model. You can run Whisper in this browser — about 150 MB, downloaded once and kept offline.',
            action: 'browser-stt' as const,
          }
        : {
            message:
              'Voice input isn’t available on this device yet — typing works exactly the same.',
          }
    );
  }

  /** Transport for AI calls: JWT for the backend proxy when available. */
  async function aiIo() {
    const jwt = await getAccessToken().catch(() => null);
    return jwt ? { apiBase: NEON_API_URL, jwt } : null;
  }

  // Reset the conversation when the language or scenario changes — done
  // during render (React's recommended pattern), not inside the effect.
  const conversationKey = `${language.id}:${scenarioId ?? 'free'}`;
  // Conversations are stored per account on this device: two learners sharing
  // a phone never see each other's chats, and a guest never inherits one.
  const siteOwner = ownerIdFor(user?.id ?? null);
  const [prevKey, setPrevKey] = useState(conversationKey);

  /** Best-effort save of what is on screen; storage failure is silent. */
  function persist(next: ChatMessage[]) {
    void saveConversation(siteOwner, language.id, scenarioId, next);
  }
  if (prevKey !== conversationKey) {
    // The old conversation is gone, so its pending turn must go too.
    abortRef.current?.abort();
    abortRef.current = null;
    setPrevKey(conversationKey);
    setMessages([]);
    setRevealed([]);
    setPractice(null);
    setVoiceError(null);
    setQuotaNote(null);
    setBusy(true);
  }

  // Probe the backend proxy once per mount for real AI capability, and wire
  // TTS failures into this screen's error banner (a silent dead tap is
  // exactly the "no audio" failure this audit is fixing).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const jwt = await getAccessToken().catch(() => null);
      const status = await fetchAiStatus({ apiBase: NEON_API_URL, jwt });
      if (!cancelled) setAiStatus(status);
    })();
    return () => {
      cancelled = true;
    };
    // Re-probe whenever the tutor settings change or the learner taps Retry,
    // so the strip never keeps an outdated "unavailable" claim.
  }, [getAccessToken, settings, probeNonce]);

  useEffect(() => {
    setSpeechErrorListener(setVoiceError);
    return () => setSpeechErrorListener(null);
  }, []);

  // Model settings live in an external store; load them once per mount so the
  // UI reflects a change made in Settings as soon as this screen regains focus.
  useEffect(() => {
    void loadModelSettings();
  }, []);

  // Speaking stats (best score per phrase) persist locally.
  useEffect(() => {
    let cancelled = false;
    loadSpeakingStats().then((loaded) => {
      if (!cancelled) setStats(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fresh opening line for every new conversation. Pass the same authenticated
  // backend transport as later turns; otherwise a server-only AI_API_KEY would
  // be ignored for the greeting and the screen could silently start in demo mode.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    abortRef.current = controller;
    void (async () => {
      // Restore first: a saved conversation costs no quota, works offline and
      // is what the learner expects to find after a reload.
      const stored = await loadConversation(siteOwner, language.id, scenarioId).catch(() => null);
      if (cancelled) return;
      if (stored && stored.messages.length > 0) {
        setMessages(stored.messages as ChatMessage[]);
        setBusy(false);
        if (abortRef.current === controller) abortRef.current = null;
        return;
      }
      try {
        const reply = await tutorReply(
          {
            language,
            history: [],
            learnerName,
            scenarioId: scenario?.id,
            scenarioTitle: scenario?.title,
            profile: tutorProfile,
            level,
            explanationLanguage,
            lessonId: activeLesson?.id,
            signal: controller.signal,
          },
          await aiIo()
        );
        if (!cancelled) {
          const opening: ChatMessage[] = [
            {
              role: 'assistant',
              text: reply.text,
              translation: reply.translation,
              // The opening line must carry the same label as later turns:
              // an unlabelled coach card looks like a real model reply.
              tip: reply.tip,
              runtime: reply.runtime,
              model: reply.model,
            },
          ];
          setMessages(opening);
          persist(opening);
        }
      } catch (error) {
        if (!cancelled) {
          // Stopped or unmounted: nothing to report.
          if (isCancelled(error, controller.signal)) return;
          if (error instanceof QuotaExceeded) {
            // The budget message names the reset time; printing it as a fake
            // "…" tutor turn would be both ugly and misleading.
            setQuotaNote(error.message);
            setMessages([]);
          } else {
            setMessages([
              {
                role: 'assistant',
                text: '…',
                translation:
                  error instanceof Error && error.message
                    ? error.message
                    : 'Could not reach the tutor — try again.',
              },
            ]);
          }
        }
      } finally {
        if (!cancelled) setBusy(false);
        if (abortRef.current === controller) abortRef.current = null;
      }
    })();
    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey, siteOwner]);

  async function respond(history: ChatMessage[]) {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    try {
      const reply = await tutorReply(
        {
          language,
          history,
          learnerName,
          scenarioId: scenario?.id,
          scenarioTitle: scenario?.title,
          profile: tutorProfile,
          level,
          explanationLanguage,
          lessonId: activeLesson?.id,
          signal: controller.signal,
        },
        await aiIo()
      );
      if (controller.signal.aborted) return;
      setQuotaNote(null);
      const withReply: ChatMessage[] = [
        ...history,
        {
          role: 'assistant',
          text: reply.text,
          translation: reply.translation,
          tip: reply.tip,
          runtime: reply.runtime,
          model: reply.model,
        },
      ];
      setMessages(withReply);
      persist(withReply);
    } catch (error) {
      // Stop is a choice, not a failure: no error card, no retry, and the
      // turn keeps its place in the daily budget (the model was asked).
      if (isCancelled(error, controller.signal)) return;
      // Real-mode failures surface as themselves (timeouts, wrong-script,
      // missing key) — never replaced by scripted content. A spent daily
      // budget is not a failure: it is a dated pause, shown in its own strip.
      if (error instanceof QuotaExceeded) {
        setQuotaNote(error.message);
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '…',
          translation:
            error instanceof Error && error.message
              ? error.message
              : 'Could not reach the tutor — try again.',
        },
      ]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
    }
  }

  /**
   * Plays one line, or stops it if it is already playing.
   *
   * Barge-in, honestly: the learner interrupts by tapping the mic or another
   * line — nothing listens in the background. Any new sound stops the old one
   * first, which is also what keeps two utterances from overlapping.
   */
  async function speakLine(key: string, text: string, rate = 0.92) {
    const toggle = toggleSpeechTarget(speakingKey, key);
    if (toggle.action === 'stop') {
      stopSpeaking();
      setSpeakingKey(null);
      return;
    }
    stopSpeaking();
    setSpeakingKey(toggle.next);
    try {
      await speakNative(text, language.ttsLocale, rate);
    } finally {
      setSpeakingKey((current) => (current === key ? null : current));
    }
  }

  /** Stop the turn in flight — chat or voice — without inventing a reply. */
  function stopTurn() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const history: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(history);
    persist(history);
    await respond(history);
  }

  /* ── Voice: chat turns ─────────────────────────────────────────────────── */

  async function toggleChatMic() {
    if (busy || practice?.phase === 'recording' || practice?.phase === 'scoring') {
      return;
    }
    // While start() prepares, a second tap must be able to stop that same
    // clip — only reject it when there is nothing (yet) being recorded.
    if (!chatRecording && recorder.isBusy) return;
    // No speech model: explain what would fix it instead of recording a clip
    // that cannot be transcribed (and never point to a settings screen that
    // does not exist in this build).
    if (aiStatus && !voiceLive) {
      explainVoiceUnavailable();
      return;
    }
    if (chatRecording) {
      setChatRecording(false);
      const uri = await recorder.stop();
      if (!uri) {
        setVoiceError('Nothing was captured — try again, or type your reply.');
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      setBusy(true);
      try {
        const text = await transcribeSpeech(uri, language.id, await aiIo(), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        const history: ChatMessage[] = [...messages, { role: 'user', text, fromVoice: true }];
        setMessages(history);
        persist(history);
        setBusy(false);
        await respond(history);
      } catch (error) {
        if (isCancelled(error, controller.signal)) return;
        setBusy(false);
        if (error instanceof QuotaExceeded) {
          setQuotaNote(error.message);
          return;
        }
        setVoiceError(
          error instanceof Error ? error.message : 'Voice input failed — try again or type instead.'
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    } else {
      // Barge-in: talking over the tutor is the natural way to interrupt, so
      // opening the mic stops playback first (and keeps TTS out of the take).
      stopSpeaking();
      setSpeakingKey(null);
      const mic = await ensureRecordingReady();
      if (!mic.ok) {
        setVoiceError(mic.message);
        setVoiceHelp(mic.canOpenSettings ? { message: mic.message, action: 'open-settings' } : null);
        return;
      }
      setVoiceError(null);
      setVoiceHelp(null);
      setChatRecording(true);
      try {
        await recorder.start();
      } catch {
        // Permission revoked mid-flight, no mic available, or the browser
        // refused the stream — say so instead of showing a dead recorder.
        setChatRecording(false);
        setVoiceError("Couldn't start recording — check your microphone and try again.");
      }
    }
  }

  /* ── Voice: pronunciation practice ─────────────────────────────────────── */

  function finishPractice(phrase: PracticePhrase, transcript: string) {
    const score = scorePronunciation(transcript, phrase.target, {
      charBased: CHAR_BASED_LANGUAGES.has(language.id),
    });
    setPractice({ phraseId: phrase.id, phase: 'done', transcript, score });
    logSpeakingScore(score.percent);
    void recordPhraseAttempt(stats, phrase.id, score.percent).then(setStats);
  }

  async function togglePracticeMic(phrase: PracticePhrase) {
    if (busy) return;
    if (practice?.phase === 'recording' && practice.phraseId === phrase.id) {
      setPractice({ phraseId: phrase.id, phase: 'scoring' });
      const uri = await recorder.stop();
      if (!uri) {
        setPractice(null);
        setVoiceError('Nothing was captured — try again, or type the phrase.');
        return;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const transcript = await transcribeSpeech(uri, language.id, await aiIo(), {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        finishPractice(phrase, transcript);
      } catch (error) {
        setPractice(null);
        if (isCancelled(error, controller.signal)) return;
        if (error instanceof QuotaExceeded) {
          setQuotaNote(error.message);
          return;
        }
        setVoiceError(
          error instanceof Error
            ? error.message
            : "Couldn't catch that — try again, or type the phrase instead."
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    } else {
      if (recorder.isBusy || practice?.phase === 'recording' || chatRecording) return;
      if (aiStatus && !voiceLive) {
        explainVoiceUnavailable();
        return;
      }
      // Barge-in here too: practising a phrase means speaking over the tutor.
      stopSpeaking();
      setSpeakingKey(null);
      const mic = await ensureRecordingReady();
      if (!mic.ok) {
        setVoiceError(mic.message);
        setVoiceHelp(mic.canOpenSettings ? { message: mic.message, action: 'open-settings' } : null);
        return;
      }
      setVoiceError(null);
      setVoiceHelp(null);
      setPractice({ phraseId: phrase.id, phase: 'recording' });
      try {
        await recorder.start();
      } catch {
        setPractice(null);
        setVoiceError("Couldn't start recording — check your microphone and try again.");
      }
    }
  }

  function submitTypedPractice(phrase: PracticePhrase) {
    if (practice?.phase !== 'typing' || practice.phraseId !== phrase.id) return;
    const draft = practice.draft.trim();
    if (!draft) return;
    finishPractice(phrase, draft);
  }

  // Drain reports queued while offline (or before the endpoint existed).
  useEffect(() => {
    void flushReportQueue(getAccessToken);
  }, [getAccessToken]);

  function reportMessage(item: ChatMessage) {
    showAlert('Report this message', 'What is wrong with it?', [
      { text: 'Sounds wrong', onPress: () => void submitReport('Sounds wrong', item.text) },
      {
        text: 'Wrong translation',
        onPress: () => void submitReport('Wrong translation', item.translation ?? item.text),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function submitReport(reason: string, quote: string) {
    const outcome = await sendReport(getAccessToken, {
      languageId: targetLanguageId,
      kind: 'message',
      quote,
      reason,
    });
    showAlert(
      'Thanks for the flag 🚩',
      outcome === 'sent'
        ? 'Sent to the content review queue.'
        : 'Saved on this device — it will sync automatically.'
    );
  }

  function toggleReveal(index: number) {
    setRevealed((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  }

  /* ── Practice phrase card ──────────────────────────────────────────────── */

  function renderPhrase(phrase: PracticePhrase) {
    const active = practice?.phraseId === phrase.id ? practice : null;
    const stat = stats[phrase.id];

    return (
      <View key={phrase.id} style={styles.phraseRow}>
        <Text style={styles.phraseTarget}>{phrase.target}</Text>
        <Text style={styles.phraseTranslation}>{phrase.translation}</Text>

        <View style={styles.phraseActions}>
          <Pressable
            onPress={() => void speakLine(`phrase-${phrase.id}`, phrase.target)}
            style={styles.phraseAction}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityState={{ selected: speakingKey === `phrase-${phrase.id}` }}
            accessibilityLabel={
              speakingKey === `phrase-${phrase.id}` ? 'Stop this phrase' : 'Listen to this phrase'
            }
          >
            <Ionicons
              name={speakingKey === `phrase-${phrase.id}` ? 'stop' : 'volume-medium-outline'}
              size={15}
              color={colors.accent}
            />
            <Text style={styles.phraseActionLabel}>
              {speakingKey === `phrase-${phrase.id}` ? 'Stop' : 'Listen'}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => void speakLine(`phrase-${phrase.id}-slow`, phrase.target, SLOW_RATE)}
            style={styles.phraseAction}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Listen slowly"
          >
            <Text style={styles.phraseActionLabel}>🐢 Slow</Text>
          </Pressable>
          <Pressable
            onPress={() => togglePracticeMic(phrase)}
            style={[
              styles.phraseAction,
              active?.phase === 'recording' && styles.phraseActionRecording,
            ]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={active?.phase === 'recording' ? 'Stop recording' : 'Say this phrase'}
          >
            <Ionicons
              name={active?.phase === 'recording' ? 'stop-circle' : 'mic-outline'}
              size={16}
              color={active?.phase === 'recording' ? colors.danger : colors.accent}
            />
            <Text
              style={[
                styles.phraseActionLabel,
                active?.phase === 'recording' && { color: colors.danger },
              ]}
            >
              {active?.phase === 'recording' ? 'Stop' : 'Say it'}
            </Text>
          </Pressable>
          {active?.phase !== 'typing' ? (
            <Pressable
              onPress={() => setPractice({ phraseId: phrase.id, phase: 'typing', draft: '' })}
              style={styles.phraseAction}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Practice by typing this phrase"
            >
              <Ionicons name="create-outline" size={15} color={colors.accent} />
              <Text style={styles.phraseActionLabel}>Type</Text>
            </Pressable>
          ) : null}
        </View>

        {stat ? (
          <Text style={styles.phraseBest}>
            Best {stat.best}%{stat.attempts > 1 ? ` · ${stat.attempts} tries` : ''}
          </Text>
        ) : null}

        {active?.phase === 'recording' ? (
          <View style={styles.practiceStatusRow}>
            <View style={styles.recDot} />
            <Text style={styles.practiceStatus}>Listening… tap Stop when you&apos;re done</Text>
          </View>
        ) : null}
        {active?.phase === 'scoring' ? (
          <View style={styles.practiceStatusRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.practiceStatus}>Transcribing…</Text>
          </View>
        ) : null}
        {active?.phase === 'typing' ? (
          <View style={styles.typingPracticeRow}>
            <TextInput
              style={styles.typingPracticeInput}
              value={active.draft}
              onChangeText={(draft) =>
                setPractice({ phraseId: phrase.id, phase: 'typing', draft })
              }
              placeholder={`Say "${phrase.target}" in ${language.name}…`}
              placeholderTextColor={colors.textFaint}
              returnKeyType="done"
              onSubmitEditing={() => submitTypedPractice(phrase)}
              accessibilityLabel="Type the phrase to check your scoring"
            />
            <Pressable
              onPress={() => submitTypedPractice(phrase)}
              disabled={!active.draft.trim()}
              style={({ pressed }) => [
                styles.typingPracticeSubmit,
                (pressed || !active.draft.trim()) && { opacity: 0.6 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Score my attempt"
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
            </Pressable>
          </View>
        ) : null}
        {active?.phase === 'done' ? (
          <View style={styles.scoreCard}>
            <View style={styles.scoreHeaderRow}>
              <Text
                style={[
                  styles.scorePercent,
                  { color: BAND_INK[scoreBand(active.score.percent)] },
                ]}
              >
                {active.score.percent}%
              </Text>
              <Text style={styles.scoreCaption}>word match</Text>
            </View>
            <View style={styles.wordChipRow}>
              {active.score.tokens.map((token, i) => {
                const band = scoreBand(
                  token.kind === 'exact' ? 100 : token.kind === 'close' ? 65 : 0
                );
                return (
                  <View
                    key={`${token.text}-${i}`}
                    style={[styles.wordChip, { backgroundColor: BAND_SOFT_BG[band] }]}
                  >
                    <Text style={[styles.wordChipText, { color: BAND_INK[band] }]}>
                      {token.text}
                    </Text>
                  </View>
                );
              })}
            </View>
            {active.score.extras.length > 0 ? (
              <Text style={styles.scoreExtra}>You also said: {active.score.extras.join(' ')}</Text>
            ) : null}
            <Text style={styles.scoreHeard}>I heard: “{active.transcript}”</Text>
            <Text style={styles.scoreDisclaimer}>
              Scored from the transcript against the target words — this is word accuracy, not
              acoustic pronunciation scoring.
            </Text>
            <View style={styles.scoreActions}>
              {voiceLive ? (
                <Pressable
                  onPress={() => togglePracticeMic(phrase)}
                  style={styles.scoreAction}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Try saying it again"
                >
                  <Ionicons name="refresh" size={15} color={colors.accent} />
                  <Text style={styles.phraseActionLabel}>Try again</Text>
                </Pressable>
              ) : null}
              <Pressable
                onPress={() => setPractice({ phraseId: phrase.id, phase: 'typing', draft: '' })}
                style={styles.scoreAction}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Try again by typing"
              >
                <Ionicons name="create-outline" size={15} color={colors.accent} />
                <Text style={styles.phraseActionLabel}>Type</Text>
              </Pressable>
              <Pressable
                onPress={() => speakNative(phrase.target, language.ttsLocale, SLOW_RATE)}
                style={styles.scoreAction}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Hear the reference audio slowly"
              >
                <Ionicons name="volume-medium-outline" size={15} color={colors.accent} />
                <Text style={styles.phraseActionLabel}>Reference</Text>
              </Pressable>
              <Pressable
                onPress={() => setPractice(null)}
                style={styles.scoreAction}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Done practicing this phrase"
              >
                <Ionicons name="checkmark-circle-outline" size={15} color={colors.textMuted} />
                <Text style={[styles.phraseActionLabel, { color: colors.textMuted }]}>Done</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.push(`/language/${language.id}`)}
          style={styles.headerLanguage}
          accessibilityRole="button"
        >
          <Text style={styles.headerFlag}>{language.flag}</Text>
          <View>
            <Text style={styles.headerTitle}>{language.name}</Text>
            <Text style={styles.headerSubtitle}>
              {scenario ? `${scenario.emoji} ${scenario.title}` : 'Free conversation'}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => setShowTranslation((v) => !v)}
          style={styles.translateToggle}
          accessibilityRole="button"
          accessibilityState={{ selected: showTranslation }}
        >
          <Ionicons
            name="language"
            size={16}
            color={showTranslation ? colors.accent : colors.textFaint}
          />
          <Text style={[styles.translateLabel, showTranslation && styles.translateLabelOn]}>
            {showTranslation ? 'Translation on' : 'Translation off'}
          </Text>
        </Pressable>
      </View>

      <FlatList
        ref={listRef}
        accessibilityLabel="Conversation with your tutor"
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View>
            <View style={styles.levelCard}>
              <View style={styles.levelTop}>
                <Text style={styles.levelLabel}>TUTOR SETUP</Text>
                <Text style={styles.levelExplain} numberOfLines={1}>
                  {language.flag} {language.name}
                </Text>
              </View>
              <View style={styles.selectorRow}>
                <Pressable
                  onPress={() => setPicker('target')}
                  style={styles.selectorChip}
                  accessibilityRole="button"
                  accessibilityLabel={`Target language: ${language.name}. Change it`}
                >
                  <Ionicons name="language-outline" size={14} color={colors.primary} />
                  <Text style={styles.selectorText}>{language.name}</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textFaint} />
                </Pressable>
                <Pressable
                  onPress={() => setPicker('explain')}
                  style={styles.selectorChip}
                  accessibilityRole="button"
                  accessibilityLabel={`Explanations in ${explanationLanguage}. Change it`}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={14} color={colors.primary} />
                  <Text style={styles.selectorText}>Explain in {explanationLanguage}</Text>
                  <Ionicons name="chevron-down" size={12} color={colors.textFaint} />
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.levelRow}>
                {(['auto', 'A1', 'A2', 'B1', 'B2'] as const).map((option) => {
                  const on = settings.level === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        void saveModelSettings({ level: option });
                      }}
                      style={[styles.levelChip, on && styles.levelChipOn]}
                      hitSlop={{ top: 6, bottom: 6, left: 2, right: 2 }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      accessibilityLabel={option === 'auto' ? 'Level follows your progress' : `Level ${option}`}
                    >
                      <Text style={[styles.levelChipText, on && styles.levelChipTextOn]}>
                        {option === 'auto' ? 'Auto' : option}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <View style={styles.scenarios}>
              <Chip
                label="Free chat"
                selected={scenarioId === null}
                onPress={() => setScenarioId(null)}
              />
              {language.scenarios.map((s) => (
                <Chip
                  key={s.id}
                  label={`${s.emoji} ${s.title}`}
                  selected={scenarioId === s.id}
                  onPress={() => setScenarioId(s.id)}
                />
              ))}
            </View>
            {phrases.length > 0 ? (
              <View style={styles.practiceCard}>
                <View style={styles.practiceHeaderRow}>
                  <Ionicons name="mic-circle-outline" size={18} color={colors.accent} />
                  <Text style={styles.practiceTitle}>Say it out loud</Text>
                </View>
                <Text style={styles.practiceSubtitle}>
                  {voiceLive
                    ? 'Practice key phrases — scored word by word'
                    : 'Practice key phrases — type to get scored word by word'}
                </Text>
                {phrases.map(renderPhrase)}
              </View>
            ) : null}
          </View>
        }
        ListFooterComponent={
          busy ? (
            <View
              style={styles.typingRow}
              accessibilityLiveRegion="polite"
              accessibilityLabel={`${language.name} is thinking`}
            >
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.typingText}>{language.name} is thinking…</Text>
            </View>
          ) : undefined
        }
        renderItem={({ item, index }) =>
          item.role === 'assistant' ? (
            <View style={[styles.bubble, styles.aiBubble]}>
              <Text style={styles.aiText}>{item.text}</Text>
              {item.translation && (showTranslation || revealed.includes(index)) ? (
                <Text style={styles.aiTranslation}>{item.translation}</Text>
              ) : null}
              {item.tip ? <Text style={styles.tipText}>{item.tip}</Text> : null}
              <View style={styles.aiActions}>
                <Pressable
                  onPress={() => void speakLine(`msg-${index}`, item.text)}
                  style={styles.listenRow}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: speakingKey === `msg-${index}` }}
                  accessibilityLabel={
                    speakingKey === `msg-${index}` ? 'Stop reading this sentence' : 'Listen to this sentence'
                  }
                >
                  <Ionicons
                    name={speakingKey === `msg-${index}` ? 'stop' : 'volume-medium-outline'}
                    size={15}
                    color={colors.accent}
                  />
                  <Text style={styles.listenLabel}>
                    {speakingKey === `msg-${index}` ? 'Stop' : 'Listen'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void speakLine(`msg-${index}-slow`, item.text, SLOW_RATE)}
                  style={styles.listenRow}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Listen slowly"
                >
                  <Text style={styles.listenLabel}>🐢 Slow</Text>
                </Pressable>
                <Pressable
                  onPress={() => toggleReveal(index)}
                  style={styles.listenRow}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Show translation for this message"
                >
                  <Ionicons name="eye-outline" size={15} color={colors.accent} />
                  <Text style={styles.listenLabel}>
                    {revealed.includes(index) ? 'Hide' : 'Translate'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => reportMessage(item)}
                  style={styles.listenRow}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Report this message as wrong"
                >
                  <Ionicons name="flag-outline" size={14} color={colors.textFaint} />
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.bubble, styles.userBubble]}>
              <Text style={styles.userText}>{item.text}</Text>
              {item.fromVoice ? (
                <View style={styles.userMetaRow}>
                  <View style={styles.voiceChip}>
                    <Ionicons name="mic" size={10} color={colors.primary} />
                    <Text style={styles.voiceChipText}>Voice</Text>
                  </View>
                </View>
              ) : null}
            </View>
          )
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {voiceError ? (
          <Text style={styles.voiceError} accessibilityLiveRegion="polite">
            {voiceError}
          </Text>
        ) : null}
        {quotaNote ? (
          <View style={styles.quotaStrip} accessibilityLiveRegion="polite">
            <Ionicons name="time-outline" size={15} color={colors.warning} />
            <Text style={styles.quotaStripText}>{quotaNote}</Text>
          </View>
        ) : null}
        {aiStatus && !aiStatus.chat ? (
          <View style={styles.coachStrip}>
            <Ionicons name="cloud-offline-outline" size={14} color={colors.textMuted} />
            <Text style={styles.coachStripText} numberOfLines={2}>
              Coach mode · tutor server unavailable, bundled phrases only
            </Text>
            <Pressable
              onPress={() => {
                setAiStatus(null);
                setProbeNonce((value) => value + 1);
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Retry the tutor server"
            >
              <Text style={styles.coachRetry}>Retry</Text>
            </Pressable>
          </View>
        ) : null}
        {voiceHelp ? (
          <View style={styles.voiceHelpBox}>
            <Ionicons name="mic-outline" size={17} color={colors.accent} />
            <View style={styles.offlineBody}>
              <Text style={styles.offlineText}>{voiceHelp.message}</Text>
              {voiceHelp.action === 'browser-stt' ? (
                <Pressable
                  onPress={() => {
                    setVoiceHelp(null);
                    void saveModelSettings({
                      browser: { ...settings.browser, enabled: true },
                      // Server mode keeps chat on the tutor server; enabling
                      // the browser model makes free on-device Whisper the
                      // speech fallback when the server has no audio.
                    });
                  }}
                  style={styles.voiceHelpAction}
                  accessibilityRole="button"
                >
                  <Text style={styles.voiceHelpActionText}>Enable browser voice</Text>
                </Pressable>
              ) : null}
              {voiceHelp.action === 'open-settings' ? (
                <Pressable
                  onPress={() => {
                    void Linking.openSettings().catch(() => undefined);
                  }}
                  style={styles.voiceHelpAction}
                  accessibilityRole="button"
                >
                  <Text style={styles.voiceHelpActionText}>Open system settings</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
        <View style={styles.inputBar}>
          <Pressable
            style={[styles.micButton, chatRecording && styles.micButtonRecording]}
            disabled={busy || recorder.isBusy}
            accessibilityLabel={chatRecording ? 'Stop recording' : 'Speak your reply'}
            onPress={() => {
              void toggleChatMic();
            }}
          >
            <Ionicons
              name={chatRecording ? 'stop' : voiceLive === false ? 'mic-off-outline' : 'mic-outline'}
              size={20}
              color={chatRecording ? colors.white : voiceLive === false ? colors.textFaint : colors.accent}
            />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={(next) => {
              setInput(next);
              if (voiceHelp) setVoiceHelp(null);
            }}
            placeholder={
              chatRecording
                ? `Recording… ${Math.round(recorder.durationMs / 1000)}s`
                : `Reply in ${language.name}…`
            }
            placeholderTextColor={colors.textFaint}
            returnKeyType="send"
            onSubmitEditing={send}
            accessibilityLabel="Message your tutor"
          />
          {busy ? (
            <Pressable
              onPress={stopTurn}
              accessibilityRole="button"
              accessibilityLabel="Stop the tutor"
              accessibilityHint="Cancels the reply in progress"
              style={({ pressed }) => [styles.sendWrap, pressed && { opacity: 0.7 }]}
            >
              <View style={styles.stopButton}>
                <Ionicons name="stop" size={18} color={colors.white} />
              </View>
            </Pressable>
          ) : (
            <Pressable
              onPress={send}
              disabled={!input.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={({ pressed }) => [styles.sendWrap, (pressed || !input.trim()) && { opacity: 0.6 }]}
            >
              <LinearGradient
                colors={[colors.gradientFrom, colors.gradientTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.sendButton}
              >
                <Ionicons name="arrow-up" size={20} color={colors.white} />
              </LinearGradient>
            </Pressable>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={picker !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable
          style={styles.pickerBackdrop}
          onPress={() => setPicker(null)}
          accessibilityRole="button"
          accessibilityLabel="Close the picker"
        >
          <Pressable
            style={styles.pickerCard}
            onPress={() => undefined}
            accessible={false}
            accessibilityViewIsModal
          >
            <Text style={styles.pickerTitle}>
              {picker === 'explain' ? 'Explain in' : 'Practise which language?'}
            </Text>
            <Text style={styles.pickerHint}>
              {picker === 'explain'
                ? 'Translations and grammar tips are written in this language. The tutor still speaks only the target language.'
                : 'Switching language starts a new conversation with a fresh opening line.'}
            </Text>
            <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
              {LANGUAGES.map((option) => {
                const selected =
                  picker === 'explain'
                    ? option.id === nativeLanguageId
                    : option.id === targetLanguageId;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      if (picker === 'explain') setNativeLanguage(option.id);
                      else setTargetLanguage(option.id);
                      setPicker(null);
                    }}
                    style={[styles.pickerRow, selected && styles.pickerRowOn]}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.name}
                  >
                    <Text style={styles.pickerFlag}>{option.flag}</Text>
                    <Text style={styles.pickerName}>{option.name}</Text>
                    {option.nativeName !== option.name ? (
                      <Text style={styles.pickerNative}>{option.nativeName}</Text>
                    ) : null}
                    {selected ? (
                      <Ionicons name="checkmark" size={16} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={() => setPicker(null)}
              style={styles.pickerClose}
              accessibilityRole="button"
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLanguage: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerFlag: { fontSize: 28 },
  headerTitle: { ...typography.bodyStrong, color: colors.text },
  headerSubtitle: { ...typography.caption, color: colors.textMuted },
  translateToggle: {
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
  translateLabel: { ...typography.micro, color: colors.textFaint },
  levelCard: { marginBottom: spacing.md },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  levelLabel: { ...typography.micro, color: colors.textFaint },
  levelExplain: { ...typography.caption, color: colors.textMuted, flexShrink: 1 },
  levelRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  selectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  selectorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  selectorText: { ...typography.micro, color: colors.text },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 24, 33, 0.45)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  pickerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    maxHeight: '80%',
  },
  pickerTitle: { ...typography.title, color: colors.text },
  pickerHint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  pickerList: { marginTop: spacing.md },
  pickerListContent: { paddingBottom: spacing.sm },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
  },
  pickerRowOn: { backgroundColor: colors.surfaceTint },
  pickerFlag: { fontSize: 20 },
  pickerName: { ...typography.body, color: colors.text, flex: 1 },
  pickerNative: { ...typography.caption, color: colors.textFaint },
  pickerClose: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md },
  pickerCloseText: { ...typography.bodyStrong, color: colors.primary },
  levelChip: {
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  levelChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  levelChipText: { ...typography.micro, color: colors.textMuted },
  levelChipTextOn: { color: colors.onDark },
  tipText: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  coachStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
  },
  coachStripText: { ...typography.micro, color: colors.textMuted, flex: 1, lineHeight: 14 },
  coachRetry: { ...typography.micro, color: colors.primary },
  quotaStrip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    backgroundColor: colors.warningSoft,
  },
  quotaStripText: { ...typography.micro, color: colors.text, flex: 1, lineHeight: 16 },
  offlineBody: { flex: 1 },
  offlineText: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  voiceHelpBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  voiceHelpAction: { alignSelf: 'flex-start', marginTop: 6 },
  voiceHelpActionText: { ...typography.micro, color: colors.primary },
  translateLabelOn: { color: colors.accent },
  listContent: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  scenarios: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  practiceCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
    gap: spacing.md,
  },
  practiceHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  practiceTitle: { ...typography.bodyStrong, color: colors.text },
  practiceSubtitle: { ...typography.caption, color: colors.textMuted, marginTop: -spacing.sm },
  phraseRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  phraseTarget: { ...typography.body, color: colors.text },
  phraseTranslation: {
    ...typography.caption,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  phraseActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xs },
  phraseAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  phraseActionRecording: {
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  phraseActionLabel: { ...typography.micro, color: colors.accent },
  phraseBest: { ...typography.micro, color: colors.textFaint, marginTop: spacing.xs },
  practiceStatusRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  practiceStatus: { ...typography.caption, color: colors.textMuted },
  recDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger },
  typingPracticeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  typingPracticeInput: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    paddingVertical: spacing.xs,
  },
  typingPracticeSubmit: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCard: {
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  scoreHeaderRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  scorePercent: { fontSize: 30, fontWeight: '800' },
  scoreDisclaimer: {
    ...typography.micro,
    color: colors.textFaint,
    lineHeight: 15,
    marginTop: spacing.xs,
  },
  scoreCaption: { ...typography.caption, color: colors.textMuted },
  wordChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  wordChip: { borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  wordChipText: { ...typography.caption, fontWeight: '600' },
  scoreExtra: { ...typography.micro, color: colors.textMuted },
  scoreHeard: { ...typography.micro, color: colors.textFaint, fontStyle: 'italic' },
  scoreActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.xs },
  scoreAction: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bubble: { maxWidth: '86%', borderRadius: radii.lg, padding: spacing.lg },
  aiBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceHigh,
    borderTopLeftRadius: spacing.xs,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderTopRightRadius: spacing.xs,
  },
  aiText: { ...typography.body, color: colors.text, lineHeight: 23 },
  aiTranslation: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  aiActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listenLabel: { ...typography.micro, color: colors.accent },
  // Dark green bubble: the text must be light, not the body ink — this was the
  // "Hi" that looked like it floated outside its own bubble.
  userText: { ...typography.body, color: colors.onDark, lineHeight: 23 },
  userMetaRow: { flexDirection: 'row', marginTop: spacing.sm },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  voiceChipText: { ...typography.micro, color: colors.onDark },
  typingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  typingText: { ...typography.caption, color: colors.textMuted },
  voiceError: {
    ...typography.caption,
    color: colors.danger,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: 92,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  micButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButtonRecording: { backgroundColor: colors.danger },
  input: {
    flex: 1,
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.lg,
    minHeight: 46,
    paddingVertical: spacing.sm,
  },
  sendWrap: { borderRadius: 23 },
  stopButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.text,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  demoNote: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    paddingBottom: spacing.sm,
    backgroundColor: colors.bg,
  },
});
