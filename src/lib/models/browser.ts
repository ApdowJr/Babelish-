/**
 * Browser inference via Transformers.js.
 *
 * Why a dynamic import: the runtime is fetched from a URL at call time, so the
 * 0.5B model and the WASM/WebGPU backend never touch the initial bundle. The
 * learner opts in (Settings → In this browser) and sees download progress.
 *
 * This module is web-only. On native, `browserChat`/`browserTranscribe` throw
 * `EngineUnavailable` and the caller falls through to the next runtime.
 */
import type { ModelSettings } from './config';
import type { ChatAnswer, ChatTurn, TranscribeAnswer } from './types';
import { EngineFailed, EngineUnavailable } from './types';

type ProgressInfo = {
  status?: string;
  file?: string;
  progress?: number;
  loaded?: number;
  total?: number;
};

type RuntimeModule = {
  pipeline: (task: string, model: string, options?: Record<string, unknown>) => Promise<unknown>;
  env?: { allowLocalModels?: boolean; allowRemoteModels?: boolean };
};

type Generator = ((input: unknown, options?: Record<string, unknown>) => Promise<unknown>) & {
  dispose?: () => Promise<void> | void;
};

const runtimeCache = new Map<string, Promise<RuntimeModule>>();
const pipelineCache = new Map<string, Promise<Generator>>();

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof WebAssembly === 'object';
}

export function browserInferenceSupported(): boolean {
  return isBrowser();
}

/** WebGPU accelerates generation but is not required (WASM is the fallback). */
export function hasWebGpu(): boolean {
  return isBrowser() && typeof navigator !== 'undefined' && 'gpu' in navigator;
}

const FALLBACK_RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/+esm';

async function loadRuntime(url: string): Promise<RuntimeModule> {
  if (!isBrowser()) {
    throw new EngineUnavailable('Browser inference is only available in the web build.', 'browser');
  }
  const existing = runtimeCache.get(url);
  if (existing) return existing;

  const pending = (async () => {
    // A plain dynamic import would be statically analysed by Metro and fail on
    // a runtime URL; Function() keeps it a genuine, opt-in network import.
    const importer = new Function('u', 'return import(u)') as (u: string) => Promise<unknown>;
    let mod: unknown;
    try {
      mod = await importer(url);
    } catch {
      if (url !== FALLBACK_RUNTIME_URL) {
        try {
          mod = await importer(FALLBACK_RUNTIME_URL);
        } catch {
          throw new EngineUnavailable(
            'Could not load the browser inference runtime — check your connection and try again.',
            'browser'
          );
        }
      } else {
        throw new EngineUnavailable(
          'Could not load the browser inference runtime — check your connection and try again.',
          'browser'
        );
      }
    }
    const runtime = mod as RuntimeModule;
    if (typeof runtime?.pipeline !== 'function') {
      throw new EngineUnavailable('The browser inference runtime is not usable.', 'browser');
    }
    if (runtime.env) {
      runtime.env.allowLocalModels = false;
      runtime.env.allowRemoteModels = true;
    }
    return runtime;
  })();

  runtimeCache.set(url, pending);
  try {
    return await pending;
  } catch (err) {
    runtimeCache.delete(url);
    throw err;
  }
}

function progressReporter(onProgress?: (p: {
  loaded: number;
  total: number;
  pct: number;
  label: string;
}) => void) {
  return (info: ProgressInfo) => {
    if (!onProgress) return;
    if (info.status !== 'progress' || !info.total) return;
    onProgress({
      loaded: info.loaded ?? 0,
      total: info.total,
      pct: info.progress ?? (info.loaded && info.total ? (info.loaded / info.total) * 100 : 0),
      label: info.file ?? 'model',
    });
  };
}

async function loadPipeline(
  runtime: RuntimeModule,
  task: string,
  model: string,
  onProgress?: (p: { loaded: number; total: number; pct: number; label: string }) => void
): Promise<Generator> {
  const device = hasWebGpu() ? 'webgpu' : 'wasm';
  const key = `${task}|${model}|${device}`;
  const existing = pipelineCache.get(key);
  if (existing) return existing;

  const pending = (async () => {
    try {
      const created = await runtime.pipeline(task, model, {
        device,
        progress_callback: progressReporter(onProgress),
      });
      return created as Generator;
    } catch (err) {
      // WebGPU can exist but fail to initialise (old drivers, headless). Retry
      // once on WASM instead of failing the whole request.
      if (device === 'webgpu') {
        try {
          const created = await runtime.pipeline(task, model, {
            device: 'wasm',
            progress_callback: progressReporter(onProgress),
          });
          return created as Generator;
        } catch {
          // fall through to the honest error below
        }
      }
      throw new EngineFailed(
        err instanceof Error
          ? `Could not load ${model} in this browser: ${err.message}`
          : `Could not load ${model} in this browser.`,
        'browser'
      );
    }
  })();

  pipelineCache.set(key, pending);
  try {
    return await pending;
  } catch (err) {
    pipelineCache.delete(key);
    throw err;
  }
}

/** Normalises the many shapes transformers.js can return for one generation. */
export function extractGeneratedText(output: unknown): string {
  const first = Array.isArray(output) ? output[0] : output;
  if (!first || typeof first !== 'object') return '';
  const record = first as Record<string, unknown>;
  const generated = record.generated_text ?? record.generated_texts ?? record.text;
  if (typeof generated === 'string') return generated.trim();
  if (Array.isArray(generated)) {
    // `messages`-style output: [{role, content}, …]
    const last = generated[generated.length - 1];
    if (typeof last === 'string') return last.trim();
    if (last && typeof last === 'object') {
      const content = (last as Record<string, unknown>).content;
      if (typeof content === 'string') return content.trim();
    }
  }
  return '';
}

