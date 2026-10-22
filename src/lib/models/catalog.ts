/**
 * Open-source model catalogue.
 *
 * Every entry records what the model is, where it can run, its license and —
 * critically — which of Babelish's languages we consider *verified*. Coverage
 * is deliberately conservative: it is derived from the model card's language
 * table, not from "it answered once in Portuguese". A language is only
 * `documented` when the card lists it; everything else starts `unverified`
 * and must be opted into in Settings.
 *
 * Sizes are approximate download footprints at the quantisation this app
 * recommends (q4 for LLMs, q8/fp16 for speech). They are honest estimates,
 * not marketing numbers.
 */
import { LANGUAGES } from '../../data/languages';
import type { Coverage, ModelKind, ModelSpec, RuntimeId } from './types';

/* ── Coverage tables ───────────────────────────────────────────────────── */

/**
 * Qwen2.5 (0.5B–7B) language list from the model card: Chinese, English,
 * French, Spanish, Portuguese, German, Italian, Russian, Japanese, Korean,
 * Vietnamese, Thai, Arabic, Indonesian, Turkish. Not listed → unverified.
 */
const QWEN_LANGUAGES = [
  'zh', 'en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'vi', 'th', 'ar', 'id', 'tr',
] as const;

/**
 * Whisper's training languages (99 total). The 24 previously listed Babelish
 * languages appear in the official language table. Somali is intentionally not
 * marked verified here until its coverage is confirmed against the model card.
 */
const WHISPER_LANGUAGES = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'pl', 'ru', 'uk', 'el', 'tr',
  'ar', 'he', 'fa', 'hi', 'bn', 'zh', 'ja', 'ko', 'vi', 'th', 'id', 'sw',
] as const;

/** Aya Expanse (Cohere) — 23 languages; non-commercial licence. */
const AYA_LANGUAGES = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'uk', 'el', 'tr',
  'ar', 'he', 'fa', 'hi', 'zh', 'ja', 'ko', 'vi', 'id',
] as const;

/** Kokoro-82M v1.0 voices: en, es, fr, hi, it, pt, ja, zh. */
const KOKORO_LANGUAGES = ['es', 'fr', 'hi', 'it', 'pt', 'ja', 'zh'] as const;

/**
 * Piper voice languages we could confirm in the upstream voice catalogue.
 * Swedish/Bengali/Indonesian are not reliably packaged — left unverified.
 */
const PIPER_LANGUAGES = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'pl', 'ru', 'uk', 'el', 'tr',
  'ar', 'fa', 'zh', 'vi', 'sw',
] as const;

/**
 * Qwen3 (incl. Qwen3-Next 80B A3B) documents 119 languages and dialects. The
 * table covers the 24 previously listed Babelish languages; Somali is not yet
 * marked verified and remains subject to the app's explicit unverified-language
 * gate until its coverage is confirmed. Source: Qwen3 language table.
 */
const QWEN3_LANGUAGES = [
  'es', 'fr', 'de', 'it', 'pt', 'nl', 'sv', 'pl', 'ru', 'uk', 'el', 'tr',
  'ar', 'he', 'fa', 'hi', 'bn', 'zh', 'ja', 'ko', 'vi', 'th', 'id', 'sw',
] as const;

const COVERAGE: Record<string, readonly string[]> = {
  qwen: QWEN_LANGUAGES,
  qwen3: QWEN3_LANGUAGES,
  whisper: WHISPER_LANGUAGES,
  aya: AYA_LANGUAGES,
  kokoro: KOKORO_LANGUAGES,
  piper: PIPER_LANGUAGES,
  llama: ['es', 'fr', 'de', 'it', 'pt', 'hi', 'th', 'tr'],
  // OS speech engines expose whatever voices the platform ships. We do not
  // claim any specific language here — the app checks installed voices itself.
  device: [],
};

/* ── Catalogue ─────────────────────────────────────────────────────────── */

