import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { getLanguage, type Language } from '@/data/languages';
import {
  buildSystemPrompt,
  lessonGrounding,
  parseTutorPayload,
  scriptMatches,
  type TutorMessage,
} from '@/lib/aiCore';
import { findBundledLesson } from '@/data/curriculum';
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
import { EngineFailed, RequestCancelled } from '@/lib/models/types';
import {
  holdUtterance,
  matchVoice,
  releaseUtterance,
  speechErrorMessage,
  toVoiceLike,
  type VoiceLike,
} from '@/lib/speech';

export type { TutorMessage } from '@/lib/aiCore';
export type { AiStatus } from '@/lib/models/status';

/**
 * AI tutor engine — open-source model layer.
 *
 * Transport order is decided by the learner's settings (`src/lib/models`):
 * the app owner's tutor server (which can front any OpenAI-compatible model),
 * a browser model via Transformers.js, then the bundled offline coach. The
 * learner never configures a model, and no paid inference API is called by
 * default.
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
  // An owner-hosted deployment can point the app at its own gateway without a
  // rebuild-time backend URL. Public address only — never a credential.
  const configured = (process.env.EXPO_PUBLIC_AI_GATEWAY_URL ?? '').trim().replace(/\/+$/, '');
  const base = io?.apiBase || configured || NEON_API_URL || undefined;
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
  /** Aborts the turn (the Speak screen's Stop button, or leaving the screen). */
  signal?: AbortSignal;
  /** The bundled lesson being studied — grounds the answer in course content. */
  lessonId?: string;
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

  // Resolve the lesson from the bundled curriculum (the same data the proxy
  // uses), so local and browser runtimes get the identical grounding.
  const lesson = opts.lessonId ? findBundledLesson(opts.language.id, opts.lessonId) : null;

  const system = buildSystemPrompt({
    language: opts.language,
    level,
    scenarioTitle: opts.scenarioTitle,
    learnerName: opts.learnerName,
    explanationLanguage: opts.explanationLanguage,
    profile: opts.profile,
    lesson: lesson ? lessonGrounding(lesson) : undefined,
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
      lessonId: lesson?.id,
    },
  };

  const answer = await runChat(settings, { ...call, signal: opts.signal }, ctx);

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
  // Never retry a turn the learner already cancelled.
  if (opts.signal?.aborted) throw new RequestCancelled(answer.runtime);
  const retry = await runChat(
    settings,
    {
      ...call,
      temperature: 0.6,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Reply again, ONLY in ${opts.language.name}.` },
      ],
      signal: opts.signal,
    },
    ctx
  ).catch((err) => {
    if (err instanceof RequestCancelled) throw err;
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

/* ── Speech output (device/browser voices) ─────────────────────────────── */

type SpeechErrorListener = (message: string) => void;
let speechErrorListener: SpeechErrorListener | null = null;
let warnedMissingVoice = false;

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
 * Native uses `expo-speech` (the OS engine). Web uses the Web Speech API
 * directly, because the shim turned normal events (a new utterance replacing
 * an old one) into visible "playback failed" errors on Android Chrome.
 */
export async function speakNative(text: string, ttsLocale: string, rate = 0.92): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) return;

  if (Platform.OS === 'web') {
    try {
      await speakInBrowser(trimmed, ttsLocale, rate);
    } catch (err) {
      reportSpeechError(
        err instanceof Error && err.message
          ? err.message
          : 'Speech playback is unavailable in this browser — the text is still there to read.'
      );
    }
    return;
  }

  try {
    await Speech.stop().catch(() => undefined);
    await speakWithCallbacks(trimmed, { language: ttsLocale, rate, pitch: 1.0 });
  } catch (err) {
    reportSpeechError(
      err instanceof Error && err.message
        ? err.message
        : 'Speech playback failed — try again.'
    );
  }
}

/** Resolves when voices are listed; some browsers populate them lazily. */
function loadVoices(synthesis: SpeechSynthesis): Promise<VoiceLike[]> {
  const immediate = synthesis.getVoices();
  if (immediate.length > 0) return Promise.resolve(toVoiceLike(immediate));
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      synthesis.removeEventListener('voiceschanged', done);
      resolve(toVoiceLike(synthesis.getVoices()));
    };
    synthesis.addEventListener('voiceschanged', done);
    setTimeout(done, 1_200);
  });
}

/**
 * One utterance, one promise.
 *
 * - `interrupted` / `canceled` resolve silently: they mean a newer request
 *   replaced this one, which is the normal "tap Listen twice" path.
 * - A missing locale voice falls back to the default voice once, with a note.
 * - The utterance is held in a module-level set: Chrome on Android otherwise
 *   garbage-collects it mid-sentence and `onend` never fires.
 */
function speakInBrowser(text: string, locale: string, rate: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      reject(
        new Error(
          'This browser cannot play speech. The text is still there to read — try Chrome or Safari.'
        )
      );
      return;
    }
    const synthesis = window.speechSynthesis;

    void (async () => {
      // Speak in the same tick as the tap when the voice list is already
      // populated: Android Chrome can refuse an utterance whose activation
      // went stale during a long await.
      const voices = await loadVoices(synthesis);
      const voice = matchVoice(voices, locale);

      // Only cancel when something is actually playing — an unconditional
      // cancel() is what makes Android emit a spurious error for the new line.
      if (synthesis.speaking || synthesis.pending) {
        synthesis.cancel();
        await new Promise((done) => setTimeout(done, 40));
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = locale;
      utterance.rate = Math.min(2, Math.max(0.5, rate));
      utterance.pitch = 1;
      if (voice?.identifier) {
        // Browser voices are keyed by `name`, which `toVoiceLike` stored as
        // the identifier — this is the actual voice the learner will hear.
        const installed = synthesis.getVoices().find((item) => item.name === voice.identifier);
        if (installed) utterance.voice = installed;
      }

      let settled = false;
      let started = false;
      let startCheck: ReturnType<typeof setTimeout> | undefined;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        releaseUtterance(utterance);
        clearTimeout(guard);
        if (startCheck) clearTimeout(startCheck);
        if (error) reject(error);
        else resolve();
      };

      utterance.onstart = () => {
        started = true;
        if (startCheck) clearTimeout(startCheck);
      };
      utterance.onend = () => finish();
      utterance.onerror = (event) => {
        const code = (event as SpeechSynthesisErrorEvent).error;
        const message = speechErrorMessage(code, locale);
        // Silent codes resolve; unknown noise does not fail the tap either.
        finish(message ? new Error(message) : undefined);
      };

      // Safety net: some Android builds never fire onend.
      const guard = setTimeout(() => finish(), Math.min(90_000, 4_000 + text.length * 180));

      if (!voice && !warnedMissingVoice) {
        warnedMissingVoice = true;
        reportSpeechError(
          `No ${locale} voice is installed on this device — playing with the default voice.`
        );
      }

      holdUtterance(utterance);
      try {
        synthesis.speak(utterance);
        // Nothing started: blocked by the embedding page, silent mode, or a
        // stuck engine. Saying so beats a dead tap.
        startCheck = setTimeout(() => {
          if (started || settled) return;
          finish(
            new Error(
              'Audio didn’t start. Check the media volume, or open Babelish in its own browser tab.'
            )
          );
        }, 2_500);
        // Chrome pauses long utterances at ~15 s; nudging resume keeps it going.
        const keepAlive = setInterval(() => {
          if (!synthesis.speaking || synthesis.paused) {
            clearInterval(keepAlive);
            return;
          }
          synthesis.resume();
        }, 8_000);
        setTimeout(() => clearInterval(keepAlive), 120_000);
      } catch (err) {
        finish(
          err instanceof Error
            ? err
            : new Error(
                'Speech playback is unavailable in this browser — the text is still there to read.'
              )
        );
      }
    })();
  });
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
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
    return;
  }
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
  io?: AiTransport | null,
  opts: { signal?: AbortSignal } = {}
): Promise<string> {
  const settings = getModelSettings();
  const ctx = gatewayContext(io);

  const candidates = sttCandidates(settings, ctx);
  if (candidates.length === 0) {
    throw new Error(
      settings.mode === 'offline'
        ? 'Voice input needs a speech model — the offline coach is text-only. Type your reply instead.'
        : 'Voice input is unavailable right now — type your reply instead.'
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
      `Speech recognition is not available for ${language.name} yet — type your reply instead.`
    );
  }

  const answer = await runTranscribe(settings, audioUri, languageId, ctx, {
    signal: opts.signal,
  });
  if (!answer) {
    throw new Error(
      'Voice input is unavailable right now — type instead.'
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
