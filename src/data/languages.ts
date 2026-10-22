/**
 * Seed language data — real languages with their real native names, speaker
 * counts, scripts, dialect coverage, and starter scenarios.
 *
 * 2.0 widened the atlas from 10 to 24 languages. Every language here ships a
 * bundled, fully playable starter pack (see `src/data/starters.ts`), so the
 * "free forever" promise is literal: nothing below is a locked preview.
 */
export type Scenario = {
  id: string;
  title: string;
  emoji: string;
};

export type RegionId = 'europe' | 'asia' | 'africa' | 'americas' | 'middle-east';

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
  /** Reading direction for the script. Defaults to ltr. */
  direction?: 'ltr' | 'rtl';
  /** 1 = close to English, 2 = a real script/case effort, 3 = new script + tones. */
  difficulty: 1 | 2 | 3;
  /** Language family, for the "did you know" cards. */
  family: string;
  regions: RegionId[];
  dialects: string[];
  blurb: string;
  /** One greeting shown on cards and in onboarding. */
  greeting: { text: string; roman?: string; meaning: string };
  scenarios: Scenario[];
  /** Hand-picked for the home screen's "Start somewhere new" rail. */
  featured?: boolean;
};

export const REGIONS: { id: RegionId; label: string; emoji: string }[] = [
  { id: 'europe', label: 'Europe', emoji: '🏛️' },
  { id: 'asia', label: 'Asia', emoji: '🌏' },
  { id: 'africa', label: 'Africa', emoji: '🌍' },
  { id: 'americas', label: 'Americas', emoji: '🌎' },
  { id: 'middle-east', label: 'Middle East', emoji: '🕌' },
];

