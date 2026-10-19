import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { getLanguage } from '@/data/languages';
import { CHAR_BASED_LANGUAGES, getPracticePhrases, type PracticePhrase } from '@/data/practice';
import { suggestLevel } from '@/lib/adaptive';
import {
  fetchAiStatus,
  isAIConfigured,
  setSpeechErrorListener,
  speakNative,
  transcribeSpeech,
  tutorReply,
  type AiStatus,
  type TutorMessage,
} from '@/lib/ai';
import { scoreBand, scorePronunciation } from '@/lib/pronunciation';
import { showAlert } from '@/lib/alert';
import { NEON_API_URL } from '@/lib/neon';
import { loadSpeakingStats, recordPhraseAttempt, type SpeakingStats } from '@/lib/speaking';
import { ensureRecordingReady, useVoiceRecorder } from '@/lib/voice';
import { flushReportQueue, sendReport } from '@/lib/reports';
import { colors, radii, spacing, typography } from '@/theme/tokens';

type ChatMessage = TutorMessage & { fromVoice?: boolean };

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
  const { targetLanguageId, nativeLanguageId } = usePreferences();
  const { lessonsCompleted } = useLearning();
  const { profile } = useProfile();
  const { logSpeakingScore } = useAnalytics();
  const language = getLanguage(targetLanguageId);

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
  // Server-reported AI capability (backend proxy probe) — null until the
  // first probe resolves. See tutorLive/voiceLive below.
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

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
  const level = suggestLevel(lessonsCompleted);

  // Honest capability gates: "live" only when either transport can actually
  // serve it — the backend proxy (key lives server-side) or a direct
  // EXPO_PUBLIC_AI_* config. A null aiStatus means the probe hasn't resolved:
  // fall back to build-time knowledge, never claim live from wishful thinking.
  const tutorLive = isAIConfigured || aiStatus?.chat === true;
  const voiceLive = isAIConfigured || aiStatus?.stt === true;

  /** Transport for AI calls: JWT for the backend proxy when available. */
  async function aiIo() {
    const jwt = await getAccessToken().catch(() => null);
    return jwt ? { apiBase: NEON_API_URL, jwt } : null;
  }

  // Reset the conversation when the language or scenario changes — done
  // during render (React's recommended pattern), not inside the effect.
  const conversationKey = `${language.id}:${scenarioId ?? 'free'}`;
  const [prevKey, setPrevKey] = useState(conversationKey);
  if (prevKey !== conversationKey) {
    setPrevKey(conversationKey);
    setMessages([]);
    setRevealed([]);
    setPractice(null);
    setVoiceError(null);
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
  }, [getAccessToken]);

  useEffect(() => {
    setSpeechErrorListener(setVoiceError);
    return () => setSpeechErrorListener(null);
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

  // Fresh opening line for every new conversation.
  useEffect(() => {
    let cancelled = false;
    tutorReply({
      language,
      history: [],
      learnerName,
      scenarioTitle: scenario?.title,
      profile: tutorProfile,
      level,
    })
      .then((reply) => {
        if (!cancelled) {
          setMessages([{ role: 'assistant', text: reply.text, translation: reply.translation }]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMessages([
            {
              role: 'assistant',
              text: '…',
              translation: 'Could not reach the tutor. Check your AI key in .env.',
            },
          ]);
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationKey]);

  async function respond(history: ChatMessage[]) {
    setBusy(true);
    try {
      const reply = await tutorReply(
        {
          language,
          history,
          learnerName,
          scenarioTitle: scenario?.title,
          profile: tutorProfile,
          level,
        },
        await aiIo()
      );
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: reply.text, translation: reply.translation },
      ]);
    } catch (error) {
      // Real-mode failures surface as themselves (rate limits, timeouts,
      // wrong-script, missing key) — never replaced by scripted content.
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
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    const history: ChatMessage[] = [...messages, { role: 'user', text }];
    setMessages(history);
    await respond(history);
  }

  /* ── Voice: chat turns ─────────────────────────────────────────────────── */

  async function toggleChatMic() {
    if (busy || recorder.isBusy || practice?.phase === 'recording' || practice?.phase === 'scoring') {
      return;
    }
    // Known-unavailable voice input: don't record a clip we can't transcribe.
    if (aiStatus && !voiceLive) {
      setVoiceError('Voice input is not configured on this deployment yet — type your reply instead.');
      return;
    }
    if (chatRecording) {
      setChatRecording(false);
      const uri = await recorder.stop();
      if (!uri) return;
      setBusy(true);
      try {
        const text = await transcribeSpeech(uri, language.id, await aiIo());
        const history: ChatMessage[] = [...messages, { role: 'user', text, fromVoice: true }];
        setMessages(history);
        setBusy(false);
        await respond(history);
      } catch (error) {
        setBusy(false);
        setVoiceError(
          error instanceof Error ? error.message : 'Voice input failed — try again or type instead.'
        );
      }
    } else {
      if (!(await ensureRecordingReady())) {
        setVoiceError('Microphone access is off — enable it in Settings to speak.');
        return;
      }
      setVoiceError(null);
      setChatRecording(true);
      await recorder.start();
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
    if (recorder.isBusy || busy) return;
    if (practice?.phase === 'recording' && practice.phraseId === phrase.id) {
      setPractice({ phraseId: phrase.id, phase: 'scoring' });
      const uri = await recorder.stop();
      if (!uri) {
        setPractice(null);
        return;
      }
      try {
        const transcript = await transcribeSpeech(uri, language.id, await aiIo());
        finishPractice(phrase, transcript);
      } catch (error) {
        setPractice(null);
        setVoiceError(
          error instanceof Error
            ? error.message
            : "Couldn't catch that — try again, or type the phrase instead."
        );
      }
    } else {
      if (practice?.phase === 'recording' || chatRecording) return;
      if (!(await ensureRecordingReady())) {
        setVoiceError('Microphone access is off — enable it in Settings to speak.');
        return;
      }
      setVoiceError(null);
      setPractice({ phraseId: phrase.id, phase: 'recording' });
      await recorder.start();
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
            onPress={() => speakNative(phrase.target, language.ttsLocale)}
            style={styles.phraseAction}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Listen to this phrase"
          >
            <Ionicons name="volume-medium-outline" size={15} color={colors.accent} />
            <Text style={styles.phraseActionLabel}>Listen</Text>
          </Pressable>
          <Pressable
            onPress={() => speakNative(phrase.target, language.ttsLocale, SLOW_RATE)}
            style={styles.phraseAction}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Listen slowly"
          >
            <Text style={styles.phraseActionLabel}>🐢 Slow</Text>
          </Pressable>
          {voiceLive ? (
            <Pressable
              onPress={() => togglePracticeMic(phrase)}
              style={[
                styles.phraseAction,
                active?.phase === 'recording' && styles.phraseActionRecording,
              ]}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={
                active?.phase === 'recording' ? 'Stop recording' : 'Say this phrase'
              }
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
          ) : null}
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
            <ActivityIndicator size="small" color={colors.primarySoft} />
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
              <Text style={styles.scoreCaption}>pronunciation</Text>
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
        data={messages}
        keyExtractor={(_, index) => String(index)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={
          <View>
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
            <View style={styles.typingRow}>
              <ActivityIndicator size="small" color={colors.primarySoft} />
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
              <View style={styles.aiActions}>
                <Pressable
                  onPress={() => speakNative(item.text, language.ttsLocale)}
                  style={styles.listenRow}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Listen to this sentence"
                >
                  <Ionicons name="volume-medium-outline" size={15} color={colors.accent} />
                  <Text style={styles.listenLabel}>Listen</Text>
                </Pressable>
                <Pressable
                  onPress={() => speakNative(item.text, language.ttsLocale, SLOW_RATE)}
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
        {voiceError ? <Text style={styles.voiceError}>{voiceError}</Text> : null}
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
              name={chatRecording ? 'stop' : 'mic-outline'}
              size={20}
              color={chatRecording ? colors.white : voiceLive ? colors.accent : colors.textFaint}
            />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
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
          <Pressable
            onPress={send}
            disabled={!input.trim() || busy}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            style={({ pressed }) => [styles.sendWrap, (pressed || !input.trim() || busy) && { opacity: 0.6 }]}
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
        </View>
        {!tutorLive ? (
          <Text style={styles.demoNote}>
            Demo tutor — live AI is off on this deployment. Set AI_API_KEY on the api Function, or
            EXPO_PUBLIC_AI_API_URL + EXPO_PUBLIC_AI_API_KEY in .env for development.
          </Text>
        ) : null}
      </KeyboardAvoidingView>
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
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    borderTopRightRadius: spacing.xs,
  },
  aiText: { ...typography.body, color: colors.text, lineHeight: 23 },
  aiTranslation: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm, fontStyle: 'italic' },
  aiActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, marginTop: spacing.md },
  listenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  listenLabel: { ...typography.micro, color: colors.accent },
  userText: { ...typography.body, color: colors.text, lineHeight: 23 },
  userMetaRow: { flexDirection: 'row', marginTop: spacing.sm },
  voiceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  voiceChipText: { ...typography.micro, color: colors.primary },
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
    paddingVertical: spacing.md,
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
