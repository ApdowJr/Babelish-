import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { getLanguage, type Language } from '@/data/languages';
import {
  buildSystemPrompt,
  parseTutorPayload,
  scriptMatches,
  type TutorMessage,
} from '@/lib/aiCore';
import type { ProfileContext } from '@/lib/profilePrompt';
import { showAlert } from '@/lib/alert';
import { getModelSettings } from '@/lib/models/settings';
import {
  fetchAiStatus as probeModelEngines,
  type AiStatus,
} from '@/lib/models/status';
import { runChat } from '@/lib/models/chat';
import { runTranscribe } from '@/lib/models/stt';
import { offlineTutorReply } from '@/lib/models/offlineTutor';
import {
  languageSupport,
  sttCandidates,
  sttModelForRuntime,
} from '@/lib/models/config';
import { NEON_API_URL } from '@/lib/neon';
import type { RuntimeId } from '@/lib/models/types';
import { EngineFailed } from '@/lib/models/types';

export type { TutorMessage } from '@/lib/aiCore';
export type { AiStatus } from '@/lib/models/status';

/**
 * AI tutor engine — open-source model layer.
 *
 * Transport order is decided by the learner's settings (`src/lib/models`):
 * a local Ollama/OpenAI-compatible server, the app owner's self-hosted
 * gateway, a browser model via Transformers.js, then the bundled offline
 * coach. No paid third-party inference API is ever called by default.
 *
 * Honesty rules kept from 2.0:
 *   - a model that runs and fails surfaces a visible error — it is never
 *     replaced with scripted text;
 *   - the offline coach is labelled as such in every reply;
 *   - live/demo badges are driven by real probes, not by hope.
 */

/** Kept for older call sites: a local/LAN endpoint counts as "configured". */
export const isAIConfigured = Boolean(
  (process.env.EXPO_PUBLIC_OLLAMA_URL ?? '').replace(/\s/g, '') ||
    (process.env.EXPO_PUBLIC_AI_API_URL ?? '').replace(/\s/g, '')
);

/** How a call reaches the app owner's gateway: base URL + learner JWT. */
export type AiTransport = { apiBase: string; jwt?: string | null };

function gatewayContext(io?: AiTransport | null) {
  const base = io?.apiBase || NEON_API_URL || undefined;
  return {
    gatewayBase: base || null,
    jwt: io?.jwt ?? null,
    browserSupported: typeof WebAssembly === 'object',
  };
}

export type TutorReply = {
  text: string;
  translation: string;
  tip?: string;
  /** Which engine produced this turn — `offline` is the bundled coach. */
  runtime?: RuntimeId | 'offline';
  model?: string;
  /** Inference time in ms (0 for the offline coach). */
  ms?: number;
};

export type TutorOptions = {
  language: Language;
  history: TutorMessage[];
  learnerName?: string;
  scenarioTitle?: string;
  /** Explicit scenario id — lets the offline coach pick curated phrases. */
  scenarioId?: string;
  level?: string;
  /** Language for translations/tips (defaults to English). */
  explanationLanguage?: string;
  /** Learner profile — injected as example-flavored context in the prompt. */
  profile?: ProfileContext;
};

/**
 * Probes the configured engines (local server, owner gateway, browser) and
 * reports what can actually serve a turn right now. Never throws; `detail`
 * explains what happened without leaking URLs' credentials (there are none).
 */
export async function fetchAiStatus(io?: AiTransport | null): Promise<AiStatus> {
  return probeModelEngines(getModelSettings(), gatewayContext(io));
}

/**
 * Tutor reply pipeline.
 *
 * 1. Run the configured open-source engine chain.
 * 2. Validate the answer (JSON contract + target-script guardrail), with one
 *    corrective retry for non-Latin scripts.
 * 3. If no engine ran, answer from the bundled offline coach — labelled.
 */