export const LANGUAGES: Language[] = [
  {
    id: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    nativeSpeakers: '560M native',
    ttsLocale: 'es-ES',
    script: 'Latin',
    difficulty: 1,
    family: 'Romance',
    regions: ['europe', 'americas'],
    dialects: ['Spain', 'México', 'Argentina (voseo)', 'Colombia'],
    blurb:
      'The second-most spoken native language on Earth — from Madrid café culture to Mexican telenovelas.',
    greeting: { text: '¡Hola!', meaning: 'Hello!' },
    featured: true,
    scenarios: [
      { id: 'cafe', title: 'Ordering at a café', emoji: '☕' },
      { id: 'directions', title: 'Asking for directions', emoji: '🧭' },
      { id: 'interview', title: 'Job interview', emoji: '💼' },
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
    difficulty: 1,
    family: 'Romance',
    regions: ['europe', 'africa'],
    dialects: ['France', 'Québécois', 'Afrique francophone'],
    blurb:
      'From a Parisian bistro to a Dakar market — the language of diplomacy, cuisine, and 320M speakers.',
    greeting: { text: 'Bonjour !', meaning: 'Hello!' },
    featured: true,
    scenarios: [
      { id: 'bistro', title: 'At the bistro', emoji: '🥐' },
      { id: 'networking', title: 'Networking event', emoji: '🍸' },
      { id: 'travel', title: 'Train & travel', emoji: '🚄' },
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
    difficulty: 1,
    family: 'Germanic',
    regions: ['europe'],
    dialects: ['Hochdeutsch', 'Österreichisch', 'Schweizerdeutsch'],
    blurb:
      'Three genders, four cases, zero nonsense — the bakery-ordering kind of German, not the textbook kind.',
    greeting: { text: 'Hallo!', meaning: 'Hello!' },
    scenarios: [
      { id: 'bakery', title: 'At the bakery', emoji: '🥨' },
      { id: 'office', title: 'Office small talk', emoji: '💼' },
      { id: 'travel', title: 'Travel & hotels', emoji: '🧳' },
    ],
  },
  {
    id: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    flag: '🇮🇹',
    nativeSpeakers: '65M native',
    ttsLocale: 'it-IT',
    script: 'Latin',
    difficulty: 1,
    family: 'Romance',
    regions: ['europe'],
    dialects: ['Italiano standard', 'Napoletano', 'Siciliano'],
    blurb:
      'Hand gestures optional, rhythm essential. Order like a local from Milano to Palermo.',
    greeting: { text: 'Ciao!', meaning: 'Hello!' },
    scenarios: [
      { id: 'cafe', title: 'At the espresso bar', emoji: '☕' },
      { id: 'market', title: 'At the market', emoji: '🍅' },
      { id: 'travel', title: 'Train & travel', emoji: '🚆' },
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
    difficulty: 1,
    family: 'Romance',
    regions: ['americas', 'europe', 'africa'],
    dialects: ['Brasileiro', 'Português de Portugal'],
    blurb:
      'From Rio’s beach kiosks to Lisbon’s tram 28 — one language, two unmistakable accents.',
    greeting: { text: 'Olá!', meaning: 'Hello!' },
    scenarios: [
      { id: 'praia', title: 'At the beach', emoji: '🏖️' },
      { id: 'feira', title: 'At the feira', emoji: '🥭' },
      { id: 'work', title: 'Workplace chat', emoji: '💻' },
    ],
  },
  {
    id: 'nl',
    name: 'Dutch',
    nativeName: 'Nederlands',
    flag: '🇳🇱',
    nativeSpeakers: '25M native',
    ttsLocale: 'nl-NL',
    script: 'Latin',
    difficulty: 1,
    family: 'Germanic',
    regions: ['europe'],
    dialects: ['Nederlands', 'Vlaams (België)', 'Surinaams'],
    blurb:
      'Direct, friendly and full of cycling small talk — the practical Dutch you will actually use.',
    greeting: { text: 'Hallo!', meaning: 'Hello!' },
    scenarios: [
      { id: 'cafe', title: 'At the café', emoji: '☕' },
      { id: 'bike', title: 'Bike & travel', emoji: '🚲' },
      { id: 'work', title: 'Office small talk', emoji: '💼' },
    ],
  },
  {
    id: 'sv',
    name: 'Swedish',
    nativeName: 'Svenska',
    flag: '🇸🇪',
    nativeSpeakers: '10M native',
    ttsLocale: 'sv-SE',
    script: 'Latin',
    difficulty: 1,
    family: 'Germanic',
    regions: ['europe'],
    dialects: ['Rikssvenska', 'Skånska', 'Finlandssvenska'],
    blurb:
      'Calm, musical and unexpectedly easy — fika small talk and forest-cabin vocabulary included.',
    greeting: { text: 'Hej!', meaning: 'Hello!' },
    scenarios: [
      { id: 'fika', title: 'Coffee break (fika)', emoji: '☕' },
      { id: 'nature', title: 'Out in nature', emoji: '🌲' },
      { id: 'travel', title: 'Getting around', emoji: '🚋' },
    ],
  },
  {
    id: 'pl',
    name: 'Polish',
    nativeName: 'Polski',
    flag: '🇵🇱',
    nativeSpeakers: '40M native',
    ttsLocale: 'pl-PL',
    script: 'Latin',
    difficulty: 2,
    family: 'Slavic',
    regions: ['europe'],
    dialects: ['Standard Polish', 'Śląski', 'Kaszubski'],
    blurb:
      'Seven cases, endless charm. Learn the phrases that make Polish grandmothers feed you.',
    greeting: { text: 'Cześć!', meaning: 'Hi!' },
    scenarios: [
      { id: 'cafe', title: 'At the café', emoji: '☕' },
      { id: 'shop', title: 'At the shop', emoji: '🥖' },
      { id: 'travel', title: 'Train & travel', emoji: '🚆' },
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
    difficulty: 2,
    family: 'Slavic',
    regions: ['europe', 'asia'],
    dialects: ['Standard Russian', 'Colloquial speech'],
    blurb:
      'Cyrillic in a week, cases without the pain — metro small talk and café Russian that locals actually use.',
    greeting: { text: 'Привет!', roman: 'Privet!', meaning: 'Hi!' },
    scenarios: [
      { id: 'metro', title: 'The metro', emoji: '🚇' },
      { id: 'cafe', title: 'Café conversation', emoji: '☕' },
      { id: 'meet', title: 'Meeting people', emoji: '🤝' },
    ],
  },
  {
    id: 'uk',
    name: 'Ukrainian',
    nativeName: 'Українська',
    flag: '🇺🇦',
    nativeSpeakers: '40M native',
    ttsLocale: 'uk-UA',
    script: 'Cyrillic (Кирилиця)',
    difficulty: 2,
    family: 'Slavic',
    regions: ['europe'],
    dialects: ['Standard Ukrainian', 'Western (Lviv)', 'Eastern'],
    blurb:
      'Melodic, expressive and full of song — start with the greetings that open every door.',
    greeting: { text: 'Привіт!', roman: 'Pryvit!', meaning: 'Hi!' },
    scenarios: [
      { id: 'cafe', title: 'At the café', emoji: '☕' },
      { id: 'market', title: 'At the market', emoji: '🥕' },
      { id: 'travel', title: 'Travel & trains', emoji: '🚆' },
    ],
  },
  {
    id: 'el',
    name: 'Greek',
    nativeName: 'Ελληνικά',
    flag: '🇬🇷',
    nativeSpeakers: '13M native',
    ttsLocale: 'el-GR',
    script: 'Greek (Ελληνικό)',
    difficulty: 2,
    family: 'Hellenic',
    regions: ['europe'],
    dialects: ['Standard Modern Greek', 'Cretan', 'Pontic'],
    blurb:
      'The alphabet that gave the world half its words — learn it with island café phrases.',
    greeting: { text: 'Γεια σου!', roman: 'Yassou!', meaning: 'Hello!' },
    scenarios: [
      { id: 'taverna', title: 'At the taverna', emoji: '🫒' },
      { id: 'beach', title: 'At the beach', emoji: '🏖️' },
      { id: 'directions', title: 'Finding your way', emoji: '🧭' },
    ],
  },
  {
    id: 'tr',
    name: 'Turkish',
    nativeName: 'Türkçe',
    flag: '🇹🇷',
    nativeSpeakers: '90M native',
    ttsLocale: 'tr-TR',
    script: 'Latin',
    difficulty: 2,
    family: 'Turkic',
    regions: ['middle-east', 'europe', 'asia'],
    dialects: ['İstanbul Türkçesi', 'Anadolu', 'Kıbrıs Türkçesi'],
    blurb:
      'Vowel harmony, warm hospitality and the best breakfast culture on two continents.',
    greeting: { text: 'Merhaba!', meaning: 'Hello!' },
    scenarios: [
      { id: 'kahvalti', title: 'Breakfast table', emoji: '🫖' },
      { id: 'market', title: 'At the bazaar', emoji: '🧺' },
      { id: 'travel', title: 'Getting around', emoji: '🚋' },
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
    direction: 'rtl',
    difficulty: 3,
    family: 'Semitic',
    regions: ['middle-east', 'africa'],
    dialects: ['Modern Standard (الفصحى)', 'Egyptian', 'Levantine', 'Gulf'],
    blurb:
      'One language, many worlds: read the news in Modern Standard, order food in Egyptian, greet family in Levantine.',
    greeting: { text: 'مرحبًا', roman: 'Marhaban', meaning: 'Hello' },
    featured: true,
    scenarios: [
      { id: 'market', title: 'Bargaining at a souk', emoji: '🧺' },
      { id: 'family', title: 'Meeting the family', emoji: '🫒' },
      { id: 'travel', title: 'Airport & travel', emoji: '✈️' },
    ],
  },
  {
    id: 'he',
    name: 'Hebrew',
    nativeName: 'עברית',
    flag: '🇮🇱',
    nativeSpeakers: '9M native',
    ttsLocale: 'he-IL',
    script: 'Hebrew (right-to-left)',
    direction: 'rtl',
    difficulty: 3,
    family: 'Semitic',
    regions: ['middle-east'],
    dialects: ['Modern Hebrew (עברית מודרנית)', 'Biblical (liturgical)'],
    blurb:
      'An ancient script brought back to daily life — read right to left and start with the street basics.',
    greeting: { text: 'שלום', roman: 'Shalom', meaning: 'Hello / peace' },
    scenarios: [
      { id: 'cafe', title: 'At the café', emoji: '☕' },
      { id: 'market', title: 'At the shuk', emoji: '🍅' },
      { id: 'travel', title: 'Buses & trains', emoji: '🚌' },
    ],
  },
  {
    id: 'fa',
    name: 'Persian',
    nativeName: 'فارسی',
    flag: '🇮🇷',
    nativeSpeakers: '80M native',
    ttsLocale: 'fa-IR',
    script: 'Perso-Arabic (right-to-left)',
    direction: 'rtl',
    difficulty: 3,
    family: 'Indo-Iranian',
    regions: ['middle-east', 'asia'],
    dialects: ['Tehrani', 'Dari (Afghanistan)', 'Tajik'],
    blurb:
      'The language of poetry and hospitality — politely persistent taarof included.',
    greeting: { text: 'سلام', roman: 'Salam', meaning: 'Hello' },
    scenarios: [
      { id: 'tea', title: 'Tea house', emoji: '🫖' },
      { id: 'bazaar', title: 'At the bazaar', emoji: '🧺' },
      { id: 'family', title: 'Family gathering', emoji: '🍚' },
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
    difficulty: 3,
    family: 'Indo-Aryan',
    regions: ['asia'],
    dialects: ['Standard Hindi', 'Hinglish (informal)'],
    blurb:
      'Bollywood, bazaars, and 600 million native speakers. Learn the script and the street talk side by side.',
    greeting: { text: 'नमस्ते', roman: 'Namaste', meaning: 'Hello' },
    featured: true,
    scenarios: [
      { id: 'market', title: 'Shopping in a bazaar', emoji: '🛍️' },
      { id: 'family', title: 'Family gatherings', emoji: '🪔' },
      { id: 'directions', title: 'Getting around', emoji: '🛺' },
    ],
  },
  {
    id: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    flag: '🇧🇩',
    nativeSpeakers: '230M native',
    ttsLocale: 'bn-BD',
    script: 'বাংলা script',
    difficulty: 3,
    family: 'Indo-Aryan',
    regions: ['asia'],
    dialects: ['West Bengal', 'Bangladeshi', 'Sylheti'],
    blurb:
      'The language of Tagore and adda — long conversations over tea, sweet words and sweets.',
    greeting: { text: 'নমস্কার', roman: 'Nomoshkar', meaning: 'Hello' },
    scenarios: [
      { id: 'tea', title: 'Tea stall', emoji: '🫖' },
      { id: 'market', title: 'At the bazaar', emoji: '🛍️' },
      { id: 'family', title: 'Meeting the family', emoji: '🍚' },
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
    difficulty: 3,
    family: 'Sino-Tibetan',
    regions: ['asia'],
    dialects: ['Mandarin (普通话)', 'Cantonese (广东话)'],
    blurb:
      'The most spoken native language in the world. Tones first, characters next — we teach both the right way.',
    greeting: { text: '你好', roman: 'Nǐ hǎo', meaning: 'Hello' },
    featured: true,
    scenarios: [
      { id: 'dimsum', title: 'Ordering dim sum', emoji: '🥟' },
      { id: 'smalltalk', title: 'Everyday small talk', emoji: '💬' },
      { id: 'business', title: 'Business meeting', emoji: '🤝' },
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
    difficulty: 3,
    family: 'Japonic',
    regions: ['asia'],
    dialects: ['標準語', 'Kansai (関西弁)'],
    blurb:
      'Keigo politeness levels, konbini small talk, Kansai comedy — Japanese with its real registers.',
    greeting: { text: 'こんにちは', roman: 'Konnichiwa', meaning: 'Hello' },
    featured: true,
    scenarios: [
      { id: 'konbini', title: 'At the konbini', emoji: '🏪' },
      { id: 'train', title: 'Train station', emoji: '🚄' },
      { id: 'keigo', title: 'Business (敬語)', emoji: '🎌' },
    ],
  },
  {
    id: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    nativeSpeakers: '82M native',
    ttsLocale: 'ko-KR',
    script: '한글 (Hangul)',
    difficulty: 3,
    family: 'Koreanic',
    regions: ['asia'],
    dialects: ['서울 표준어', 'Busan (사투리)'],
    blurb:
      'Hangul takes an afternoon to read — then it is K-dramas, cafés and polite endings all the way.',
    greeting: { text: '안녕하세요', roman: 'Annyeonghaseyo', meaning: 'Hello' },
    featured: true,
    scenarios: [
      { id: 'cafe', title: 'At the café', emoji: '☕' },
      { id: 'convenience', title: 'Convenience store', emoji: '🏪' },
      { id: 'friends', title: 'Meeting friends', emoji: '🎶' },
    ],
  },
  {
    id: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    nativeSpeakers: '85M native',
    ttsLocale: 'vi-VN',
    script: 'Latin (Chữ Quốc Ngữ)',
    difficulty: 2,
    family: 'Austroasiatic',
    regions: ['asia'],
    dialects: ['Northern (Hanoi)', 'Southern (Saigon)', 'Central (Huế)'],
    blurb:
      'Six tones, one delicious street-food vocabulary. Say it right and the phở tastes better.',
    greeting: { text: 'Xin chào', meaning: 'Hello' },
    scenarios: [
      { id: 'pho', title: 'At the phở stall', emoji: '🍜' },
      { id: 'market', title: 'At the market', emoji: '🧺' },
      { id: 'travel', title: 'Motorbike & travel', emoji: '🛵' },
    ],
  },
  {
    id: 'th',
    name: 'Thai',
    nativeName: 'ไทย',
    flag: '🇹🇭',
    nativeSpeakers: '70M native',
    ttsLocale: 'th-TH',
    script: 'Thai (อักษรไทย)',
    difficulty: 3,
    family: 'Kra-Dai',
    regions: ['asia'],
    dialects: ['Central Thai', 'Northern (Lanna)', 'Isan'],
    blurb:
      'Five tones and endless kindness — order street food, haggle gently, and learn the polite particles that open doors.',
    greeting: { text: 'สวัสดี', roman: 'Sawasdee', meaning: 'Hello' },
    scenarios: [
      { id: 'streetfood', title: 'Street food', emoji: '🍜' },
      { id: 'market', title: 'At the market', emoji: '🧺' },
      { id: 'travel', title: 'Temples & travel', emoji: '🛕' },
    ],
  },
  {
    id: 'id',
    name: 'Indonesian',
    nativeName: 'Bahasa Indonesia',
    flag: '🇮🇩',
    nativeSpeakers: '45M native',
    ttsLocale: 'id-ID',
    script: 'Latin',
    difficulty: 1,
    family: 'Austronesian',
    regions: ['asia'],
    dialects: ['Bahasa baku', 'Colloquial Jakarta', 'Javanese-influenced'],
    blurb:
      'One of the friendliest grammars on Earth — no tenses, no genders, just start speaking.',
    greeting: { text: 'Halo!', meaning: 'Hello!' },
    scenarios: [
      { id: 'warung', title: 'At the warung', emoji: '🍛' },
      { id: 'market', title: 'At the market', emoji: '🧺' },
      { id: 'travel', title: 'Island travel', emoji: '🏝️' },
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
    difficulty: 1,
    family: 'Bantu',
    regions: ['africa'],
    dialects: ['Standard Swahili', 'Sheng (informal)', 'Kimvita (coastal)'],
    blurb:
      'The lingua franca of East Africa — straightforward grammar, beautiful proverbs, and huge warmth.',
    greeting: { text: 'Habari!', meaning: 'Hello!' },
    featured: true,
    scenarios: [
      { id: 'market', title: 'Market bargaining', emoji: '🧺' },
      { id: 'safari', title: 'On safari', emoji: '🦁' },
      { id: 'greetings', title: 'Greetings & respect', emoji: '🙌' },
    ],
  },
  {
    id: 'so',
    name: 'Somali',
    nativeName: 'Soomaali',
    flag: '🇸🇴',
    nativeSpeakers: '25M+ speakers',
    ttsLocale: 'so-SO',
    script: 'Latin',
    difficulty: 1,
    family: 'Afroasiatic (Cushitic)',
    regions: ['africa'],
    dialects: ['Northern Somali', 'Benadiri', 'Maay'],
    blurb:
      'Learn everyday Soomaali for greetings, family, travel, and connecting across the Horn of Africa and its global diaspora.',
    greeting: { text: 'Salaan!', meaning: 'Hello!' },
    featured: true,
    scenarios: [
      { id: 'greetings', title: 'Greetings & respect', emoji: '🤝' },
      { id: 'family', title: 'Family & friends', emoji: '👨‍👩‍👧‍👦' },
      { id: 'market', title: 'At the market', emoji: '🧺' },
    ],
  },
];

export const DEFAULT_LANGUAGE_ID = 'es';

/**
 * Languages that get weekly human-reviewed curriculum updates first. The rest
 * are fully playable starter packs (not locked previews) — the label is about
 * content cadence, not access.
 */
export const BETA_LANGUAGE_IDS = ['es', 'ar', 'ja', 'fr', 'hi', 'zh'] as const;

export type LanguageStatus = 'beta' | 'preview';

export function languageStatus(id: string): LanguageStatus {
  return (BETA_LANGUAGE_IDS as readonly string[]).includes(id) ? 'beta' : 'preview';
}

export function getLanguage(id: string): Language {
  return LANGUAGES.find((l) => l.id === id) ?? LANGUAGES[0];
}

export function findLanguage(id: string): Language | null {
  return LANGUAGES.find((l) => l.id === id) ?? null;
}

export function isKnownLanguage(id: string): boolean {
  return LANGUAGES.some((l) => l.id === id);
}

/** Language count is derived from the atlas so copy can stay in sync. */
export const LANGUAGE_COUNT = LANGUAGES.length;

export const FEATURED_LANGUAGES = LANGUAGES.filter((language) => language.featured);

export const DIFFICULTY_LABEL: Record<Language['difficulty'], string> = {
  1: 'Easy start',
  2: 'Some effort',
  3: 'New script',
};

/** Accent-stripped search over name, native name, script and dialects. */
export function searchLanguages(query: string, region: RegionId | 'all' = 'all'): Language[] {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const q = normalize(query.trim());
  return LANGUAGES.filter((language) => {
    if (region !== 'all' && !language.regions.includes(region)) return false;
    if (!q) return true;
    return (
      normalize(language.name).includes(q) ||
      normalize(language.nativeName).includes(q) ||
      normalize(language.script).includes(q) ||
      normalize(language.family).includes(q) ||
      language.dialects.some((dialect) => normalize(dialect).includes(q))
    );
  });
}
