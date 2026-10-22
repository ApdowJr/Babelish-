/**
 * Shared types for the open-source model layer.
 *
 * Everything here is pure: no React, no Expo, no AsyncStorage. The adapters
 * (`chat.ts`, `browser.ts`, `stt.ts`) translate these types into HTTP calls or
 * on-device inference; the learning UI never talks to a model directly.
 */

export type ModelKind = 'chat' | 'stt' | 'tts';

/** Where a model can actually execute. */
export type RuntimeId = 'ollama' | 'openai' | 'gateway' | 'browser' | 'device' | 'offline';

/**
 * How sure we are that a model speaks a given language.
 *
 * - `documented` — the model card / vendor language table lists it.
 * - `unverified` — plausible, but not proven for this model. Never enabled by
 *   default for a language; the learner has to opt in.
 * - `unsupported` — documented as *not* covered.
 *
 * We deliberately do not treat "it produced a sentence once" as proof.
 */
export type Coverage = 'documented' | 'unverified' | 'unsupported';

export type LicenseInfo = {
  name: string;
  /** SPDX id when the license has one. */
  spdx?: string;
  /** Whether closed-source / commercial app use is clearly allowed. */
  commercial: 'yes' | 'check' | 'no';
  url?: string;
};

export type ModelSpec = {
  /** Canonical id used by runtimes (`qwen2.5:1.5b`, `whisper-large-v3-turbo`). */
  id: string;
  /** Coverage family key — several sizes share one language table. */
  family: string;
  kind: ModelKind;
  label: string;
  parameters: string;
  /** Approximate download/disk footprint in MB at the recommended quantisation. */
  sizeMb: number;
  runtimes: RuntimeId[];
  license: LicenseInfo;
  contextTokens?: number;
  /** Short, honest hardware note. */
  hardware: string;
  notes: string;
  /** Extra roles this model can play in the app. */
  roles: string[];
};

export type ChatRole = 'system' | 'user' | 'assistant';
export type ChatTurn = { role: ChatRole; content: string };

export type ChatAnswer = {
  /** Raw model output (the tutor prompts ask for JSON, parsed by aiCore). */
  text: string;
  runtime: RuntimeId;
  model: string;
  /** Wall-clock latency in ms, measured around the inference call. */
  ms: number;
};

export type ChatMeta = {
  languageId?: string;
  level?: string;
  scenarioTitle?: string;
  learnerName?: string;
  explanationLanguage?: string;
  profile?: Record<string, unknown>;
};

export type ChatCall = {
  messages: ChatTurn[];
  /** Used for coverage gating and the gateway body. */
  languageId?: string;
  meta?: ChatMeta;
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
  /** Browser downloads can take minutes; progress is surfaced in the UI. */
  onProgress?: (progress: { loaded: number; total: number; pct: number; label: string }) => void;
  /** Exact model id to use (settings pick one; probes may override). */
  model?: string;
};

export type TranscribeCall = {
  audio: ArrayBuffer;
  languageId: string;
  signal?: AbortSignal;
  onProgress?: (progress: { loaded: number; total: number; pct: number; label: string }) => void;
};

export type TranscribeAnswer = {
  text: string;
  runtime: RuntimeId;
  model: string;
  ms: number;
};

/** Raised when a runtime is not configured / not reachable — safe to skip. */
export class EngineUnavailable extends Error {
  constructor(message: string, readonly runtime?: RuntimeId) {
    super(message);
    this.name = 'EngineUnavailable';
  }
}

/** Raised when a runtime *is* configured but produced an unusable result. */
export class EngineFailed extends Error {
  constructor(message: string, readonly runtime?: RuntimeId) {
    super(message);
    this.name = 'EngineFailed';
  }
}

/** Normalises an abort/timeout/network error into one of the two classes. */
export function classifyFetchError(err: unknown, runtime: RuntimeId, what: string): Error {
  if (err instanceof EngineUnavailable || err instanceof EngineFailed) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new EngineFailed(`${what} timed out — try again.`, runtime);
  }
  if (err instanceof TypeError) {
    return new EngineUnavailable(`${what} is unreachable.`, runtime);
  }
  return err instanceof Error ? err : new EngineFailed(`${what} failed.`, runtime);
}

/** Creates a timeout-aware fetch controller that also honours a caller signal. */
export function linkedAbort(signal: AbortSignal | undefined, timeoutMs: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const forward = () => controller.abort();
  if (signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener('abort', forward, { once: true });
  }
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', forward);
    },
  };
}