function toMessages(messages: ChatTurn[]): { role: string; content: string }[] {
  return messages.map((message) => ({ role: message.role, content: message.content }));
}

export async function browserChat(input: {
  settings: ModelSettings;
  messages: ChatTurn[];
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  onProgress?: (p: { loaded: number; total: number; pct: number; label: string }) => void;
}): Promise<ChatAnswer> {
  if (!isBrowser()) {
    throw new EngineUnavailable('Browser inference is only available in the web build.', 'browser');
  }
  const model = input.settings.browser.chatModel;
  const runtime = await loadRuntime(input.settings.browser.runtimeUrl);
  const generator = await loadPipeline(runtime, 'text-generation', model, input.onProgress);

  if (input.signal?.aborted) throw new EngineFailed('Generation cancelled.', 'browser');

  const started = Date.now();
  let output: unknown;
  try {
    output = await generator(toMessages(input.messages), {
      max_new_tokens: input.maxTokens ?? 320,
      temperature: input.temperature ?? 0.7,
      do_sample: true,
      return_full_text: false,
    });
  } catch (err) {
    throw new EngineFailed(
      err instanceof Error ? `Browser model failed: ${err.message}` : 'Browser model failed.',
      'browser'
    );
  }

  const text = extractGeneratedText(output);
  if (!text) throw new EngineFailed('The browser model returned an empty answer.', 'browser');
  return { text, runtime: 'browser', model, ms: Date.now() - started };
}

/** Whisper language tokens take English names; map the atlas ids once. */
const WHISPER_LANGUAGE: Record<string, string> = {
  es: 'spanish',
  fr: 'french',
  de: 'german',
  it: 'italian',
  pt: 'portuguese',
  nl: 'dutch',
  sv: 'swedish',
  pl: 'polish',
  ru: 'russian',
  uk: 'ukrainian',
  el: 'greek',
  tr: 'turkish',
  ar: 'arabic',
  he: 'hebrew',
  fa: 'persian',
  hi: 'hindi',
  bn: 'bengali',
  zh: 'chinese',
  ja: 'japanese',
  ko: 'korean',
  vi: 'vietnamese',
  th: 'thai',
  id: 'indonesian',
  sw: 'swahili',
  so: 'somali',
};

/** Decodes compressed audio and returns 16 kHz mono PCM for Whisper. */
export async function decodeAudioToMono16k(buffer: ArrayBuffer): Promise<Float32Array> {
  if (!isBrowser()) {
    throw new EngineUnavailable('Audio decoding needs a browser.', 'browser');
  }
  const AudioCtor =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) throw new EngineFailed('This browser cannot decode audio.', 'browser');

  const context = new AudioCtor({ sampleRate: 16_000 });
  try {
    const decoded = await context.decodeAudioData(buffer.slice(0));
    const channels = decoded.numberOfChannels;
    const length = decoded.length;
    const mono = new Float32Array(length);
    for (let channel = 0; channel < channels; channel += 1) {
      const data = decoded.getChannelData(channel);
      for (let i = 0; i < length; i += 1) mono[i] += data[i] / channels;
    }
    if (decoded.sampleRate === 16_000) return mono;
    return resampleLinear(mono, decoded.sampleRate, 16_000);
  } catch {
    throw new EngineFailed('Could not read that recording — try again.', 'browser');
  } finally {
    void context.close().catch(() => undefined);
  }
}

/** Linear resampler — only used when the browser ignores the 16 kHz request. */
export function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to || input.length === 0) return input;
  const ratio = from / to;
  const length = Math.max(1, Math.floor(input.length / ratio));
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio;
    const low = Math.floor(position);
    const high = Math.min(input.length - 1, low + 1);
    const weight = position - low;
    output[i] = input[low] * (1 - weight) + input[high] * weight;
  }
  return output;
}

export async function browserTranscribe(input: {
  settings: ModelSettings;
  audio: ArrayBuffer;
  languageId: string;
  signal?: AbortSignal;
  onProgress?: (p: { loaded: number; total: number; pct: number; label: string }) => void;
}): Promise<TranscribeAnswer> {
  if (!isBrowser()) {
    throw new EngineUnavailable('Browser inference is only available in the web build.', 'browser');
  }
  const model = input.settings.browser.sttModel;
  const runtime = await loadRuntime(input.settings.browser.runtimeUrl);
  const transcriber = await loadPipeline(
    runtime,
    'automatic-speech-recognition',
    model,
    input.onProgress
  );
  const pcm = await decodeAudioToMono16k(input.audio);
  if (input.signal?.aborted) throw new EngineFailed('Transcription cancelled.', 'browser');

  const started = Date.now();
  let output: unknown;
  try {
    output = await transcriber(pcm, {
      language: WHISPER_LANGUAGE[input.languageId] ?? undefined,
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
    });
  } catch (err) {
    throw new EngineFailed(
      err instanceof Error ? `Browser transcription failed: ${err.message}` : 'Transcription failed.',
      'browser'
    );
  }
  const record = (Array.isArray(output) ? output[0] : output) as { text?: unknown } | null;
  const text = typeof record?.text === 'string' ? record.text.trim() : '';
  if (!text) throw new EngineFailed("I couldn't catch that — try again or type instead.", 'browser');
  return { text, runtime: 'browser', model, ms: Date.now() - started };
}
