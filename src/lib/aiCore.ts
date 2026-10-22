/**
 * Pure AI-tutor core: system prompt, wire contract, reply parsing, and the
 * non-Latin-script guardrail. Shared by the client (`src/lib/ai.ts`) and the
 * server proxy (`functions/api`) so both sides build and parse identically.
 *
 * Constraints (why this file exists separately from ai.ts):
 *  - no react-native / expo imports (the Function bundles it);
 *  - relative imports only (the Function has no `@/` path alias);
 *  - no env access (the server reads its own env).
 */
import { LANGUAGES, type Language } from '../data/languages';
import { formatProfileContext, type ProfileContext } from './profilePrompt';

export type TutorMessage = { role: 'user' | 'assistant'; text: string; translation?: string };

/** Client → proxy request body for `POST /api/ai/chat`. */
export type AiChatRequest = {
  languageId: string;
  level?: string;
  scenarioTitle?: string;
  learnerName?: string;
  /** Language for translations/tips — the learner's native language. */
  explanationLanguage?: string;
  profile?: ProfileContext;
  history: { role: 'user' | 'assistant'; text: string }[];
};

/** Proxy → client body for `POST /api/ai/chat`. */
export type AiChatResponse = { reply: string; translation: string; tip?: string };

/**
 * Validates an untrusted `POST /api/ai/chat` body and returns the typed
 * request, or a human-readable reason it was rejected.
 */
export function parseAiChatRequest(
  body: unknown
): { ok: true; request: AiChatRequest } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be an object.' };
  const b = body as Record<string, unknown>;

  const languageId = typeof b.languageId === 'string' ? b.languageId : '';
  // Strict membership check — getLanguage() itself falls back to the first
  // language for unknown ids, so it can't be used to validate.
  if (!languageId || !LANGUAGES.some((l) => l.id === languageId)) {
    return { ok: false, error: 'languageId must be one of the supported languages.' };
  }

  const historyRaw = Array.isArray(b.history) ? b.history : null;
  if (!historyRaw || historyRaw.length === 0) {
    return { ok: false, error: 'history must be a non-empty array.' };
  }
  if (historyRaw.length > 40) {
    return { ok: false, error: 'history is limited to 40 messages.' };
  }
  const history: AiChatRequest['history'] = [];
  for (const m of historyRaw) {
    if (!m || typeof m !== 'object') return { ok: false, error: 'Invalid history entry.' };
    const role = (m as Record<string, unknown>).role;
    const text = (m as Record<string, unknown>).text;
    if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text.trim()) {
      return { ok: false, error: 'Invalid history entry.' };
    }
    if (text.length > 4_000) return { ok: false, error: 'History message too long.' };
    history.push({ role, text: text.slice(0, 4_000) });
  }

  const request: AiChatRequest = { languageId, history };

  if (typeof b.level === 'string' && /^(A1|A2|B1|B2|C1|C2)$/.test(b.level)) {
    request.level = b.level;
  }
  if (typeof b.scenarioTitle === 'string' && b.scenarioTitle.trim()) {
    request.scenarioTitle = b.scenarioTitle.slice(0, 120);
  }
  if (typeof b.learnerName === 'string' && b.learnerName.trim()) {
    request.learnerName = b.learnerName.slice(0, 60);
  }
  if (typeof b.explanationLanguage === 'string' && b.explanationLanguage.trim()) {
    request.explanationLanguage = b.explanationLanguage.trim().slice(0, 60);
  }
  if (b.profile && typeof b.profile === 'object') {
    const p = b.profile as Record<string, unknown>;
    const profile: ProfileContext = {};
    if (typeof p.job === 'string') profile.job = p.job.slice(0, 120);
    if (Array.isArray(p.interests)) {
      profile.interests = p.interests
        .filter((i): i is string => typeof i === 'string')
        .slice(0, 8)
        .map((i) => i.slice(0, 60));
    }
    if (Array.isArray(p.goals)) {
      profile.goals = p.goals
        .filter((i): i is string => typeof i === 'string')
        .slice(0, 6)
        .map((i) => i.slice(0, 80));
    }
    if (typeof p.nativeLanguageName === 'string') {
      profile.nativeLanguageName = p.nativeLanguageName.slice(0, 60);
    }
    request.profile = profile;
  }

  return { ok: true, request };
}

