/**
 * Model settings — the user-facing knobs of the open-source AI layer.
 *
 * Pure functions only. Persistence lives in `settings.ts`; this module owns
 * defaults, validation (URLs are sanitised, never trusted) and the *plan*:
 * which runtimes should be tried, in which order, for the chosen mode.
 */
import { findModel, coverageFor, type TutorMode } from './catalog';
import type { RuntimeId } from './types';

export type BrowserSettings = {
  /** Off by default: a small model is still a 300–600 MB download. */
  enabled: boolean;
  /** Transformers.js module URL — overridable for air-gapped/self-hosted builds. */
  runtimeUrl: string;
  chatModel: string;
  sttModel: string;
};

export type ModelSettings = {
  mode: TutorMode;
  /** Ollama base URL (default: the local daemon). */
  ollamaUrl: string;
  ollamaModel: string;
  /** Any OpenAI-compatible base URL (llama.cpp, LM Studio, LocalAI…). */
  openaiUrl: string;
  openaiModel: string;
  sttModel: string;
  browser: BrowserSettings;
  /** `device` = expo-speech, `piper`/`kokoro` = a local TTS HTTP server. */
  ttsModel: string;
  /** Allow a model for languages its card does not list (explicit opt-in). */
  allowUnverified: boolean;
  /** CEFR override; `auto` follows the learner's completed lessons. */
  level: 'auto' | 'A1' | 'A2' | 'B1' | 'B2';
};

export const DEFAULT_SETTINGS: ModelSettings = {
  mode: 'auto',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'qwen2.5:1.5b',
  openaiUrl: '',
  openaiModel: 'qwen2.5:1.5b',
  sttModel: 'whisper-large-v3-turbo',
  browser: {
    enabled: false,
    runtimeUrl: 'https://esm.sh/@huggingface/transformers@3.7.5',
    chatModel: 'onnx-community/Qwen2.5-0.5B-Instruct',
    sttModel: 'onnx-community/whisper-base',
  },
  ttsModel: 'device',
  allowUnverified: false,
  level: 'auto',
};

const MODES: TutorMode[] = ['auto', 'local', 'server', 'browser', 'offline'];

/** Environment-provided defaults for owner-hosted deployments. */
export function envDefaults(): Partial<ModelSettings> {
  const url = process.env.EXPO_PUBLIC_OLLAMA_URL;
  const model = process.env.EXPO_PUBLIC_OLLAMA_MODEL;
  const mode = process.env.EXPO_PUBLIC_TUTOR_MODE as TutorMode | undefined;
  return {
    ...(url ? { ollamaUrl: url } : {}),
    ...(model ? { ollamaModel: model } : {}),
    ...(mode && MODES.includes(mode) ? { mode } : {}),
  };
}
const LEVELS: ModelSettings['level'][] = ['auto', 'A1', 'A2', 'B1', 'B2'];

/**
 * Validates and normalises a persisted/partial settings object. Unknown or
 * malformed values fall back to defaults — never to something a URL could
 * smuggle in (no credentials, no query strings, http/https only).
 */
export function normalizeSettings(raw: unknown): ModelSettings {
  const base: ModelSettings = {
    ...DEFAULT_SETTINGS,
    ...envDefaults(),
    browser: { ...DEFAULT_SETTINGS.browser },
  };
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Record<string, unknown>;
  const browserInput =
    input.browser && typeof input.browser === 'object'
      ? (input.browser as Record<string, unknown>)
      : {};

  const mode = MODES.includes(input.mode as TutorMode) ? (input.mode as TutorMode) : base.mode;
  const level = LEVELS.includes(input.level as ModelSettings['level'])
    ? (input.level as ModelSettings['level'])
    : base.level;

  return {
    mode,
    ollamaUrl: sanitizeBaseUrl(asString(input.ollamaUrl)) ?? base.ollamaUrl,
    ollamaModel: asModelId(input.ollamaModel) ?? base.ollamaModel,
    openaiUrl: sanitizeBaseUrl(asString(input.openaiUrl)) ?? '',
    openaiModel: asModelId(input.openaiModel) ?? base.openaiModel,
    sttModel: asModelId(input.sttModel) ?? base.sttModel,
    browser: {
      enabled: browserInput.enabled === true,
      runtimeUrl: sanitizeBaseUrl(asString(browserInput.runtimeUrl)) ?? base.browser.runtimeUrl,
      chatModel: asModelId(browserInput.chatModel) ?? base.browser.chatModel,
      sttModel: asModelId(browserInput.sttModel) ?? base.browser.sttModel,
    },
    ttsModel: ['device', 'piper', 'kokoro-82m'].includes(String(input.ttsModel))
      ? String(input.ttsModel)
      : base.ttsModel,
    allowUnverified: input.allowUnverified === true,
    level,
  };
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Model ids allow `org/name`, `name:tag`, dots and dashes — nothing exotic. */
function asModelId(value: unknown): string | null {
  const id = asString(value);
  if (!id || id.length > 120) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/.test(id)) return null;
  return id;
}

/**
 * Accepts only `http(s)://host[:port][/path]` with no credentials, query or
 * fragment. A model server URL is user input; this keeps it from becoming a
 * way to inject headers or leak tokens into logs.
 */