export const MODELS: ModelSpec[] = [
  {
    id: 'qwen2.5:0.5b',
    family: 'qwen',
    kind: 'chat',
    label: 'Qwen2.5 0.5B Instruct',
    parameters: '0.5B',
    sizeMb: 400,
    runtimes: ['ollama', 'openai', 'gateway', 'browser'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    contextTokens: 32_768,
    hardware: 'Any laptop; ~1 GB RAM. Runs in a browser via WebGPU/WASM.',
    notes: 'Fastest option. Shallow grammar explanations — good for greetings and drills.',
    roles: ['tutor', 'translation'],
  },
  {
    id: 'qwen2.5:1.5b',
    family: 'qwen',
    kind: 'chat',
    label: 'Qwen2.5 1.5B Instruct',
    parameters: '1.5B',
    sizeMb: 1_000,
    runtimes: ['ollama', 'openai', 'gateway'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    contextTokens: 32_768,
    hardware: '4 GB RAM laptop, CPU-only is fine (~10–25 tok/s).',
    notes: 'Default. Best quality-per-byte for multilingual tutoring on modest machines.',
    roles: ['tutor', 'translation', 'explanations'],
  },
  {
    id: 'qwen2.5:3b',
    family: 'qwen',
    kind: 'chat',
    label: 'Qwen2.5 3B Instruct',
    parameters: '3B',
    sizeMb: 1_900,
    runtimes: ['ollama', 'openai', 'gateway'],
    license: { name: 'Qwen Research License', commercial: 'no' },
    contextTokens: 32_768,
    hardware: '8 GB RAM; a small GPU helps a lot.',
    notes: 'Stronger grammar reasoning, but the weights are research-only — not for a paid store build.',
    roles: ['tutor', 'explanations'],
  },
  {
    id: 'qwen2.5:7b',
    family: 'qwen',
    kind: 'chat',
    label: 'Qwen2.5 7B Instruct',
    parameters: '7B',
    sizeMb: 4_700,
    runtimes: ['ollama', 'openai', 'gateway'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    contextTokens: 32_768,
    hardware: '16 GB RAM or an 8 GB GPU.',
    notes: 'Best local quality in the family; noticeably slower on CPU.',
    roles: ['tutor', 'explanations', 'translation'],
  },
  {
    id: 'llama3.2:3b',
    family: 'llama',
    kind: 'chat',
    label: 'Llama 3.2 3B Instruct',
    parameters: '3B',
    sizeMb: 2_000,
    runtimes: ['ollama', 'openai', 'gateway'],
    license: { name: 'Llama 3.2 Community License', commercial: 'check' },
    contextTokens: 131_072,
    hardware: '8 GB RAM.',
    notes: 'Eight languages only — a fallback when Qwen is unavailable, not a multilingual default.',
    roles: ['tutor'],
  },
  {
    id: 'aya-expanse:8b',
    family: 'aya',
    kind: 'chat',
    label: 'Aya Expanse 8B',
    parameters: '8B',
    sizeMb: 5_100,
    runtimes: ['ollama', 'openai', 'gateway'],
    license: {
      name: 'CC-BY-NC-4.0',
      spdx: 'CC-BY-NC-4.0',
      commercial: 'no',
      url: 'https://cohere.com/research/aya',
    },
    contextTokens: 8_192,
    hardware: '16 GB RAM or an 8 GB GPU.',
    notes: 'Excellent multilingual quality, but non-commercial: research builds only.',
    roles: ['tutor', 'translation'],
  },
  {
    id: 'whisper-large-v3-turbo',
    family: 'whisper',
    kind: 'stt',
    label: 'Whisper large-v3-turbo',
    parameters: '809M',
    sizeMb: 1_600,
    runtimes: ['openai', 'gateway'],
    license: { name: 'MIT', spdx: 'MIT', commercial: 'yes' },
    hardware: 'Self-host: 2 GB RAM (fp16) or a modest GPU. Too large for phones.',
    notes: 'Default server-side transcription. 99 languages, strong on mixed scripts.',
    roles: ['voice-input'],
  },
  {
    id: 'whisper-small',
    family: 'whisper',
    kind: 'stt',
    label: 'Whisper small',
    parameters: '244M',
    sizeMb: 500,
    runtimes: ['browser', 'openai', 'gateway'],
    license: { name: 'MIT', spdx: 'MIT', commercial: 'yes' },
    hardware: 'Browser: ~700 MB peak memory; works on desktop, marginal on phones.',
    notes: 'Best accuracy that still fits browser inference.',
    roles: ['voice-input'],
  },
  {
    id: 'whisper-base',
    family: 'whisper',
    kind: 'stt',
    label: 'Whisper base',
    parameters: '74M',
    sizeMb: 150,
    runtimes: ['browser', 'openai', 'gateway'],
    license: { name: 'MIT', spdx: 'MIT', commercial: 'yes' },
    hardware: 'Browser: ~300 MB peak memory; runs on mid-range devices.',
    notes: 'Lowest-memory option. Expect more mistakes with accents and tones.',
    roles: ['voice-input'],
  },
  {
    id: 'device',
    family: 'device',
    kind: 'tts',
    label: 'Device voice (expo-speech)',
    parameters: 'OS engine',
    sizeMb: 0,
    runtimes: ['device'],
    license: { name: 'Provided by the operating system', commercial: 'yes' },
    hardware: 'No download. Quality and language list depend on the OS.',
    notes: 'Default. Works offline, no model to host; the app checks which voices exist.',
    roles: ['speech-output'],
  },
  {
    id: 'kokoro-82m',
    family: 'kokoro',
    kind: 'tts',
    label: 'Kokoro-82M',
    parameters: '82M',
    sizeMb: 90,
    runtimes: ['openai', 'gateway'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    hardware: 'CPU-friendly; ~300 MB RAM. Needs a local TTS server (e.g. Kokoro-FastAPI).',
    notes: 'Eight voices/languages only — verified for Spanish, French, Hindi, Italian, Portuguese, Japanese and Chinese.',
    roles: ['speech-output'],
  },
  {
    id: 'piper',
    family: 'piper',
    kind: 'tts',
    label: 'Piper voices',
    parameters: 'Per voice ~63M',
    sizeMb: 60,
    runtimes: ['openai', 'gateway'],
    license: { name: 'MIT', spdx: 'MIT', commercial: 'yes' },
    hardware: 'Raspberry-Pi class CPU. One model file per voice (~20–60 MB).',
    notes: 'Wide language list, robotic but clear. Good self-hosted default.',
    roles: ['speech-output'],
  },
  {
    id: 'qwen3-tts',
    family: 'qwen',
    kind: 'tts',
    label: 'Qwen3-TTS (watch list)',
    parameters: 'unverified',
    sizeMb: 0,
    runtimes: [],
    license: { name: 'Verify release license before use', commercial: 'check' },
    hardware: 'Not integrated.',
    notes:
      'Evaluated but not enabled: no verified open-weight release with a stable license and documented language table at the time of writing. Tracked here so the choice is visible; the app never pretends to have it.',
    roles: [],
  },
];

// Gateway-hosted entries: what the tutor server actually runs. Zero download
// on the device; the hardware note points at whoever hosts the server.
MODELS.push(
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct:free',
    family: 'qwen3',
    kind: 'chat',
    label: 'Qwen3-Next 80B (free endpoint)',
    parameters: '80B MoE (3B active)',
    sizeMb: 0,
    runtimes: ['gateway'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    contextTokens: 262144,
    hardware: 'Runs on the provider — nothing is downloaded by the app.',
    notes:
      'Default when the tutor server points at OpenRouter. Free endpoints rotate; the server keeps a fallback chain.',
    roles: ['tutor'],
  },
  {
    id: 'qwen/qwen3-next-80b-a3b-instruct',
    family: 'qwen3',
    kind: 'chat',
    label: 'Qwen3-Next 80B (metered endpoint)',
    parameters: '80B MoE (3B active)',
    sizeMb: 0,
    runtimes: ['gateway'],
    license: { name: 'Apache-2.0', spdx: 'Apache-2.0', commercial: 'yes' },
    contextTokens: 262144,
    hardware: 'Runs on the provider.',
    notes: 'Second choice if the free endpoint is unavailable. Metered by the provider.',
    roles: ['tutor'],
  },
  {
    id: 'server',
    family: 'qwen3',
    kind: 'chat',
    label: 'Tutor server model (owner-configured)',
    parameters: 'server-side',
    sizeMb: 0,
    runtimes: ['gateway'],
    license: { name: 'Set by the server owner', commercial: 'check' },
    hardware: 'Provided by whoever hosts the tutor server.',
    notes: 'Used when the server does not report which model answered.',
    roles: ['tutor'],
  }
);

const INDEX = new Map(MODELS.map((model) => [model.id, model]));

export function findModel(id: string): ModelSpec | null {
  return INDEX.get(id) ?? null;
}

export function modelsFor(kind: ModelKind): ModelSpec[] {
  return MODELS.filter((model) => model.kind === kind);
}

/** Models that can actually run — used to populate settings pickers. */
export function runnableModelsFor(kind: ModelKind, runtime?: RuntimeId): ModelSpec[] {
  return modelsFor(kind).filter(
    (model) => model.runtimes.length > 0 && (!runtime || model.runtimes.includes(runtime))
  );
}

/* ── Per-language coverage ─────────────────────────────────────────────── */

/** Coverage of `languageId` by a model family (the catalogue's honesty layer). */
export function familyCoverage(family: string, languageId: string): Coverage {
  const list = COVERAGE[family];
  if (!list) return 'unverified';
  return list.includes(languageId) ? 'documented' : 'unverified';
}

export function coverageFor(modelId: string, languageId: string): Coverage {
  const model = findModel(modelId);
  if (!model) return 'unverified';
  if (model.family === 'device') return 'unverified'; // the OS decides, we check voices at runtime
  return familyCoverage(model.family, languageId);
}

export type CoverageSummary = {
  modelId: string;
  /** Languages the model card lists. */
  documented: string[];
  /** Languages in the atlas the model says nothing about. */
  unverified: string[];
  /** Subset of `unverified` the atlas actually teaches. */
  total: number;
  /** 0–1 — share of the atlas with documented coverage. */
  pct: number;
};

export function coverageSummary(modelId: string): CoverageSummary {
  const documented: string[] = [];
  const unverified: string[] = [];
  for (const language of LANGUAGES) {
    if (coverageFor(modelId, language.id) === 'documented') documented.push(language.id);
    else unverified.push(language.id);
  }
  return {
    modelId,
    documented,
    unverified,
    total: LANGUAGES.length,
    pct: LANGUAGES.length === 0 ? 0 : documented.length / LANGUAGES.length,
  };
}

/** Languages in the atlas missing from a model's documented table. */
export function unverifiedLanguageNames(modelId: string): string[] {
  return coverageSummary(modelId)
    .unverified.map((id) => LANGUAGES.find((language) => language.id === id)?.name ?? id);
}

/** Human label for the settings UI. */
export function coverageLabel(coverage: Coverage): string {
  if (coverage === 'documented') return 'Documented';
  if (coverage === 'unsupported') return 'Not supported';
  return 'Unverified';
}

/* ── Modes (what the learner can pick) ─────────────────────────────────── */

export type TutorMode = 'auto' | 'local' | 'server' | 'browser' | 'offline';

export const TUTOR_MODES: {
  id: TutorMode;
  label: string;
  short: string;
  detail: string;
}[] = [
  {
    id: 'auto',
    label: 'Automatic',
    short: 'Best available',
    detail:
      'Tries your self-hosted server, then the app owner’s inference server, then a model on this device, then the built-in offline coach. Never a paid API.',
  },
  {
    id: 'local',
    label: 'This device or LAN',
    short: 'Ollama / local server',
    detail:
      'Talks to an OpenAI-compatible server you run (Ollama, llama.cpp, LM Studio). Nothing leaves your network.',
  },
  {
    id: 'server',
    label: 'App owner’s server',
    short: 'Self-hosted by Babelish',
    detail:
      'Uses the inference server the app owner deployed. Only available when that server is configured.',
  },
  {
    id: 'browser',
    label: 'In this browser',
    short: 'Transformers.js',
    detail:
      'Downloads a small model (hundreds of MB) and runs it with WebGPU or WebAssembly. First run needs a fast connection.',
  },
  {
    id: 'offline',
    label: 'Offline coach',
    short: 'No model',
    detail:
      'Course phrases, vocabulary cards and explanations bundled with the app. Works with no network and no model at all.',
  },
];
