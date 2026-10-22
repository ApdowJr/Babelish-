import type { Chapter, ChapterSource, Exercise, Lesson } from '../../lib/curriculum/types';
import { LANGUAGES } from '../languages';
import { ch1 as esCh1 } from './es/ch1';
import { ch2 as esCh2 } from './es/ch2';
import { ch3 as esCh3 } from './es/ch3';
import { ch4 as esCh4 } from './es/ch4';
import { ch5 as esCh5 } from './es/ch5';
import { samplerChapters } from './samplers';

/**
 * Bundled curriculum — the offline/demo source of truth. Supabase-approved
 * content overrides this at runtime when configured (see curriculum/store).
 *
 * Spanish carries the hand-authored CEFR course. Every other language ships
 * the generated starter pack (First words + Numbers), so the catalogue has no
 * dead ends: every flag on the Learn screen opens real, playable lessons.
 */
const REGISTRY: Record<string, ChapterSource[]> = {
  es: [esCh1, esCh2, esCh3, esCh4, esCh5],
  ...Object.fromEntries(
    LANGUAGES.filter((language) => language.id !== 'es').map((language) => [
      language.id,
      samplerChapters(language.id),
    ])
  ),
};

/** Hydrates authoring sources with stable, deterministic ids. */
export function bundledCurriculum(languageId: string): Chapter[] {
  const sources = REGISTRY[languageId];
  if (!sources) return [];

  return sources.map((source, chapterIndex) => {
    const chapterId = `${languageId}-ch${chapterIndex + 1}`;
    const lessons: Lesson[] = source.lessons.map((lessonSource, lessonIndex) => {
      const lessonId = `${chapterId}-l${lessonIndex + 1}`;
      const exercises: Exercise[] = lessonSource.exercises.map((exercise, exerciseIndex) => ({
        ...exercise,
        id: `${lessonId}-e${exerciseIndex + 1}`,
        lessonId,
        orderIndex: exerciseIndex,
      }));
      return {
        id: lessonId,
        chapterId,
        languageId,
        orderIndex: lessonIndex,
        title: lessonSource.title,
        goal: lessonSource.goal,
        exercises,
      };
    });
    return {
      id: chapterId,
      languageId,
      cefr: source.cefr,
      orderIndex: chapterIndex,
      title: source.title,
      description: source.description,
      lessons,
    };
  });
}

/** True when a language ships at least one chapter in the bundle. */
export function hasBundledCurriculum(languageId: string): boolean {
  return Boolean(REGISTRY[languageId]?.length);
}
