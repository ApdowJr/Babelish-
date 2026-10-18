/**
 * Seed language data — real languages with their real native names,
 * speaker counts, script notes, dialect coverage, and starter scenarios.
 * Full CEFR curricula arrive in Phase 1 (see ROADMAP.md).
 */
export type Scenario = {
  id: string;
  title: string;
  emoji: string;
};

export type Language = {
  id: string;
  name: string;
  nativeName: string;
  flag: string;
  /** Native speakers, approximate (Ethnologue/UNESCO ballpark figures). */
  nativeSpeakers: string;
  /** BCP-47 locale used for text-to-speech so the voice sounds native. */
  ttsLocale: string;
  script: string;
  dialects: string[];
  blurb: string;
  scenarios: Scenario[];
};

export const LANGUAGES: Language[] = [
  {
    id: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    nativeSpeakers: '560M native',
    ttsLocale: 'es-ES',
    script: 'Latin',
    dialects: ['Spain', 'México', 'Argentina (voseo)', 'Colombia'],
    blurb:
      'The second-most spoken native language on Earth — from Madrid café culture to Mexican telenovelas.',
    scenarios: [
      { id: 'cafe', title: 'Ordering at a café', emoji: '☕' },
      { id: 'directions', title: 'Asking for directions', emoji: '🧭' },
      { id: 'interview', title: 'Job interview', emoji: '💼' },
    ],
  },
  {
    id: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    flag: '🇸🇦',
    nativeSpeakers: '380M native',
    ttsLocale: 'ar-EG',
    script: 'Arabic (right-to-left)',
    dialects: ['Modern Standard (الفصحى)', 'Egyptian', 'Levantine', 'Gulf'],
    blurb:
      'One language, many worlds: read the news in Modern Standard, order food in Egyptian, greet family in Levantine.',
    scenarios: [
      { id: 'market', title: 'Bargaining at a souk', emoji: '🧺' },
      { id: 'family', title: 'Meeting the family', emoji: '🫒' },
      { id: 'travel', title: 'Airport & travel', emoji: '✈️' },
    ],
  },
  {
    id: 'zh',
    name: 'Mandarin Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    nativeSpeakers: '920M native',
    ttsLocale: 'zh-CN',
    script: '中文 characters',
    dialects: ['Mandarin (普通话)', 'Cantonese (广东话)'],
    blurb:
      'The most spoken native language in the world. Tones first, characters next — we teach both the right way.',
    scenarios: [
      { id: 'dimsum', title: 'Ordering dim sum', emoji: '🥟' },
      { id: 'smalltalk', title: 'Everyday small talk', emoji: '💬' },
      { id: 'business', title: 'Business meeting', emoji: '🤝' },
    ],
  },
  {
    id: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    nativeSpeakers: '80M native',
    ttsLocale: 'fr-FR',
    script: 'Latin',
    dialects: ['France', 'Québécois', 'Afrique francophone'],
    blurb:
      'From a Parisian bistro to a Dakar market — the language of diplomacy, cuisine, and 320M speakers.',
    scenarios: [
      { id: 'bistro', title: 'At the bistro', emoji: '🥐' },
      { id: 'networking', title: 'Networking event', emoji: '🍸' },
      { id: 'travel', title: 'Train & travel', emoji: '🚄' },
    ],
  },
  {
    id: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    flag: '🇮🇳',
    nativeSpeakers: '600M+ native',
    ttsLocale: 'hi-IN',
    script: 'देवनागरी',
    dialects: ['Standard Hindi', 'Hinglish (informal)'],
    blurb:
      'Bollywood, bazaars, and 600 million native speakers. Learn the script and the street talk side by side.',
    scenarios: [
      { id: 'market', title: 'Shopping in a bazaar', emoji: '🛍️' },
      { id: 'family', title: 'Family gatherings', emoji: '🪔' },
      { id: 'directions', title: 'Getting around', emoji: '🛺' },
    ],
  },
  {
    id: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    nativeSpeakers: '125M native',
    ttsLocale: 'ja-JP',
    script: 'ひらがな · カタカナ · 漢字',
    dialects: ['標準語', 'Kansai (関西弁)'],
    blurb:
      'Keigo politeness levels, konbini small talk, Kansai comedy — Japanese with its real registers.',
    scenarios: [
      { id: 'konbini', title: 'At the konbini', emoji: '🏪' },
      { id: 'train', title: 'Train station', emoji: '🚄' },
      { id: 'keigo', title: 'Business (敬語)', emoji: '🎌' },
    ],
  },
  {
    id: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    nativeSpeakers: '130M native',
    ttsLocale: 'de-DE',
    script: 'Latin',
    dialects: ['Hochdeutsch', 'Österreichisch', 'Schweizerdeutsch'],
    blurb:
      'Three genders, four cases, zero nonsense — the bakery-ordering kind of German, not the textbook kind.',
    scenarios: [
      { id: 'bakery', title: 'At the bakery', emoji: '🥨' },
      { id: 'office', title: 'Office small talk', emoji: '💼' },
      { id: 'travel', title: 'Travel & hotels', emoji: '🧳' },
    ],
  },
  {
    id: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    flag: '🇧🇷',
    nativeSpeakers: '250M native',
    ttsLocale: 'pt-BR',
    script: 'Latin',
    dialects: ['Brasileiro', 'Português de Portugal'],
    blurb:
      'From Rio’s beach kiosks to Lisbon’s tram 28 — one language, two unmistakable accents.',
    scenarios: [
      { id: 'praia', title: 'At the beach', emoji: '🏖️' },
      { id: 'feira', title: 'At the feira', emoji: '🥭' },
      { id: 'work', title: 'Workplace chat', emoji: '💻' },
    ],
  },
  {
    id: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    flag: '🇷🇺',
    nativeSpeakers: '155M native',
    ttsLocale: 'ru-RU',
    script: 'Cyrillic (Кириллица)',
    dialects: ['Standard Russian', 'Colloquial speech'],
    blurb:
      'Cyrillic in a week, cases without the pain — metro small talk and café Russian that locals actually use.',
    scenarios: [
      { id: 'metro', title: 'The metro', emoji: '🚇' },
      { id: 'cafe', title: 'Café conversation', emoji: '☕' },
      { id: 'meet', title: 'Meeting people', emoji: '🤝' },
    ],
  },
  {
    id: 'sw',
    name: 'Swahili',
    nativeName: 'Kiswahili',
    flag: '🇰🇪',
    nativeSpeakers: '100M+ speakers',
    ttsLocale: 'sw-KE',
    script: 'Latin',
    dialects: ['Standard Swahili', 'Sheng (informal)'],
    blurb:
      'The lingua franca of East Africa — straightforward grammar, beautiful proverbs, and huge warmth.',
    scenarios: [
      { id: 'market', title: 'Market bargaining', emoji: '🧺' },
      { id: 'safari', title: 'On safari', emoji: '🦁' },
      { id: 'greetings', title: 'Greetings & respect', emoji: '🙌' },
    ],
  },
];

export const DEFAULT_LANGUAGE_ID = 'es';

export function getLanguage(id: string): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}
