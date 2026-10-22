import { choose, listen, speak, typeEx } from './helpers';
import { starterPack, type StarterWord } from '../starters';
import type { ChapterSource, ExerciseSource, LessonSource } from '../../lib/curriculum/types';

/**
 * Starter courses for every language in the atlas.
 *
 * Design rule: generate *only* what the data proves. These lessons drill
 * verified single words (the curated starter packs) — choosing, typing,
 * listening and saying them. They deliberately do not invent example
 * sentences or grammar rules for languages we have not had native-reviewed.
 *
 * Structure (4 chapters · 8 lessons per language):
 *   1. First words        A1  — 12 essentials in two mixed lessons
 *   2. Numbers 1–10       A1  — two mixed lessons
 *   3. Listening lab      A1  — pure audio recognition of both sets
 *   4. Recall             A2  — typed + spoken production from memory
 */

export type Word = StarterWord;

type Focus = 'mixed' | 'listen' | 'recall';

function uniqueOptions(correct: string, pool: string[], fallback: string[]): string[] {
  const options = [correct];
  for (const candidate of [...pool, ...fallback]) {
    if (options.length >= 4) break;
    if (!options.includes(candidate)) options.push(candidate);
  }
  return options;
}

function englishOptions(word: StarterWord, words: StarterWord[], allEnglish: string[]): string[] {
  const index = words.indexOf(word);
  return uniqueOptions(
    word.english,
    [
      words[(index + 2) % words.length].english,
      words[(index + 4) % words.length].english,
      words[(index + 6) % words.length].english,
    ],
    allEnglish
  );
}

function targetOptions(word: StarterWord, words: StarterWord[], allTargets: string[]): string[] {
  const index = words.indexOf(word);
  return uniqueOptions(
    word.target,
    [
      words[(index + 1) % words.length].target,
      words[(index + 3) % words.length].target,
      words[(index + 5) % words.length].target,
    ],
    allTargets
  );
}

/**
 * Builds one lesson from a word slice.
 *
 * - `mixed`: meaning choice, typed production, audio recognition, then speak.
 * - `listen`: everything is an audio-recognition card (same words, new skill).
 * - `recall`: typed + spoken production only.
 */
function buildLesson(
  title: string,
  goal: string,
  words: StarterWord[],
  allWords: StarterWord[],
  focus: Focus
): LessonSource {
  if (words.length === 0) {
    return { title, goal, exercises: [] };
  }
  const allEnglish = allWords.map((word) => word.english);
  const allTargets = allWords.map((word) => word.target);
  const exercises: ExerciseSource[] = [];

  if (focus === 'listen') {
    for (const word of words) {
      exercises.push(
        listen(word.target, targetOptions(word, allWords, allTargets), {
          note: `“${word.target}” means “${word.english}”.`,
          vocab: { target: word.target, translation: word.english },
        })
      );
    }
    return { title, goal, exercises };
  }

  if (focus === 'recall') {
    words.forEach((word, index) => {
      if (index % 2 === 0) {
        exercises.push(
          typeEx('Write it from memory', word.english, [word.target], {
            hint: word.roman ? `Sounds like: ${word.roman}` : 'Type the word you learned.',
            vocab: { target: word.target, translation: word.english },
          })
        );
      } else {
        exercises.push(
          speak(word.target, {
            prompt: 'Say it out loud from memory',
            note: word.roman ? `${word.roman} — ${word.english}` : word.english,
            vocab: { target: word.target, translation: word.english },
          })
        );
      }
    });
    return { title, goal, exercises };
  }

  // mixed: 3 meaning choices, 2 typed, 1 audio, remaining spoken.
  const chooseWords = words.slice(0, Math.min(3, words.length));
  const typeWords = words.slice(3, Math.min(5, words.length));
  const listenWords = words.slice(5, Math.min(6, words.length));
  const speakWords = words.slice(6);

  for (const word of chooseWords) {
    exercises.push(
      choose(word.target, englishOptions(word, allWords, allEnglish), word.english, {
        prompt: 'What does this word mean?',
        note: `“${word.target}” = ${word.english}.`,
        vocab: { target: word.target, translation: word.english },
      })
    );
  }
  for (const word of typeWords) {
    exercises.push(
      typeEx('Write it in the language', word.english, [word.target], {
        hint: word.roman ? `Sounds like: ${word.roman}` : 'Type exactly what you heard in the lesson.',
        vocab: { target: word.target, translation: word.english },
      })
    );
  }
  for (const word of listenWords) {
    exercises.push(
      listen(word.target, targetOptions(word, allWords, allTargets), {
        vocab: { target: word.target, translation: word.english },
      })
    );
  }
  for (const word of speakWords) {
    exercises.push(
      speak(word.target, {
        prompt: 'Say it out loud',
        note: word.roman ? `${word.roman} — ${word.english}` : word.english,
        vocab: { target: word.target, translation: word.english },
      })
    );
  }

  return { title, goal, exercises };
}

/**
 * Four-chapter starter course for a language. Returns [] only when the
 * language has no curated starter list — a test guards every atlas entry.
 */
export function samplerChapters(languageId: string): ChapterSource[] {
  const pack = starterPack(languageId);
  if (!pack) return [];

  const essentials = pack.essentials.slice(0, 12);
  const numbers = pack.numbers.slice(0, 10);
  const all = [...essentials, ...numbers];

  const firstHalf = essentials.slice(0, Math.ceil(essentials.length / 2));
  const secondHalf = essentials.slice(Math.ceil(essentials.length / 2));
  const lowNumbers = numbers.slice(0, Math.ceil(numbers.length / 2));
  const highNumbers = numbers.slice(Math.ceil(numbers.length / 2));

  return [
    {
      cefr: 'A1',
      title: 'First words',
      description:
        'Hello, thank you, please — the twelve words that open every conversation, drilled by meaning and sound.',
      lessons: [
        buildLesson(
          'Hello & goodbye',
          'Greet someone and say goodbye',
          firstHalf,
          all,
          'mixed'
        ),
        buildLesson(
          'Please & thank you',
          'Be polite with the words locals actually use',
          secondHalf,
          all,
          'mixed'
        ),
      ],
    },
    {
      cefr: 'A1',
      title: 'Numbers 1–10',
      description: 'Count, ask prices and understand a phone number.',
      lessons: [
        buildLesson('One to five', 'Recognise and produce 1–5', lowNumbers, all, 'mixed'),
        buildLesson('Six to ten', 'Recognise and produce 6–10', highNumbers, all, 'mixed'),
      ],
    },
    {
      cefr: 'A1',
      title: 'Listening lab',
      description:
        'The same words, audio-only. Trains your ear before you meet them in a real conversation.',
      lessons: [
        buildLesson('Hear the essentials', 'Recognise all twelve essentials by ear', essentials, all, 'listen'),
        buildLesson('Hear the numbers', 'Recognise the numbers without reading them', numbers, all, 'listen'),
      ],
    },
    {
      cefr: 'A2',
      title: 'Recall',
      description:
        'No options, no prompts in the target language: produce the words from memory, then say them.',
      lessons: [
        buildLesson('Say it yourself', 'Produce the essentials from English', essentials, all, 'recall'),
        buildLesson('Numbers from memory', 'Produce the numbers from English', numbers, all, 'recall'),
      ],
    },
  ];
}
