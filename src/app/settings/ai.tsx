import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/state/preferences';
import { fetchAiStatus, type AiStatus } from '@/lib/ai';
import { NEON_API_URL } from '@/lib/neon';
import { useModelSettings, saveModelSettings, resetModelSettings } from '@/lib/models/settings';
import { sanitizeBaseUrl, languageSupport } from '@/lib/models/config';
import {
  TUTOR_MODES,
  coverageLabel,
  coverageSummary,
  coverageFor,
  findModel,
  modelsFor,
  type TutorMode,
} from '@/lib/models/catalog';
import { getLanguage } from '@/data/languages';
import { colors, radii, spacing, typography } from '@/theme/tokens';
import type { ModelKind } from '@/lib/models/types';

const CHAT_MODELS = modelsFor('chat').filter((model) => model.runtimes.length > 0);
const STT_MODELS = modelsFor('stt').filter((model) => model.runtimes.length > 0);
const TTS_MODELS = modelsFor('tts').filter((model) => model.runtimes.length > 0);

function activeChatModel(settings: ReturnType<typeof useModelSettings>['settings']): string {
  if (settings.mode === 'browser') return settings.browser.chatModel;
  if (settings.mode === 'local') return settings.ollamaModel || settings.openaiModel;
  return settings.ollamaModel;
}

