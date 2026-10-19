import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { getLanguage, type Language } from '@/data/languages';
import {
  buildSystemPrompt,
  extractTutorReply,
  parseTutorPayload,
  scriptMatches,
  type AiChatRequest,
  type TutorMessage,
} from '@/lib/aiCore';import type { ProfileContext } from '@/lib/profilePrompt';
import { appendTranscriptionFields, prepareAudioPart } from '@/lib/sttUpload';
import { showAlert } from '@/lib/alert';

export type { TutorMessage } from '@/lib/aiCore';

/**
 * AI tutor engine.
 *
 * Two transports, tried in order:
 *   1. **Backend proxy** (`POST /api/ai/chat`, `POST /api/ai/stt` on the app's
 *      Neon Function, authenticated with the learner's JWT): the provider key
 *      lives in the Function environment and never enters the client bundle —
 *      the production-safe path (see docs/DEPLOYMENT.md).
 *   2. **Direct** OpenAI-compatible endpoint via `EXPO_PUBLIC_AI_*` env — a
 *      development convenience. Because EXPO_PUBLIC_* values ship inside the
 *      bundle, they must only ever hold a restricted, non-privileged key.
 *
 * With neither configured, tutor replies are scripted demo lines — always
 * labeled "Demo tutor" in the UI, never passed off as a live model. Real-mode
 * failures surface as visible errors; they are never answered with scripted
 * text.
 */

const API_URL = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/+$/, '');
const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini';
const STT_MODEL = process.env.EXPO_PUBLIC_AI_STT_MODEL ?? 'whisper-1';

export const isAIConfigured = Boolean(
  API_URL && API_KEY && !API_KEY.includes('your-key') && !API_KEY.includes('sk-...')
);

/** How a call reaches AI: through the app backend (proxy) or directly. */
export type AiTransport = { apiBase: string; jwt?: string | null };

function usable(io?: AiTransport | null): io is AiTransport {
  return Boolean(io?.apiBase && io.jwt);
}

export type TutorReply = {
  text: string;
  translation: string;
  tip?: string;
};

export type TutorOptions = {
  language: Language;
  history: TutorMessage[];
  learnerName?: string;
  scenarioTitle?: string;
  level?: string;
  /** Learner profile — injected as example-flavored context in the prompt. */
  profile?: ProfileContext;
};

/** Which AI transports actually work right now (for honest UI status rows). */
export type AiStatus = {
  chat: boolean;
  stt: boolean;
  source: 'proxy' | 'direct' | 'none';
};

/**
 * Asks the backend proxy which AI capabilities are configured server-side,
 * then combines that with the direct (EXPO_PUBLIC_AI_*) config. Returns null
 * when nothing can be determined (e.g. offline) so callers keep their
 * build-time knowledge instead of guessing.
 */
