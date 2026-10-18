import type { Chapter, ChapterSource, Exercise, Lesson } from '@/lib/curriculum/types';
import { ch1 as esCh1 } from './es/ch1';
import { ch2 as esCh2 } from './es/ch2';
import { ch3 as esCh3 } from './es/ch3';
import { ch4 as esCh4 } from './es/ch4';
import { ch5 as esCh5 } from './es/ch5';
import {
  AR_SAMPLER,
  DE_SAMPLER,
  FR_SAMPLER,
  HI_SAMPLER,
  JA_SAMPLER,
  PT_SAMPLER,
  RU_SAMPLER,
  SW_SAMPLER,
  ZH_SAMPLER,
} from './samplers';

/**
 * Bundled curriculum — the offline/demo source of truth. Supabase-approved
 * content overrides this at runtime when configured (see curriculum/store).
 */
const REGISTRY: Record<string, ChapterSource[]> = {
  es: [esCh1, esCh2, esCh3, esCh4, esCh5],
  ar: [AR_SAMPLER],
  zh: [ZH_SAMPLER],
  fr: [FR_SAMPLER],
  hi: [HI_SAMPLER],
  ja: [JA_SAMPLER],
  de: [DE_SAMPLER],
  pt: [PT_SAMPLER],
  ru: [RU_SAMPLER],
  sw: [SW_SAMPLER],
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