export default function AiModelSettingsScreen() {
  const { settings } = useModelSettings();
  const { targetLanguageId } = usePreferences();
  const { getAccessToken } = useAuth();

  const [status, setStatus] = useState<AiStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [ollamaUrl, setOllamaUrl] = useState(settings.ollamaUrl);
  const [, setOllamaModel] = useState(settings.ollamaModel);
  const [openaiUrl, setOpenaiUrl] = useState(settings.openaiUrl);
  const [openaiModel, setOpenaiModel] = useState(settings.openaiModel);
  const [sttModel, setSttModel] = useState(settings.sttModel);

  const language = getLanguage(targetLanguageId);
  const modelId = activeChatModel(settings);
  const coverage = useMemo(() => coverageSummary(modelId), [modelId]);
  const languageCoverage = coverageFor(modelId, language.id);
  const support = languageSupport(modelId, language.id, settings.allowUnverified);
  const modelSpec = findModel(modelId);

  async function check() {
    setChecking(true);
    setError(null);
    try {
      const jwt = await getAccessToken().catch(() => null);
      const next = await fetchAiStatus({ apiBase: NEON_API_URL, jwt });
      setStatus(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check engines.');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => {
    // Deferred: `check` sets state, and effects must not set state synchronously.
    const timer = setTimeout(() => {
      void check();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function commit(patch: Parameters<typeof saveModelSettings>[0], note: string) {
    const next = await saveModelSettings(patch);
    setSaved(note);
    setOllamaUrl(next.ollamaUrl);
    setOllamaModel(next.ollamaModel);
    setOpenaiUrl(next.openaiUrl);
    setOpenaiModel(next.openaiModel);
    setSttModel(next.sttModel);
    setStatus(null);
    setTimeout(() => setSaved(null), 2_500);
  }

  function applyUrl(kind: 'ollama' | 'openai') {
    const raw = kind === 'ollama' ? ollamaUrl : openaiUrl;
    const clean = sanitizeBaseUrl(raw);
    if (raw.trim() && !clean) {
      setError('That address is not a plain http(s) URL. Remove credentials, query strings or fragments.');
      return;
    }
    setError(null);
    void commit(
      kind === 'ollama' ? { ollamaUrl: clean ?? '' } : { openaiUrl: clean ?? '' },
      'Server address saved.'
    );
  }

  return (
    <Screen scroll>
      <View style={styles.header}>
        <Text style={styles.kicker}>OPEN-SOURCE AI</Text>
        <Text style={styles.title}>Models, not middlemen.</Text>
        <Text style={styles.subtitle}>
          The tutor runs on an open-weight model you control: Ollama on your device or LAN, a
          self-hosted server, or a small model inside this browser. No paid AI API is required, and
          nothing falls back to one silently.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
      {saved ? <Text style={styles.saved}>{saved}</Text> : null}

      {/* ── Engine status ───────────────────────────────────────────── */}
      <View style={styles.statusCard}>
        <View style={styles.statusTop}>
          <View style={styles.flex}>
            <Text style={styles.statusTitle}>
              {status === null
                ? 'Checking engines…'
                : status.chat
                  ? `Live · ${status.model ?? 'model'}`
                  : 'Offline coach'}
            </Text>
            <Text style={styles.statusSub}>
              {status === null
                ? 'One quick local probe — nothing is downloaded.'
                : status.detail || 'No engine answered.'}
            </Text>
          </View>
          {checking ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Button label="Check" variant="secondary" onPress={() => void check()} />
          )}
        </View>
      </View>

      {/* ── Mode ────────────────────────────────────────────────────── */}
      <SectionHeader title="How should the tutor run?" icon="git-branch-outline" />
      {TUTOR_MODES.map((mode) => {
        const on = settings.mode === mode.id;
        return (
          <Pressable
            key={mode.id}
            onPress={() => void commit({ mode: mode.id as TutorMode }, `Mode: ${mode.label}`)}
            style={[styles.modeRow, on && styles.modeRowOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <View style={[styles.radio, on && styles.radioOn]}>
              {on ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={styles.flex}>
              <Text style={styles.modeTitle}>{mode.label}</Text>
              <Text style={styles.modeDetail}>{mode.detail}</Text>
            </View>
          </Pressable>
        );
      })}

      {/* ── Language coverage ──────────────────────────────────────── */}
      <SectionHeader title={`Coverage for ${language.name}`} icon="globe-outline" />
      <View style={styles.card}>
        <View style={styles.coverageTop}>
          <Pill
            label={coverageLabel(languageCoverage)}
            tone={languageCoverage === 'documented' ? 'free' : 'new'}
          />
          <Text style={styles.coverageCount}>
            {coverage.documented.length}/{coverage.total} languages documented
          </Text>
        </View>
        <Text style={styles.body}>
          {languageCoverage === 'documented'
            ? `${modelId} lists ${language.name} in its language table. Coverage is still model-dependent — check real answers before trusting a lesson.`
            : `${modelId} does not list ${language.name}. ${settings.allowUnverified ? 'You have opted in, so requests are allowed — expect weaker output.' : 'Requests are blocked until you opt in below.'}`}
        </Text>
        {coverage.unverified.length > 0 ? (
          <Text style={styles.hint}>
            Not documented:{' '}
            {coverage.unverified
              .map((id) => getLanguage(id).name)
              .slice(0, 12)
              .join(', ')}
            {coverage.unverified.length > 12 ? '…' : ''}
          </Text>
        ) : null}
        {modelSpec ? (
          <Text style={styles.hint}>
            {modelSpec.license.name}
            {modelSpec.license.commercial === 'no'
              ? ' · non-commercial: research use only'
              : modelSpec.license.commercial === 'check'
                ? ' · check the licence before shipping'
                : ' · commercial use allowed'}
            {' · '}
            {modelSpec.notes}
          </Text>
        ) : null}
        <Pressable
          onPress={() =>
            void commit(
              { allowUnverified: !settings.allowUnverified },
              settings.allowUnverified ? 'Unverified languages blocked.' : 'Unverified languages allowed.'
            )
          }
          style={styles.toggleRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.allowUnverified }}
        >
          <View style={[styles.switch, settings.allowUnverified && styles.switchOn]}>
            <View style={[styles.knob, settings.allowUnverified && styles.knobOn]} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.modeTitle}>Use unverified languages</Text>
            <Text style={styles.modeDetail}>
              Allow this model for languages its card does not list. Off by default — an unproven
              model can teach wrong grammar.
            </Text>
          </View>
        </Pressable>
        {support === 'unverified' ? (
          <Text style={styles.warn}>
            {language.name} is currently blocked for this model. Enable the switch above to try it.
          </Text>
        ) : null}
      </View>

      {/* ── Local server ───────────────────────────────────────────── */}
      <SectionHeader title="This device or LAN" icon="laptop-outline" />
      <View style={styles.card}>
        <Text style={styles.body}>
          Ollama keeps the model on your machine. Install it, then pull a model — the app discovers
          it at the address below.
        </Text>
        <Text style={styles.code}>ollama pull {settings.ollamaModel}{'\n'}ollama serve</Text>
        <Text style={styles.fieldLabel}>OLLAMA URL</Text>
        <TextInput
          style={styles.input}
          value={ollamaUrl}
          onChangeText={setOllamaUrl}
          onEndEditing={() => applyUrl('ollama')}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://localhost:11434"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Ollama server URL"
        />
        <Text style={styles.fieldLabel}>MODEL</Text>
        <View style={styles.chipWrap}>
          {CHAT_MODELS.filter((model) => model.runtimes.includes('ollama')).map((model) => {
            const on = settings.ollamaModel === model.id;
            return (
              <Pressable
                key={model.id}
                onPress={() => void commit({ ollamaModel: model.id }, `Model: ${model.label}`)}
                style={[styles.chip, on && styles.chipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{model.label}</Text>
                <Text style={[styles.chipMeta, on && styles.chipMetaOn]}>
                  {model.sizeMb >= 1000
                    ? `${(model.sizeMb / 1000).toFixed(1)} GB`
                    : `${model.sizeMb} MB`}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>
          Also works with llama.cpp, LM Studio, LocalAI or any OpenAI-compatible server:
        </Text>
        <TextInput
          style={styles.input}
          value={openaiUrl}
          onChangeText={setOpenaiUrl}
          onEndEditing={() => applyUrl('openai')}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:1234/v1 (optional)"
          placeholderTextColor={colors.textFaint}
          accessibilityLabel="Local OpenAI-compatible server URL"
        />
        {openaiUrl ? (
          <>
            <Text style={styles.fieldLabel}>MODEL ID ON THAT SERVER</Text>
            <TextInput
              style={styles.input}
              value={openaiModel}
              onChangeText={setOpenaiModel}
              onEndEditing={() => void commit({ openaiModel }, 'Local model id saved.')}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="qwen2.5-7b-instruct"
              placeholderTextColor={colors.textFaint}
              accessibilityLabel="Model id on the local server"
            />
          </>
        ) : null}
      </View>

      {/* ── Browser ────────────────────────────────────────────────── */}
      <SectionHeader title="In this browser" icon="globe-outline" />
      <View style={styles.card}>
        <Pressable
          onPress={() => void commit({ browser: { ...settings.browser, enabled: !settings.browser.enabled } }, settings.browser.enabled ? 'Browser inference off.' : 'Browser inference on.')}
          style={styles.toggleRow}
          accessibilityRole="switch"
          accessibilityState={{ checked: settings.browser.enabled }}
        >
          <View style={[styles.switch, settings.browser.enabled && styles.switchOn]}>
            <View style={[styles.knob, settings.browser.enabled && styles.knobOn]} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.modeTitle}>Run a model in this tab</Text>
            <Text style={styles.modeDetail}>
              WebGPU when available, WebAssembly otherwise. The first answer downloads the model
              (a few hundred MB) and caches it in the browser.
            </Text>
          </View>
        </Pressable>
        <Text style={styles.hint}>
          Current: {settings.browser.chatModel} · {settings.browser.sttModel}
        </Text>
        <Text style={styles.hint}>
          Low-memory devices should stay on text: Whisper in a browser peaks around 300–700 MB.
        </Text>
      </View>

      {/* ── Speech ─────────────────────────────────────────────────── */}
      <SectionHeader title="Speech input (STT)" icon="mic-outline" />
      <View style={styles.card}>
        <Text style={styles.body}>
          Voice input needs a speech model. Without one the mic is disabled — typing always works.
        </Text>
        <ModelPicker
          models={STT_MODELS}
          selected={sttModel}
          onSelect={(id) => void commit({ sttModel: id }, 'Speech model saved.')}
        />
        <Text style={styles.hint}>
          Recordings are uploaded only for the turn you speak, never stored, and never kept after
          transcription. Local/browser models mean the audio never leaves your device.
        </Text>
      </View>

      <SectionHeader title="Voice output (TTS)" icon="volume-high-outline" />
      <View style={styles.card}>
        <ModelPicker
          models={TTS_MODELS}
          selected={settings.ttsModel}
          onSelect={(id) => void commit({ ttsModel: id }, 'Voice engine saved.')}
        />
        <Text style={styles.hint}>
          Device voices play through your OS and work offline. Piper/Kokoro need a small local HTTP
          server; until one is connected, playback still uses the device voice and says so.
        </Text>
      </View>

      {/* ── Hardware ───────────────────────────────────────────────── */}
      <SectionHeader title="What it costs to run" icon="server-outline" />
      <View style={styles.card}>
        <Text style={styles.body}>
          Self-hosting is free of API fees, not free of resources. Rough guidance:
        </Text>
        {CHAT_MODELS.filter((model) => model.runtimes.includes('ollama')).map((model) => (
          <View key={model.id} style={styles.hardwareRow}>
            <View style={styles.flex}>
              <Text style={styles.modeTitle}>{model.label}</Text>
              <Text style={styles.modeDetail}>{model.hardware}</Text>
            </View>
            <Text style={styles.hardwareSize}>
              {model.sizeMb >= 1000 ? `${(model.sizeMb / 1000).toFixed(1)} GB` : `${model.sizeMb} MB`}
            </Text>
          </View>
        ))}
        <Text style={styles.hint}>
          CPU-only inference of a 1.5B model is roughly 10–25 tokens/s on a modern laptop; a phone
          should use the offline coach or a LAN server. Hosting a gateway adds server RAM, storage
          and electricity. Browser inference shifts compute to the learner’s device.
        </Text>
      </View>

      <Button
        label="Reset to defaults"
        variant="secondary"
        onPress={() => {
          void resetModelSettings().then(() => {
            setOllamaUrl('http://localhost:11434');
            setOllamaModel('qwen2.5:1.5b');
            setOpenaiUrl('');
            setOpenaiModel('qwen2.5:1.5b');
            setSttModel('whisper-large-v3-turbo');
            setStatus(null);
          });
        }}
      />
      <Text style={styles.footer}>
        Model settings stay on this device. Prompts and transcripts go only to the server you
        chose — a local/LAN model or the app owner’s gateway — and never to a paid provider by
        default. Local and browser modes send them nowhere.
      </Text>
    </Screen>
  );
}

function ModelPicker({
  models,
  selected,
  onSelect,
}: {
  models: { id: string; label: string; sizeMb: number; notes: string; license: { name: string } }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  return (
    <View style={styles.chipWrap}>
      {models.map((model) => {
        const on = selected === model.id;
        return (
          <Pressable
            key={model.id}
            onPress={() => onSelect(model.id)}
            style={[styles.chip, on && styles.chipOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{model.label}</Text>
            <Text style={[styles.chipMeta, on && styles.chipMetaOn]}>
              {model.license.name}
              {typeof model.sizeMb === 'number' && model.sizeMb > 0
                ? ` · ${model.sizeMb >= 1000 ? `${(model.sizeMb / 1000).toFixed(1)} GB` : `${model.sizeMb} MB`}`
                : ''}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kinds are exported for tests that assert every catalogue entry is listed. */
export const MODALITY_ORDER: ModelKind[] = ['chat', 'stt', 'tts'];

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { marginTop: spacing.sm, marginBottom: spacing.lg },
  kicker: { ...typography.micro, color: colors.accent },
  title: { ...typography.display, color: colors.text, marginTop: spacing.xs },
  subtitle: { ...typography.body, color: colors.textMuted, lineHeight: 21, marginTop: spacing.sm },
  errorBox: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  saved: { ...typography.caption, color: colors.success, marginBottom: spacing.md },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  statusTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  statusTitle: { ...typography.bodyStrong, color: colors.text },
  statusSub: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  modeRow: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  modeRowOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  modeTitle: { ...typography.bodyStrong, color: colors.text },
  modeDetail: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  coverageTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coverageCount: { ...typography.micro, color: colors.textFaint },
  body: { ...typography.caption, color: colors.textMuted, lineHeight: 19, marginTop: spacing.sm },
  hint: { ...typography.caption, color: colors.textFaint, lineHeight: 18, marginTop: spacing.sm },
  warn: { ...typography.caption, color: colors.warning, marginTop: spacing.sm, lineHeight: 18 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  switch: {
    width: 42,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceHigh,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.primaryTint },
  knob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.textFaint },
  knobOn: { backgroundColor: colors.primary, alignSelf: 'flex-end' },
  fieldLabel: { ...typography.micro, color: colors.textFaint, marginTop: spacing.lg },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  chip: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipText: { ...typography.caption, color: colors.text, fontWeight: '700' },
  chipTextOn: { color: colors.primary },
  chipMeta: { ...typography.micro, color: colors.textFaint, marginTop: 2, letterSpacing: 0.2 },
  chipMetaOn: { color: colors.primary },
  hardwareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hardwareSize: { ...typography.micro, color: colors.textFaint },
  footer: {
    ...typography.caption,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
});