export async function fetchAiStatus(io?: AiTransport | null): Promise<AiStatus | null> {
  let proxy: { chat: boolean; stt: boolean } | null = null;
  if (usable(io)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${io.apiBase}/api/ai/status`, {
        headers: { Authorization: `Bearer ${io.jwt}` },
        signal: controller.signal,
      });
      if (res.ok) {
        const json = (await res.json().catch(() => null)) as {
          chat?: unknown;
          stt?: unknown;
        } | null;
        if (json) proxy = { chat: json.chat === true, stt: json.stt === true };
      }
    } catch {
      // offline / expired session — leave proxy unknown
    } finally {
      clearTimeout(timer);
    }
  }
  const chat = (proxy?.chat ?? false) || isAIConfigured;
  const stt = (proxy?.stt ?? false) || isAIConfigured;
  const source: AiStatus['source'] =
    proxy && (proxy.chat || proxy.stt) ? 'proxy' : isAIConfigured ? 'direct' : 'none';
  if (!chat && !stt && !proxy && !isAIConfigured && !io) {
    // No transport was even attempted (no io, no direct config): this is a
    // definitive "nothing configured", not a failed probe.
    return { chat: false, stt: false, source: 'none' };
  }
  return { chat, stt, source };
}

/** Builds the native-speaker persona that governs every AI response. */
export { buildSystemPrompt };

/**
 * Tutor reply pipeline. Transports are tried in order:
 *   1. Backend proxy (JWT) — key lives server-side; a 503 "not configured"
 *      falls through, every other failure is surfaced to the learner.
 *   2. Direct EXPO_PUBLIC_AI_* config (development).
 *   3. Scripted demo lines — only when nothing is configured, and the UI
 *      labels them "Demo tutor".
 * Real-mode failures THROW. They are never answered with scripted text.
 */
export async function tutorReply(
  opts: TutorOptions,
  io?: AiTransport | null
): Promise<TutorReply> {
  if (usable(io)) {
    const proxied = await proxyChat(io, opts);
    if (proxied) return proxied;
  }

  if (isAIConfigured) {
    const sys = buildSystemPrompt({
      language: opts.language,
      level: opts.level ?? 'A2',
      scenarioTitle: opts.scenarioTitle,
      learnerName: opts.learnerName,
      profile: opts.profile,
    });
    return directChat(sys, opts);
  }

  return demoReply(opts.language, opts.history.filter((m) => m.role === 'user').length);
}

/** Maps a proxy/direct HTTP failure to a learner-facing, recoverable message. */
function chatHttpError(status: number, json: { error?: string; message?: string } | null): string {
  if (status === 401) return 'Your session expired — sign in again to keep chatting.';
  if (status === 403) return 'This account cannot use the tutor — contact support.';
  if (status === 429) return 'The tutor is busy — wait a minute and try again.';
  if (status >= 500) return 'The tutor service hit a problem — try again in a moment.';
  return (
    json?.message || json?.error || `Tutor request failed (HTTP ${status}) — try again.`
  );
}

/** Returns the proxy reply, or null when the proxy has no AI configured. */
async function proxyChat(io: AiTransport, opts: TutorOptions): Promise<TutorReply | null> {
  const body: AiChatRequest = {
    languageId: opts.language.id,
    level: opts.level,
    scenarioTitle: opts.scenarioTitle,
    learnerName: opts.learnerName,
    profile: opts.profile,
    history: opts.history.map((m) => ({ role: m.role, text: m.text })),
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${io.apiBase}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${io.jwt}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      reply?: string;
      translation?: string;
      tip?: string;
      error?: string;
      message?: string;
    } | null;

    if (res.ok && json && typeof json.reply === 'string' && json.reply.trim()) {
      // Re-validate locally (including the non-Latin-script guard) so a stale
      // or misbehaving backend can never push out-of-language text into the
      // conversation as if the tutor had said it.
      const reply = extractTutorReply(
        JSON.stringify({
          reply: json.reply,
          translation: json.translation ?? '',
          tip: json.tip,
        }),
        opts.language
      );
      return { text: reply.text, translation: reply.translation, tip: reply.tip };
    }
    if (res.status === 503 && json?.error === 'ai-not-configured') return null;
    throw new Error(chatHttpError(res.status, json));
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The tutor took too long to answer — try again.');
    }
    if (err instanceof TypeError) {
      throw new Error('Could not reach the tutor — check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function directChat(sys: string, opts: TutorOptions): Promise<TutorReply> {
  const raw = await directCompletion(sys, opts, 0.8);
  const parsed = parseTutorPayload(raw);
  if (!parsed.text) throw new Error('The tutor returned an empty reply — try again.');
  if (scriptMatches(parsed.text, opts.language)) {
    return { text: parsed.text, translation: parsed.translation, tip: parsed.tip };
  }

  // Guardrail: non-Latin-script languages get one retry if the model slipped
  // into English — then fail honestly instead of showing an out-of-language
  // line as if the tutor had said it in the target language.
  const retryRaw = await directCompletion(sys, opts, 0.6, true).catch(() => null);
  if (retryRaw) {
    const retry = parseTutorPayload(retryRaw);
    if (retry.text && scriptMatches(retry.text, opts.language)) {
      return { text: retry.text, translation: retry.translation, tip: retry.tip };
    }
  }
  throw new Error(
    `The tutor replied in the wrong language for ${opts.language.name} — try again.`
  );
}

async function directCompletion(
  sys: string,
  opts: TutorOptions,
  temperature: number,
  isRetry = false
): Promise<string> {
  const messages = isRetry
    ? [
        { role: 'system', content: sys },
        { role: 'user', content: `Reply again, ONLY in ${opts.language.name}.` },
      ]
    : [
        { role: 'system', content: sys },
        ...opts.history.map((m) => ({ role: m.role, content: m.text })),
      ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, temperature, messages }),
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(chatHttpError(res.status, json));
    }
    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('The tutor took too long to answer — try again.');
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Could not reach the AI endpoint — check EXPO_PUBLIC_AI_API_URL and your connection.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ── Speech (device/browser voices via expo-speech) ─────────────────────── */

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
 * Hardened for the failure modes behind "no audio comes out":
 *  - embedded views (iframes) without the speech-synthesis allow-policy expose
 *    no `window.speechSynthesis` at all — the library then rejects an
 *    unawaited promise and playback dies with zero feedback. We pre-check and
 *    say so instead;
 *  - Chrome can drop an utterance enqueued in the same turn as
 *    `cancel()` — we wait a beat after stopping;
 *  - a locale with no installed voice gets an honest one-time notice while
 *    still playing through the default voice (audible, correctly labeled);
 *  - native TTS errors (missing engine, muted device) arrive via onError and
 *    are surfaced instead of ignored.
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

      // getVoices() can hang until the browser populates its voice list;
      // treat a timeout (null) as "unknown" and let the engine pick itself.
      const voices = await Promise.race([
        Speech.getAvailableVoicesAsync().catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1_500)),
      ]);

      if (voices && voices.length === 0) {
        throw new Error('This browser has no speech voices — text-to-speech is unavailable.');
      } else if (voices) {
        const base = ttsLocale.split('-')[0].toLowerCase();
        const match = voices.find((v) =>
          (v.language ?? '').toLowerCase().replace('_', '-').startsWith(base)
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
    // Safety net: some engines never fire onDone when playback is cut short.
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

/* ── Speech-to-text (OpenAI-compatible /audio/transcriptions) ────────────── */

/**
 * Transcribes a recorded audio file to text in the target language.
 *
 * Transport order matches the chat tutor: backend proxy first (key stays
 * server-side), then a direct EXPO_PUBLIC_AI_* config. With neither, this
 * throws the actionable "needs a key" error — the UI already hides mic
 * actions when voice input is known-unavailable.
 *
 * The upload itself goes through `prepareAudioPart`: on web the recording is
 * a `blob:` URL (MediaRecorder → audio/webm), and the old `{ uri }` object
 * appended to the browser's FormData serialized to "[object Object]", which
 * is why web transcription could never succeed before.
 */
export async function transcribeSpeech(
  audioUri: string,
  languageId: string,
  io?: AiTransport | null
): Promise<string> {
  const audio = await prepareAudioPart(audioUri, Platform.OS);

  if (usable(io)) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    try {
      const form = new FormData();
      form.append('file', audio.part as Blob, audio.filename);
      form.append('language', languageId);

      const res = await fetch(`${io.apiBase}/api/ai/stt`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${io.jwt}` },
        body: form,
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => null)) as {
        text?: string;
        error?: string;
        message?: string;
      } | null;

      if (res.ok) {
        const text = String(json?.text ?? '').trim();
        if (!text) throw new Error("I couldn't catch that — try again or type instead.");
        return text;
      }
      if (res.status === 503 && json?.error === 'ai-not-configured') {
        // Proxy has no AI key — fall through to the direct config below.
      } else {
        throw new Error(sttHttpError(res.status, json));
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('Transcription took too long — try again.');
      }
      if (err instanceof TypeError) {
        throw new Error('Could not reach the transcription service — check your connection.');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  if (!isAIConfigured || !API_URL || !API_KEY) {
    throw new Error(
      'Voice input needs an AI key — set AI_API_KEY on the api Function (production) or EXPO_PUBLIC_AI_API_KEY (dev).'
    );
  }

  const form = new FormData();
  appendTranscriptionFields(form, audio, { model: STT_MODEL, languageId });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(`${API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${API_KEY}` },
      body: form,
      signal: controller.signal,
    });
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(sttHttpError(res.status, json));
    }
    const data = (await res.json()) as { text?: string };
    const text = String(data?.text ?? '').trim();
    if (!text) throw new Error("I couldn't catch that — try again or type instead.");
    return text;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Transcription took too long — try again.');
    }
    if (err instanceof TypeError) {
      throw new Error(
        'Could not reach the AI endpoint — check EXPO_PUBLIC_AI_API_URL and your connection.'
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Maps a transcription HTTP failure to a learner-facing, recoverable message. */
function sttHttpError(
  status: number,
  json: { error?: string; message?: string } | null
): string {
  if (status === 401 || status === 403) {
    return 'The voice service rejected its credentials — check the AI key configuration.';
  }
  if (status === 413) return 'That recording is too long — keep it under 30 seconds.';
  if (status === 429) return 'Voice service is rate-limited — try again in a moment.';
  if (status >= 500) return 'Voice service is unavailable right now — try again.';
  return (
    json?.message || json?.error || `Transcription failed (HTTP ${status}) — try again or type instead.`
  );
}

/* ── Demo mode: scripted native lines per language ──────────────────────── */

const DEMO_LINES: Record<string, { text: string; translation: string }[]> = {
  es: [
    {
      text: '¡Hola! Me alegra mucho verte. ¿Cómo estás hoy?',
      translation: "Hi! I'm really glad to see you. How are you today?",
    },
    {
      text: 'Perfecto. Cuéntame algo sobre ti: ¿a qué te dedicas?',
      translation: 'Perfect. Tell me something about yourself: what do you do?',
    },
    {
      text: '¡Muy bien! Imagina que estamos en un café en Madrid. ¿Qué te gustaría pedir?',
      translation: "Excellent! Imagine we're in a café in Madrid. What would you like to order?",
    },
  ],
  ar: [
    {
      text: 'أهلاً وسهلاً! كيف حالك اليوم؟',
      translation: 'Welcome! How are you today?',
    },
    {
      text: 'جميل جداً. حدّثني عن نفسك: ماذا تحب أن تفعل في وقت فراغك؟',
      translation: 'Very nice. Tell me about yourself: what do you like to do in your free time?',
    },
    {
      text: 'ممتاز. تخيّل أننا في سوق قديم. ماذا تريد أن تشتري؟',
      translation: "Excellent. Imagine we're in an old market. What do you want to buy?",
    },
  ],
  zh: [
    {
      text: '你好！很高兴见到你。你今天怎么样？',
      translation: 'Hello! Nice to meet you. How are you today?',
    },
    {
      text: '很好。跟我说说你自己吧：你是做什么工作的？',
      translation: 'Good. Tell me about yourself: what do you do for work?',
    },
    {
      text: '太好了。想象我们在北京的一家小餐馆。你想点什么菜？',
      translation: "Great. Imagine we're in a small restaurant in Beijing. What would you like to order?",
    },
  ],
  fr: [
    {
      text: "Bonjour ! Ravie de te rencontrer. Comment vas-tu aujourd'hui ?",
      translation: 'Hello! Lovely to meet you. How are you doing today?',
    },
    {
      text: 'Très bien. Parle-moi de toi : tu fais quoi dans la vie ?',
      translation: 'Very good. Tell me about yourself: what do you do in life?',
    },
    {
      text: "Parfait. Imagine qu'on est dans un bistro à Paris. Tu commandes quoi ?",
      translation: "Perfect. Imagine we're in a bistro in Paris. What do you order?",
    },
  ],
  hi: [
    {
      text: 'नमस्ते! आपसे मिलकर अच्छा लगा। आज आप कैसे हैं?',
      translation: 'Hello! Nice to meet you. How are you today?',
    },
    {
      text: 'बढ़िया! अपने बारे में बताइए — आप क्या करते हैं?',
      translation: 'Great! Tell me about yourself — what do you do?',
    },
    {
      text: 'कल्पना कीजिए कि हम दिल्ली के एक बाज़ार में हैं। आप क्या खरीदना चाहेंगे?',
      translation: "Imagine we're in a market in Delhi. What would you like to buy?",
    },
  ],
  ja: [
    {
      text: 'こんにちは！お会いできて嬉しいです。今日はお元気ですか？',
      translation: "Hello! I'm happy to meet you. How are you today?",
    },
    {
      text: 'よかったです。自己紹介してください：お仕事は何ですか？',
      translation: 'Glad to hear it. Please introduce yourself: what is your job?',
    },
    {
      text: 'いいですね。コンビニにいると想像してください。何を買いますか？',
      translation: "Nice. Imagine you're at a convenience store. What do you buy?",
    },
  ],
  de: [
    {
      text: 'Hallo! Schön, dich kennenzulernen. Wie geht es dir heute?',
      translation: 'Hello! Nice to meet you. How are you today?',
    },
    {
      text: 'Super. Erzähl mir von dir: Was machst du beruflich?',
      translation: 'Great. Tell me about yourself: what do you do professionally?',
    },
    {
      text: 'Perfekt. Stell dir vor, wir sind in einer Bäckerei in Berlin. Was möchtest du bestellen?',
      translation: "Perfect. Imagine we're in a bakery in Berlin. What would you like to order?",
    },
  ],
  pt: [
    {
      text: 'Olá! Que bom te conhecer. Como você está hoje?',
      translation: 'Hello! Good to meet you. How are you today?',
    },
    {
      text: 'Ótimo. Me conta mais sobre você: com o que você trabalha?',
      translation: 'Great. Tell me more about yourself: what do you do for work?',
    },
    {
      text: 'Perfeito. Imagina que a gente está numa praia no Rio. O que você vai pedir?',
      translation: "Perfect. Imagine we're on a beach in Rio. What are you going to order?",
    },
  ],
  ru: [
    {
      text: 'Привет! Рада тебя видеть. Как у тебя дела сегодня?',
      translation: 'Hi! Glad to see you. How are you today?',
    },
    {
      text: 'Отлично. Расскажи о себе: кем ты работаешь?',
      translation: 'Excellent. Tell me about yourself: what do you do?',
    },
    {
      text: 'Хорошо. Представь, что мы в кофейне в Москве. Что ты закажешь?',
      translation: "Good. Imagine we're in a café in Moscow. What will you order?",
    },
  ],
  sw: [
    {
      text: 'Habari! Ninafurahi kukutana nawe. Habari yako leo?',
      translation: "Hello! I'm happy to meet you. How are you today?",
    },
    {
      text: 'Nzuri. Nambie kitu kukuhusu wewe: unafanya kazi gani?',
      translation: 'Good. Tell me something about yourself: what work do you do?',
    },
    {
      text: 'Vizuri. Fikiria tuko sokoni mjini Nairobi. Unataka kununua nini?',
      translation: "Good. Imagine we're in a market in Nairobi. What do you want to buy?",
    },
  ],
};

/** Cycles through scripted native lines when no AI key is configured. */
export function demoReply(language: Language, userTurnCount: number): TutorReply {
  const lines = DEMO_LINES[language.id] ?? DEMO_LINES[getLanguage('es').id];
  const line = lines[userTurnCount % lines.length];
  return { text: line.text, translation: line.translation };
}
