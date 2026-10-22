/**
 * Phrasebook — every phrase the app already ships for a language, in one
 * searchable place. Sources are merged and de-duplicated:
 *
 *   1. bundled starter words (essentials + numbers) — always offline
 *   2. vocabulary taught inside the curriculum (lesson `vocab` fields)
 *
 * Pure, so the screen can filter instantly and tests can assert coverage.
 */
import { getLanguage } from '../data/languages';
import { starterWords } from '../data/starters';
import type { Chapter } from './curriculum/types';

export type PhraseCategory = 'essentials' | 'numbers' | 'curriculum';

export type Phrase = {
  id: string;
  languageId: string;
  target: string;
  english: string;
  /** Latin transliteration, when the script needs one. */
  roman?: string;
  category: PhraseCategory;
  /** Chapter/lesson context for curriculum phrases. */
  source?: string;
};

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** 22 vetted words per language (12 essentials + numbers 1–10). */
export function starterPhrasebook(languageId: string): Phrase[] {
  return starterWords(languageId).map(({ word, category }, index) => ({
    id: `starter:${languageId}:${category}:${index}`,
    languageId,
    target: word.target,
    english: word.english,
    roman: word.roman,
    category,
  }));
}

/** Words explicitly taught by a language's chapters (deduped). */
export function curriculumPhrasebook(languageId: string, chapters: Chapter[]): Phrase[] {
  const seen = new Set<string>();
  const phrases: Phrase[] = [];
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      for (const exercise of lesson.exercises) {
        if (!exercise.vocab) continue;
        const key = normalize(exercise.vocab.target);
        if (seen.has(key)) continue;
        seen.add(key);
        phrases.push({
          id: `lesson:${languageId}:${exercise.id}`,
          languageId,
          target: exercise.vocab.target,
          english: exercise.vocab.translation,
          category: 'curriculum',
          source: lesson.title,
        });
      }
    }
  }
  return phrases;
}

/** Merged phrasebook: starters first (they are the curated minimum), then lessons. */
export function buildPhrasebook(languageId: string, chapters: Chapter[] = []): Phrase[] {
  const starters = starterPhrasebook(languageId);
  const seen = new Set(starters.map((phrase) => normalize(phrase.target)));
  const extra = curriculumPhrasebook(languageId, chapters).filter(
    (phrase) => !seen.has(normalize(phrase.target))
  );
  return [...starters, ...extra];
}

export const PHRASE_CATEGORY_LABEL: Record<PhraseCategory, string> = {
  essentials: 'Essentials',
  numbers: 'Numbers',
  curriculum: 'From your lessons',
};

/** Accent/case-insensitive search over both sides + transliteration. */
export function searchPhrases(phrases: Phrase[], query: string): Phrase[] {
  const q = normalize(query);
  if (!q) return phrases;
  return phrases.filter(
    (phrase) =>
      normalize(phrase.target).includes(q) ||
      normalize(phrase.english).includes(q) ||
      normalize(phrase.roman ?? '').includes(q)
  );
}

/** The home screen's "word of the day": deterministic per language + day. */
export function wordOfTheDay(languageId: string, chapters: Chapter[], now = new Date()): Phrase | null {
  const phrases = buildPhrasebook(languageId, chapters);
  if (phrases.length === 0) return null;
  const seed =
    now.getFullYear() * 372 + (now.getMonth() + 1) * 31 + now.getDate() + languageId.length;
  return phrases[seed % phrases.length] ?? phrases[0];
}

/** A human line for a phrase's language ("Spanish · Español"). */
export function phraseLanguageLabel(languageId: string): string {
  const language = getLanguage(languageId);
  return `${language.name} · ${language.nativeName}`;
}
