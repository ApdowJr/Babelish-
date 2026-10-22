import { choose, listen, speak, typeEx } from '@/data/curriculum/helpers';
import { starterPack, type StarterWord } from '@/data/starters';
import type { ChapterSource, ExerciseSource, LessonSource } from '@/lib/curriculum/types';

/**
 * Starter curriculum for every language in the atlas.
 *
 * 2.0 made these real, fully playable packs (not one-off samplers): each
 * language ships "First words" (12 essentials) and "Numbers 1–10". Content is
 * generated deterministically from the vetted word lists in
 * `src/data/starters.ts`, so every language has the same quality bar and the
 * whole pack works offline.
 */

export type Word = StarterWord;

function uniqueOptions(correct: string, pool: string[], fallback: string[]): string[] {
  const options = [correct];
  for (const candidate of [...pool, ...fallback]) {
    if (options.length >= 4) break;
    if (!options.includes(candidate)) options.push(candidate);
  }
  return options;
}

/** Builds a lesson from a word list: 4 choose → 3 type → 3 listen → rest speak. */
function buildLesson(
  title: string,
  goal: string,
  words: StarterWord[],
  allTargets: string[],
  allEnglish: string[]
): LessonSource {
  const target = words.map((w) => w.target);
  const english = words.map((w) => w.english);
  const exercises: ExerciseSource[] = [];

  // 1) choose — target word → English meaning
  words.slice(0, 4).forEach((word, index) => {
    const options = uniqueOptions(
      word.english,
      [
        english[(index + 3) % english.length],
        english[(index + 5) % english.length],
        english[(index + 7) % english.length],
      ],
      allEnglish
    );
    exercises.push(
      choose(word.target, options, word.english, {
        prompt: 'What does this word mean?',
        note: `“${word.target}” = ${word.english}.`,
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  // 2) type — English → target word
  words.slice(4, 7).forEach((word) => {
    exercises.push(
      typeEx('Write it in the language', word.english, [word.target], {
        hint: word.roman ? `Sounds like: ${word.roman}` : 'Type exactly as shown in the example words.',
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  // 3) listen — hear the target word, pick what you heard
  words.slice(7, 10).forEach((word, index) => {
    const options = uniqueOptions(
      word.target,
      [
        target[(index + 2) % target.length],
        target[(index + 4) % target.length],
        target[(index + 6) % target.length],
      ],
      allTargets
    );
    exercises.push(
      listen(word.target, options, {
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  // 4) speak — say the remaining words out loud with the native voice
  words.slice(10).forEach((word) => {
    exercises.push(
      speak(word.target, {
        prompt: 'Say it out loud',
        note: word.roman ? `${word.roman} — ${word.english}` : word.english,
        vocab: { target: word.target, translation: word.english },
      })
    );
  });

  return { title, goal, exercises };
}

/**
 * Two-chapter starter pack for a language: First words + Numbers 1–10.
 * Returns [] when the language has no curated starter list (shouldn't happen
 * for anything in the atlas — a test guards it).
 */
export function samplerChapters(languageId: string): ChapterSource[] {
  const pack = starterPack(languageId);
  if (!pack) return [];

  const essentials = pack.essentials.slice(0, 12);
  const numbers = pack.numbers.slice(0, 10);
  const allTargets = [...essentials, ...numbers].map((w) => w.target);
  const allEnglish = [...essentials, ...numbers].map((w) => w.english);

  return [
    {
      cefr: 'A1',
      title: 'First words',
      description: 'Hello, thank you, please — the twelve words that open every conversation.',
      lessons: [
        buildLesson(
          'Say hello',
          'Greet someone, be polite, and ask how they are',
          essentials,
          allTargets,
          allEnglish
        ),
      ],
    },
    {
      cefr: 'A1',
      title: 'Numbers 1–10',
      description: 'Count, ask prices and catch a phone number at the first try.',
      lessons: [
        buildLesson(
          'Count to ten',
          'Recognise and say the numbers one to ten',
          numbers,
          allTargets,
          allEnglish
        ),
      ],
    },
  ];
}
