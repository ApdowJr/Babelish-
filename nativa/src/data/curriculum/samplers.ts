import { choose, typeEx, listen } from '@/data/curriculum/helpers';
import type { ChapterSource, ExerciseSource, LessonSource } from '@/lib/curriculum/types';

/**
 * Chapter-1 samplers for the nine non-Spanish languages: a real, playable
 * "First words" lesson built from a vetted word list. The full CEFR packs
 * for these languages arrive in later phases.
 */
export type Word = { target: string; english: string };

/**
 * Builds one lesson from a word list:
 *  → 4 "choose the meaning" + 3 "type the word" + 3 "listen & pick" + 1 speak
 * Options are drawn from the same list (deterministic rotation).
 */
function firstWords(words: Word[]): LessonSource {
  const english = words.map((w) => w.english);
  const target = words.map((w) => w.target);

  const exercises: ExerciseSource[] = [];

  // 1) choose — target word → English meaning (distractors from the list)
  words.slice(0, 4).forEach((word, i) => {
    const options = [
      word.english,
      english[(i + 3) % english.length],
      english[(i + 5) % english.length],
      english[(i + 7) % english.length],
    ].filter((value, index, self) => self.indexOf(value) === index);
    // Guarantee four distinct options even if rotation collided.
    for (const candidate of english) {
      if (options.length >= 4) break;
      if (!options.includes(candidate)) options.push(candidate);
    }
    exercises.push(
      choose(word.target, options, word.english, {
        note: `“${word.target}” = ${word.english}.`,
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  // 2) type — English → target word
  words.slice(4, 7).forEach((word) => {
    exercises.push(
      typeEx('Write it in the language', word.english, [word.target], {
        hint: 'Type exactly as shown in the example words.',
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  // 3) listen — hear the target word, pick what you heard
  words.slice(7, 10).forEach((word, i) => {
    const options = [
      word.target,
      target[(i + 2) % target.length],
      target[(i + 4) % target.length],
      target[(i + 6) % target.length],
    ].filter((value, index, self) => self.indexOf(value) === index);
    for (const candidate of target) {
      if (options.length >= 4) break;
      if (!options.includes(candidate)) options.push(candidate);
    }
    exercises.push(listen(word.target, options, {
      vocab: { target: word.target, translation: word.english },
    }));
  });

  return {
    title: 'First words',
    goal: 'Greetings and everyday essentials you can use immediately',
    exercises,
  };
}

function sampler(title: string, description: string, words: Word[]): ChapterSource {
  return { cefr: 'A1', title, description, lessons: [firstWords(words)] };
}

export const AR_SAMPLER = sampler(
  'First words in Arabic',
  'Read right to left: your first ten Arabic words, spoken in a native voice.',
  [
    { target: 'مرحبا', english: 'hello' },
    { target: 'شكرًا', english: 'thank you' },
    { target: 'نعم', english: 'yes' },
    { target: 'لا', english: 'no' },
    { target: 'من فضلك', english: 'please' },
    { target: 'صباح الخير', english: 'good morning' },
    { target: 'مساء الخير', english: 'good evening' },
    { target: 'كيف حالك؟', english: 'how are you?' },
    { target: 'أنا بخير', english: "I'm fine" },
    { target: 'مرحباً بك', english: 'welcome' },
  ]
);

export const ZH_SAMPLER = sampler(
  'First words in Mandarin',
  'Tones matter — listen to each word and echo it back.',
  [
    { target: '你好', english: 'hello' },
    { target: '谢谢', english: 'thank you' },
    { target: '请', english: 'please' },
    { target: '再见', english: 'goodbye' },
    { target: '早上好', english: 'good morning' },
    { target: '晚上好', english: 'good evening' },
    { target: '对不起', english: 'sorry' },
    { target: '你好吗', english: 'how are you?' },
    { target: '我很好', english: "I'm fine" },
    { target: '没关系', english: "it's okay" },
  ]
);

export const FR_SAMPLER = sampler(
  'First words in French',
  'From bonjour to ça va — the ten words that open every conversation.',
  [
    { target: 'bonjour', english: 'hello' },
    { target: 'merci', english: 'thank you' },
    { target: "s'il vous plaît", english: 'please' },
    { target: 'au revoir', english: 'goodbye' },
    { target: 'oui', english: 'yes' },
    { target: 'non', english: 'no' },
    { target: 'bonsoir', english: 'good evening' },
    { target: 'ça va', english: 'how are you?' },
    { target: 'je vais bien', english: "I'm fine" },
    { target: 'bienvenue', english: 'welcome' },
  ]
);

export const HI_SAMPLER = sampler(
  'First words in Hindi',
  'Devanagari script, spoken exactly as it is written.',
  [
    { target: 'नमस्ते', english: 'hello' },
    { target: 'धन्यवाद', english: 'thank you' },
    { target: 'कृपया', english: 'please' },
    { target: 'अलविदा', english: 'goodbye' },
    { target: 'हाँ', english: 'yes' },
    { target: 'नहीं', english: 'no' },
    { target: 'शुभ प्रभात', english: 'good morning' },
    { target: 'शुभ संध्या', english: 'good evening' },
    { target: 'आप कैसे हैं', english: 'how are you?' },
    { target: 'मैं ठीक हूँ', english: "I'm fine" },
  ]
);

export const JA_SAMPLER = sampler(
  'First words in Japanese',
  'Polite from word one — the greetings that carry Japanese culture.',
  [
    { target: 'こんにちは', english: 'hello' },
    { target: 'ありがとう', english: 'thank you' },
    { target: 'ください', english: 'please' },
    { target: 'さようなら', english: 'goodbye' },
    { target: 'はい', english: 'yes' },
    { target: 'いいえ', english: 'no' },
    { target: 'おはようございます', english: 'good morning' },
    { target: 'こんばんは', english: 'good evening' },
    { target: 'お元気ですか', english: 'how are you?' },
    { target: '元気です', english: "I'm fine" },
  ]
);

export const DE_SAMPLER = sampler(
  'First words in German',
  'Direct and useful — the first ten words you’ll hear in any German street.',
  [
    { target: 'hallo', english: 'hello' },
    { target: 'danke', english: 'thank you' },
    { target: 'bitte', english: 'please / you’re welcome' },
    { target: 'tschüss', english: 'goodbye' },
    { target: 'ja', english: 'yes' },
    { target: 'nein', english: 'no' },
    { target: 'guten Morgen', english: 'good morning' },
    { target: 'guten Abend', english: 'good evening' },
    { target: 'wie geht es dir', english: 'how are you?' },
    { target: 'mir geht es gut', english: "I'm fine" },
  ]
);

export const PT_SAMPLER = sampler(
  'First words in Portuguese',
  'Brazilian Portuguese warmth, from olá to tudo bem.',
  [
    { target: 'olá', english: 'hello' },
    { target: 'obrigado', english: 'thank you' },
    { target: 'por favor', english: 'please' },
    { target: 'tchau', english: 'goodbye' },
    { target: 'sim', english: 'yes' },
    { target: 'não', english: 'no' },
    { target: 'bom dia', english: 'good morning' },
    { target: 'boa noite', english: 'good evening' },
    { target: 'tudo bem', english: 'how are you? / all good' },
    { target: 'bem-vindo', english: 'welcome' },
  ]
);

export const RU_SAMPLER = sampler(
  'First words in Russian',
  'Cyrillic decoded — the ten words every Russian conversation starts with.',
  [
    { target: 'привет', english: 'hello' },
    { target: 'спасибо', english: 'thank you' },
    { target: 'пожалуйста', english: 'please / you’re welcome' },
    { target: 'до свидания', english: 'goodbye' },
    { target: 'да', english: 'yes' },
    { target: 'нет', english: 'no' },
    { target: 'доброе утро', english: 'good morning' },
    { target: 'добрый вечер', english: 'good evening' },
    { target: 'как дела', english: 'how are you?' },
    { target: 'хорошо', english: 'fine' },
  ]
);

export const SW_SAMPLER = sampler(
  'First words in Swahili',
  'East Africa’s lingua franca — warm, musical, and immediately useful.',
  [
    { target: 'habari', english: 'hello' },
    { target: 'asante', english: 'thank you' },
    { target: 'tafadhali', english: 'please' },
    { target: 'kwaheri', english: 'goodbye' },
    { target: 'ndiyo', english: 'yes' },
    { target: 'hapana', english: 'no' },
    { target: 'habari za asubuhi', english: 'good morning' },
    { target: 'habari ya jioni', english: 'good evening' },
    { target: 'habari yako', english: 'how are you?' },
    { target: 'nzuri', english: 'fine' },
  ]
);