export function sanitizeBaseUrl(value: string | undefined | null): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.search || url.hash) return null;
  const path = url.pathname.replace(/\/+$/, '');
  return `${url.origin}${path}`;
}

/* ── Which runtime to try ──────────────────────────────────────────────── */

export type EngineContext = {
  /** Set when the app owner deployed the inference gateway. */
  gatewayBase?: string | null;
  jwt?: string | null;
  /** WebAssembly available (web build). */
  browserSupported?: boolean;
};

/** Runtimes that can serve chat, in the order they should be attempted. */
export function chatCandidates(settings: ModelSettings, ctx: EngineContext): RuntimeId[] {
  const local: RuntimeId[] = [];
  if (sanitizeBaseUrl(settings.ollamaUrl)) local.push('ollama');
  if (sanitizeBaseUrl(settings.openaiUrl)) local.push('openai');
  const gateway: RuntimeId[] = ctx.gatewayBase ? ['gateway'] : [];
  const browser: RuntimeId[] =
    settings.browser.enabled && ctx.browserSupported !== false ? ['browser'] : [];

  switch (settings.mode) {
    case 'offline':
      return [];
    case 'local':
      // Browser inference is still on *this* device, so it belongs here.
      return [...local, ...browser];
    case 'server':
      return gateway;
    case 'browser':
      return browser;
    case 'auto':
    default:
      // A server on your own network is cheaper than downloading a model.
      return [...local, ...gateway, ...browser];
  }
}

/** Runtimes that can transcribe audio, in attempt order. */
export function sttCandidates(settings: ModelSettings, ctx: EngineContext): RuntimeId[] {
  const gateway: RuntimeId[] = ctx.gatewayBase ? ['gateway'] : [];
  const local: RuntimeId[] =
    settings.mode === 'offline' ? [] : sanitizeBaseUrl(settings.openaiUrl) ? ['openai'] : [];
  const browser: RuntimeId[] =
    settings.browser.enabled && ctx.browserSupported !== false ? ['browser'] : [];

  switch (settings.mode) {
    case 'offline':
      return [];
    case 'local':
      return [...local, ...browser];
    case 'server':
      return gateway;
    case 'browser':
      return browser;
    default:
      return [...gateway, ...local, ...browser];
  }
}

/**
 * Whether a model is allowed to serve a language. Unverified coverage is a
 * hard no unless the learner explicitly opted in — this is the "do not assume
 * every model supports all languages" rule, enforced in code.
 */
export function languageSupport(
  modelId: string,
  languageId: string,
  allowUnverified: boolean
): 'ok' | 'unverified' | 'unsupported' {
  const model = findModel(modelId);
  // A model we have no card for (a local fine-tune, a new release) is never
  // assumed to work: the learner can opt in, but the default is honest.
  if (!model) return allowUnverified ? 'ok' : 'unverified';
  const coverage = coverageFor(modelId, languageId);
  if (coverage === 'documented') return 'ok';
  if (coverage === 'unsupported') return 'unsupported';
  return allowUnverified ? 'ok' : 'unverified';
}

/** Model id that would actually be used for a runtime (for labels/probes). */
export function modelForRuntime(settings: ModelSettings, runtime: RuntimeId): string {
  switch (runtime) {
    case 'ollama':
      return settings.ollamaModel;
    case 'openai':
      return settings.openaiModel;
    case 'browser':
      return settings.browser.chatModel;
    case 'gateway':
      return settings.ollamaModel || 'server-configured';
    default:
      return 'offline';
  }
}

export function sttModelForRuntime(settings: ModelSettings, runtime: RuntimeId): string {
  return runtime === 'browser' ? settings.browser.sttModel : settings.sttModel;
}

export const RUNTIME_LABEL: Record<RuntimeId, string> = {
  ollama: 'Ollama (this device/LAN)',
  openai: 'Local OpenAI-compatible server',
  gateway: 'Babelish inference server',
  browser: 'Browser inference',
  device: 'Device voice',
  offline: 'Offline coach',
};

export const RUNTIME_SHORT: Record<RuntimeId, string> = {
  ollama: 'Ollama',
  openai: 'Local server',
  gateway: 'App server',
  browser: 'Browser',
  device: 'Device voice',
  offline: 'Offline',
};

export const MODE_LABEL: Record<TutorMode, string> = {
  auto: 'Automatic',
  local: 'This device or LAN',
  server: 'App owner’s server',
  browser: 'In this browser',
  offline: 'Offline coach',
};

/**
 * Why voice input is unavailable, in plain language (for the mic button).
 * Pure so the copy is unit-tested alongside the candidate planner.
 */
export function voiceUnavailableMessage(settings: ModelSettings, ctx: EngineContext): string {
  const candidates = sttCandidates(settings, ctx);
  if (candidates.length === 0) {
    return settings.mode === 'offline'
      ? 'Voice input needs a speech model — the offline coach is text-only. Type your reply instead.'
      : 'No speech model is configured. Add one in Settings → AI model, or type your reply.';
  }
  return 'Voice input is not available right now — type your reply instead.';
}
