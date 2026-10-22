/**
 * Key phrases for pronunciation practice — curated per language/scenario pair
 * for the original ten, with a starter-word fallback for every other language
 * in the 2.0 atlas. Powers the Speak tab's "say it out loud" cards; the same
 * phrases score typed practice in demo mode (no AI key needed).
 */
import { STARTERS } from '@/data/starters';
export type PracticePhrase = {
  id: string;
  /** In the target language. */
  target: string;
  /** English meaning — revealed on tap, spoken never. */
  translation: string;
};

type ScenarioPhrases = Record<string, PracticePhrase[]>;

export const PRACTICE_PHRASES: Record<string, ScenarioPhrases> = {
  es: {
    cafe: [
      {
        id: 'es-cafe-1',
        target: 'Quiero un café con leche, por favor',
        translation: "I'd like a café con leche, please",
      },
      { id: 'es-cafe-2', target: '¿Cuánto cuesta?', translation: 'How much is it?' },
      { id: 'es-cafe-3', target: 'La cuenta, por favor', translation: 'The bill, please' },
    ],
    directions: [
      {
        id: 'es-dir-1',
        target: '¿Cómo llego a la estación de tren?',
        translation: 'How do I get to the train station?',
      },
      { id: 'es-dir-2', target: '¿Está lejos de aquí?', translation: 'Is it far from here?' },
      {
        id: 'es-dir-3',
        target: 'Gire a la derecha en la esquina',
        translation: 'Turn right at the corner',
      },
    ],
    interview: [
      {
        id: 'es-int-1',
        target: 'Me llamo Ana y soy diseñadora',
        translation: "My name is Ana and I'm a designer",
      },
      {
        id: 'es-int-2',
        target: 'Trabajo en el sector tecnológico',
        translation: 'I work in the tech sector',
      },
      {
        id: 'es-int-3',
        target: 'Tengo cinco años de experiencia',
        translation: 'I have five years of experience',
      },
    ],
  },
  ar: {
    market: [
      { id: 'ar-mkt-1', target: 'بكم هذا؟', translation: 'How much is this?' },
      { id: 'ar-mkt-2', target: 'غالي جداً', translation: 'Too expensive' },
    ],
    family: [
      { id: 'ar-fam-1', target: 'تشرفت بمعرفتك', translation: 'Pleased to meet you' },
      { id: 'ar-fam-2', target: 'كيف حالك اليوم؟', translation: 'How are you today?' },
    ],
    travel: [
      { id: 'ar-trv-1', target: 'أين بوابة الصعود؟', translation: 'Where is the boarding gate?' },
      { id: 'ar-trv-2', target: 'هذا حقيبتي', translation: 'This is my suitcase' },
    ],
  },
  zh: {
    dimsum: [
      { id: 'zh-dim-1', target: '我要一份饺子', translation: "I'd like a plate of dumplings" },
      { id: 'zh-dim-2', target: '这个很好吃', translation: 'This is delicious' },
    ],
    smalltalk: [
      { id: 'zh-talk-1', target: '你今天怎么样？', translation: 'How are you today?' },
      { id: 'zh-talk-2', target: '很高兴认识你', translation: 'Nice to meet you' },
    ],
    business: [
      { id: 'zh-biz-1', target: '我们开始开会吧', translation: "Let's start the meeting" },
      { id: 'zh-biz-2', target: '这是我的名片', translation: 'Here is my business card' },
    ],
  },
  fr: {
    bistro: [
      {
        id: 'fr-bis-1',
        target: 'Je voudrais un croissant, s\u2019il vous plaît',
        translation: "I'd like a croissant, please",
      },
      { id: 'fr-bis-2', target: "L'addition, s'il vous plaît", translation: 'The bill, please' },
    ],
    networking: [
      {
        id: 'fr-net-1',
        target: 'Enchanté, comment tu t\u2019appelles ?',
        translation: "Lovely to meet you, what's your name?",
      },
      {
        id: 'fr-net-2',
        target: 'Qu\u2019est-ce que tu fais dans la vie ?',
        translation: 'What do you do for a living?',
      },
    ],
    travel: [
      { id: 'fr-trv-1', target: 'Un billet pour Lyon, s\u2019il vous plaît', translation: 'A ticket to Lyon, please' },
      { id: 'fr-trv-2', target: 'À quelle heure part le train ?', translation: 'What time does the train leave?' },
    ],
  },
  hi: {
    market: [
      { id: 'hi-mkt-1', target: 'यह कितने का है?', translation: 'How much is this?' },
      { id: 'hi-mkt-2', target: 'बहुत महंगा है', translation: "It's too expensive" },
    ],
    family: [
      { id: 'hi-fam-1', target: 'आपसे मिलकर अच्छा लगा', translation: 'Nice to meet you' },
      { id: 'hi-fam-2', target: 'आप कैसे हैं?', translation: 'How are you?' },
    ],
    directions: [
      { id: 'hi-dir-1', target: 'स्टेशन कहाँ है?', translation: 'Where is the station?' },
      { id: 'hi-dir-2', target: 'थोड़ा धीरे चलिए', translation: 'Please go a little slower' },
    ],
  },
  ja: {
    konbini: [
      { id: 'ja-kon-1', target: 'おにぎりを一つください', translation: 'One rice ball, please' },
      { id: 'ja-kon-2', target: '袋はいりません', translation: "I don't need a bag" },
    ],
    train: [
      { id: 'ja-trn-1', target: '東京駅はどこですか？', translation: 'Where is Tokyo Station?' },
      { id: 'ja-trn-2', target: '次の電車は何時ですか？', translation: 'What time is the next train?' },
    ],
    keigo: [
      { id: 'ja-kei-1', target: 'よろしくお願いいたします', translation: 'I look forward to working with you' },
      { id: 'ja-kei-2', target: 'お世話になっております', translation: 'Thank you for your continued support' },
    ],
  },
  de: {
    bakery: [
      { id: 'de-bak-1', target: 'Einmal das Brötchen, bitte', translation: 'One bread roll, please' },
      { id: 'de-bak-2', target: 'Was kostet das Brot?', translation: 'How much is the bread?' },
    ],
    office: [
      { id: 'de-off-1', target: 'Wie war dein Wochenende?', translation: 'How was your weekend?' },
      { id: 'de-off-2', target: 'Ich arbeite seit drei Jahren hier', translation: "I've worked here for three years" },
    ],
    travel: [
      { id: 'de-trv-1', target: 'Ein Zimmer für zwei Nächte, bitte', translation: 'A room for two nights, please' },
      { id: 'de-trv-2', target: 'Wann ist das Frühstück?', translation: 'When is breakfast?' },
    ],
  },
  pt: {
    praia: [
      { id: 'pt-pra-1', target: 'Uma água, por favor', translation: 'A water, please' },
      { id: 'pt-pra-2', target: 'Que dia lindo!', translation: 'What a beautiful day!' },
    ],
    feira: [
      { id: 'pt-fei-1', target: 'Quanto custa o quilo?', translation: 'How much per kilo?' },
      { id: 'pt-fei-2', target: 'Me dá um quilo, por favor', translation: 'Give me a kilo, please' },
    ],
    work: [
      { id: 'pt-wrk-1', target: 'Como foi o seu fim de semana?', translation: 'How was your weekend?' },
      { id: 'pt-wrk-2', target: 'Vamos marcar uma reunião', translation: "Let's schedule a meeting" },
    ],
  },
  ru: {
    metro: [
      { id: 'ru-met-1', target: 'Где находится метро?', translation: 'Where is the metro?' },
      { id: 'ru-met-2', target: 'Поедем на такси', translation: 'Let\u2019s take a taxi' },
    ],
    cafe: [
      { id: 'ru-caf-1', target: 'Одно кофе, пожалуйста', translation: 'One coffee, please' },
      { id: 'ru-caf-2', target: 'Счёт, пожалуйста', translation: 'The bill, please' },
    ],
    meet: [
      { id: 'ru-met-a', target: 'Приятно познакомиться', translation: 'Nice to meet you' },
      { id: 'ru-met-b', target: 'Как тебя зовут?', translation: "What's your name?" },
    ],
  },
  sw: {
    market: [
      { id: 'sw-mkt-1', target: 'Hii ni bei gani?', translation: 'How much is this?' },
      { id: 'sw-mkt-2', target: 'Nataka kilo moja', translation: 'I want one kilo' },
    ],
    safari: [
      { id: 'sw-saf-1', target: 'Nataka kuona tembo', translation: "I'd like to see elephants" },
      { id: 'sw-saf-2', target: 'Tutaenda wapi kwanza?', translation: 'Where will we go first?' },
    ],
    greetings: [
      { id: 'sw-grt-1', target: 'Habari yako?', translation: 'How are you?' },
      { id: 'sw-grt-2', target: 'Nimefurahi kukutana nawe', translation: 'I\u2019m happy to meet you' },
    ],
  },
};

/** Non-Latin scripts score per character instead of per word. */
export const CHAR_BASED_LANGUAGES = new Set(['zh', 'ja']);

export function getPracticePhrases(languageId: string, scenarioId: string): PracticePhrase[] {
  const curated = PRACTICE_PHRASES[languageId]?.[scenarioId];
  if (curated && curated.length > 0) return curated;

  // Fallback for the wider 2.0 atlas: derive a short, real practice set from
  // the bundled starter words (never an empty practice screen).
  const pack = STARTERS[languageId];
  if (!pack || pack.essentials.length === 0) return [];
  const offset = Array.from(scenarioId).reduce((hash, char) => hash + char.charCodeAt(0), 0);
  return Array.from({ length: 3 }).map((_, index) => {
    const word = pack.essentials[(offset + index * 3) % pack.essentials.length];
    return {
      id: `${languageId}-${scenarioId}-starter-${index}`,
      target: word.target,
      translation: word.english,
    };
  });
}