export async function tutorReply(
  opts: TutorOptions,
  io?: AiTransport | null
): Promise<TutorReply> {
  const settings = getModelSettings();
  const ctx = gatewayContext(io);
  const level = opts.level ?? 'A2';

  const system = buildSystemPrompt({
    language: opts.language,
    level,
    scenarioTitle: opts.scenarioTitle,
    learnerName: opts.learnerName,
    explanationLanguage: opts.explanationLanguage,
    profile: opts.profile,
  });

  const messages = [
    { role: 'system' as const, content: system },
    ...opts.history.map((message) => ({
      role: message.role,
      content: message.text,
    })),
  ];

  const call = {
    messages,
    languageId: opts.language.id,
    temperature: 0.8,
    maxTokens: 320,
    meta: {
      languageId: opts.language.id,
      level,
      scenarioTitle: opts.scenarioTitle,
      learnerName: opts.learnerName,
      explanationLanguage: opts.explanationLanguage,
      profile: opts.profile as Record<string, unknown> | undefined,
    },
  };

  const answer = await runChat(settings, call, ctx);

  if (!answer) {
    // Nothing ran: bundled coach, clearly labelled in the tip.
    const turn = opts.history.filter((message) => message.role === 'assistant').length;
    const offline = offlineTutorReply({
      languageId: opts.language.id,
      scenarioId: opts.scenarioId,
      turn,
    });
    const englishOnly =
      opts.explanationLanguage && !/^english$/i.test(opts.explanationLanguage.trim())
        ? ` Bundled card meanings are in English, not ${opts.explanationLanguage}.`
        : '';
    return {
      text: offline.text,
      translation: offline.translation,
      tip: `${offline.tip}${englishOnly}`,
      runtime: 'offline',
      ms: 0,
    };
  }

  const parsed = parseTutorPayload(answer.text);
  if (!parsed.text) {
    throw new Error('The tutor returned an empty reply — try again.');
  }
  if (scriptMatches(parsed.text, opts.language)) {
    return {
      text: parsed.text,
      translation: parsed.translation,
      tip: parsed.tip,
      runtime: answer.runtime,
      model: answer.model,
      ms: answer.ms,
    };
  }

  // Wrong-script guardrail: one corrective retry, then fail honestly.
  const retry = await runChat(
    settings,
    {
      ...call,
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Reply again, ONLY in ${opts.language.name}.` },
      ],
    },
    ctx
  ).catch((err) => {
    if (err instanceof EngineFailed) return null;
    throw err;
  });

  if (retry) {
    const parsedRetry = parseTutorPayload(retry.text);
    if (parsedRetry.text && scriptMatches(parsedRetry.text, opts.language)) {
      return {
        text: parsedRetry.text,
        translation: parsedRetry.translation,
        tip: parsedRetry.tip,
        runtime: retry.runtime,
        model: retry.model,
        ms: answer.ms + retry.ms,
      };
    }
  }

  throw new Error(`The tutor replied in the wrong language for ${opts.language.name} — try again.`);
}

/* ── Speech output (device/browser voices via expo-speech) ─────────────── */

type SpeechErrorListener = (message: string) => void;
let speechErrorListener: SpeechErrorListener | null = null;
let warnedVoiceFallback = false;

/**
 * Screens can register a banner-style listener (the Speak screen does); when
 * none is registered, failures surface through `showAlert` so audio problems
 * are never silent — react-native-web's own Alert is a no-op stub.
 */
export function setSpeechErrorListener(listener: SpeechErrorListener | null): void {
  speechErrorListener = listener;
}

function reportSpeechError(message: string): void {
  if (speechErrorListener) speechErrorListener(message);
  else showAlert('Audio unavailable', message, [{ text: 'OK' }]);
}

/**
 * Speaks text with the locale's native voice, e.g. es-ES, ar-EG, ja-JP.
 *
 * This is the OS voice engine (`expo-speech`) — the `device` TTS option. A
 * self-hosted neural TTS server can be selected in Settings, but playback
 * still uses this path until an audio URL is returned; the UI says so.
 */
export async function speakNative(text: string, ttsLocale: string, rate = 0.92): Promise<void> {
  if (!text.trim()) return;
  try {
    void Speech.stop().catch(() => undefined);

    let voice: string | undefined;
    if (Platform.OS === 'web') {
      await new Promise((resolve) => setTimeout(resolve, 60));

      const synthesis = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      if (!synthesis) {
        throw new Error(
          'Speech playback is blocked in this view — open Babelish in a normal browser tab to hear audio.'
        );
      }

      const voices = await Promise.race([
        Speech.getAvailableVoicesAsync().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
      ]);

      if (voices && voices.length === 0) {
        throw new Error('This browser has no speech voices — text-to-speech is unavailable.');
      } else if (voices) {
        const base = ttsLocale.split('-')[0].toLowerCase();
        const match = voices.find((candidate) =>
          (candidate.language ?? '').toLowerCase().replace('_', '-').startsWith(base)
        );
        if (match) voice = match.identifier;
        else if (!warnedVoiceFallback) {
          warnedVoiceFallback = true;
          reportSpeechError(
            `No ${ttsLocale} voice is installed on this device — playing with the default voice.`
          );
        }
      }
    }

    await speakWithCallbacks(text, { language: ttsLocale, rate, pitch: 1.0, voice });
  } catch (err) {
    reportSpeechError(
      err instanceof Error && err.message ? err.message : 'Speech playback failed — try again.'
    );
  }
}

/** Resolves when playback finishes/stops; rejects on engine errors. */
function speakWithCallbacks(text: string, opts: Speech.SpeechOptions): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    const ok = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const fail = (error?: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error('Speech playback failed — try again.'));
    };
    const timer = setTimeout(ok, Math.min(60_000, 2_000 + text.length * 150));
    try {
      Speech.speak(text, {
        ...opts,
        onDone: () => {
          clearTimeout(timer);
          ok();
        },
        onStopped: () => {
          clearTimeout(timer);
          ok();
        },
        onError: (error) => {
          clearTimeout(timer);
          fail(error);
        },
      });
    } catch (err) {
      clearTimeout(timer);
      fail(err);
    }
  });
}

export function stopSpeaking(): void {
  void Speech.stop().catch(() => undefined);
}

/* ── Speech input (open-source STT adapters) ───────────────────────────── */

/**
 * Transcribes a recorded clip with the first available open-source STT
 * runtime (owner gateway → local Whisper server → in-browser Whisper).
 *
 * Throws an actionable message when nothing is configured, so the mic can be
 * disabled with a real explanation instead of failing after a recording.
 */
export async function transcribeSpeech(
  audioUri: string,
  languageId: string,
  io?: AiTransport | null
): Promise<string> {
  const settings = getModelSettings();
  const ctx = gatewayContext(io);

  const candidates = sttCandidates(settings, ctx);
  if (candidates.length === 0) {
    throw new Error(
      settings.mode === 'offline'
        ? 'Voice input needs a speech model — the offline coach is text-only. Type your reply instead.'
        : 'No speech model is configured — add one in Settings → AI model, or type instead.'
    );
  }
  // Gate per runtime: the browser uses its own Whisper model id, and a
  // language a model does not document must be opted into explicitly.
  const usable = candidates.filter(
    (runtime) =>
      languageSupport(
        sttModelForRuntime(settings, runtime),
        languageId,
        settings.allowUnverified
      ) === 'ok'
  );
  if (usable.length === 0) {
    const language = getLanguage(languageId);
    throw new Error(
      `${settings.sttModel} does not document ${language.name} transcription — enable “use unverified languages” in Settings to try it.`
    );
  }

  const answer = await runTranscribe(settings, audioUri, languageId, ctx);
  if (!answer) {
    throw new Error(
      'Voice input needs a speech model — set one up in Settings → AI model, or type instead.'
    );
  }
  return answer.text;
}

/* ── Backwards-compatible helpers ──────────────────────────────────────── */

/**
 * The old scripted demo is gone: with no model the app now uses the bundled
 * offline coach. This helper stays for callers that only need a first line
 * and is explicitly labelled as offline content.
 */
export function demoReply(language: Language, userTurnCount: number): TutorReply {
  const offline = offlineTutorReply({ languageId: language.id, turn: userTurnCount });
  return {
    text: offline.text,
    translation: offline.translation,
    tip: offline.tip,
    runtime: 'offline',
    ms: 0,
  };
}

export { buildSystemPrompt };
