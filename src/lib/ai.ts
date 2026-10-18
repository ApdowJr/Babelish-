import * as Speech from 'expo-speech';
import { getLanguage, type Language } from '@/data/languages';

/**
 * AI tutor engine.
 *
 * Talks to any OpenAI-compatible chat API (OpenAI, OpenRouter, Groq, a local
 * server…) through env config. Every call carries a native-speaker system
 * prompt so the AI stays in the target language, at the right register and
 * CEFR level. Without keys, it falls back to scripted native lines so the
 * experience is always demonstrable (see ROADMAP.md).
 */

const API_URL = process.env.EXPO_PUBLIC_AI_API_URL?.replace(/\/+$/, '');
const API_KEY = process.env.EXPO_PUBLIC_AI_API_KEY;
const MODEL = process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini';

export const isAIConfigured = Boolean(
  API_URL && API_KEY && !API_KEY.includes('your-key') && !API_KEY.includes('sk-...')
);

export type TutorMessage = { role: 'user' | 'assistant'; text: string; translation?: string };

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
};

/** Builds the native-speaker persona that governs every AI response. */
export function buildSystemPrompt(opts: {
  language: Language;
  level: string;
  scenarioTitle?: string;
  learnerName?: string;
}): string {
  const { language, level, scenarioTitle, learnerName } = opts;
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
    `If the learner makes a mistake, first recast it naturally in ${language.name} (a gentle native-style correction), then continue the conversation with a follow-up question so they always have something to answer.`,
    `Sound like a person, not a textbook: natural contractions, real rhythm, small cultural touches. Never lecture.`,
    `Respond with STRICT JSON only, no markdown fences: {"reply":"<your message in ${language.name}>","translation":"<natural English translation>","tip":"<optional one-line grammar or culture tip>"}`,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function tutorReply(opts: TutorOptions): Promise<TutorReply> {
  if (!isAIConfigured) {
    return demoReply(opts.language, opts.history.filter((m) => m.role === 'user').length);
  }

  const sys = buildSystemPrompt({
    language: opts.language,
    level: opts.level ?? 'A2',
    scenarioTitle: opts.scenarioTitle,
    learnerName: opts.learnerName,
  });

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
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.8,
        messages: [
          { role: 'system', content: sys },
          ...opts.history.map((m) => ({ role: m.role, content: m.text })),
        ],
      }),
    });

    if (!res.ok) throw new Error(`AI request failed with status ${res.status}`);

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? '';
    const parsed = parseTutorPayload(raw);

    // Guardrail: the reply must actually be in the target script when the
    // language uses a non-Latin script — retry once before giving up.
    if (!scriptMatches(parsed.text, opts.language)) {
      const retry = await fetchRetry(sys, opts);
      if (retry) return retry;
    }

    return {
      text: parsed.text || demoReply(opts.language, 0).text,
      translation: parsed.translation,
      tip: parsed.tip,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRetry(sys: string, opts: TutorOptions): Promise<TutorReply | null> {
  try {
    const res = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.6,
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: `Reply again, ONLY in ${opts.language.name}.` },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parsed = parseTutorPayload(data?.choices?.[0]?.message?.content ?? '');
    return scriptMatches(parsed.text, opts.language)
      ? { text: parsed.text, translation: parsed.translation, tip: parsed.tip }
      : null;
  } catch {
    return null;
  }
}

function parseTutorPayload(raw: string): { text: string; translation: string; tip?: string } {
  const match = raw.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      const json = JSON.parse(match[0]);
      if (json.reply) {
        return {
          text: String(json.reply).trim(),
          translation: String(json.translation ?? '').trim(),
          tip: json.tip ? String(json.tip).trim() : undefined,
        };
      }
    } catch {
      // fall through to raw text
    }
  }
  return { text: raw.trim(), translation: '' };
}

const SCRIPT_PATTERNS: { test: RegExp; script: string }[] = [
  { script: 'Arabic', test: /[\u0600-\u06FF]/ },
  { script: '中文', test: /[\u4E00-\u9FFF]/ },
  { script: 'देवनागरी', test: /[\u0900-\u097F]/ },
  { script: 'ひらがな', test: /[\u3040-\u30FF]/ },
  { script: 'Cyrillic', test: /[\u0400-\u04FF]/ },
];

function scriptMatches(text: string, language: Language): boolean {
  const rule = SCRIPT_PATTERNS.find((r) => language.script.includes(r.script));
  if (!rule) return true; // Latin-script languages: no check needed
  return rule.test.test(text);
}

/* ── Speech (native voices via expo-speech) ─────────────────────────────── */

/** Speaks text with the locale's native voice, e.g. es-ES, ar-EG, ja-JP. */
export function speakNative(text: string, ttsLocale: string): void {
  Speech.stop();
  Speech.speak(text, { language: ttsLocale, rate: 0.92, pitch: 1.0 });
}

export function stopSpeaking(): void {
  Speech.stop();
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