/** Builds the native-speaker persona that governs every AI response. */
export function buildSystemPrompt(opts: {
  language: Language;
  level: string;
  scenarioTitle?: string;
  learnerName?: string;
  explanationLanguage?: string;
  profile?: ProfileContext;
}): string {
  const { language, level, scenarioTitle, learnerName, profile } = opts;
  const explanation = opts.explanationLanguage?.trim() || 'English';
  return [
    `You are a real native ${language.name} speaker (${language.nativeName}) from the heart of the culture, acting as a warm, expert one-on-one language tutor.`,
    `You ALWAYS reply in ${language.name}. Never use English or any other language in your reply text.`,
    `The learner's CEFR level is ${level}; match vocabulary, idiom density and sentence length to that level.`,
    scenarioTitle
      ? `Stay naturally in character for this real-life scenario: "${scenarioTitle}".`
      : `Keep the conversation natural and everyday, like two friends talking.`,
    learnerName
      ? `The learner's name is ${learnerName}. Personalize examples around their life when it fits naturally.`
      : '',
    ...formatProfileContext(profile),
    `If the learner makes a mistake, first recast it naturally in ${language.name} (a gentle native-style correction), then briefly explain the rule in ${explanation} inside the tip, then continue with a follow-up question.`,
    `If the learner asks for a translation, a grammar explanation, a drill or an example sentence, provide it — stay in ${language.name} for examples and use ${explanation} only for the explanation/translation fields.`,
    `Only teach grammar you are certain about. If something is dialect-dependent or uncertain, say so instead of inventing a rule.`,
    `Sound like a person, not a textbook: natural contractions, real rhythm, small cultural touches. Never lecture.`,
    `Respond with STRICT JSON only, no markdown fences: {"reply":"<your message in ${language.name}>","translation":"<natural translation in ${explanation}>","tip":"<optional one-line grammar or culture tip in ${explanation}>"}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Extracts the JSON object the tutor prompt asks for (tolerates chatty preambles). */
export function parseTutorPayload(raw: string): {
  text: string;
  translation: string;
  tip?: string;
} {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (json && typeof json === 'object') {
        // A valid JSON object IS the tutor's contract answer — return it as-is
        // (possibly empty, which callers turn into an honest error) rather
        // than leaking the raw JSON text into the conversation.
        return {
          text: String(json.reply ?? '').trim(),
          translation: String(json.translation ?? '').trim(),
          tip: json.tip ? String(json.tip).trim() : undefined,
        };
      }
    } catch {
      // not JSON after all — fall through to raw text
    }
  }
  return { text: raw.trim(), translation: '' };
}

const SCRIPT_PATTERNS: { test: RegExp; script: string }[] = [
  { script: 'Arabic', test: /[\u0600-\u06FF]/ },
  { script: 'Hebrew', test: /[\u0590-\u05FF]/ },
  { script: '中文', test: /[\u4E00-\u9FFF]/ },
  { script: 'देवनागरी', test: /[\u0900-\u097F]/ },
  { script: 'বাংলা', test: /[\u0980-\u09FF]/ },
  { script: 'ひらがな', test: /[\u3040-\u30FF]/ },
  { script: 'Hangul', test: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
  { script: 'Thai', test: /[\u0E00-\u0E7F]/ },
  { script: 'Greek', test: /[\u0370-\u03FF]/ },
  { script: 'Cyrillic', test: /[\u0400-\u04FF]/ },
];

export function scriptMatches(text: string, language: Language): boolean {
  const rule = SCRIPT_PATTERNS.find((r) => language.script.includes(r.script));
  if (!rule) return true; // Latin-script languages: no check needed
  return rule.test.test(text);
}

/**
 * Turns a raw upstream chat/completion payload into a tutor reply, or throws
 * with a user-visible reason. Deliberately does NOT fall back to scripted
 * demo lines: in real mode an empty/invalid reply must surface as an error,
 * never as a fabricated "AI" message.
 */
export function extractTutorReply(raw: string, language: Language): {
  text: string;
  translation: string;
  tip?: string;
} {
  const parsed = parseTutorPayload(raw);
  if (!parsed.text) {
    throw new Error('The tutor returned an empty reply — try again.');
  }
  if (!scriptMatches(parsed.text, language)) {
    throw new Error(`The tutor replied in the wrong script for ${language.name} — try again.`);
  }
  return parsed;
}
