/**
 * Catalogue math — how big a language pack is and how far the learner has
 * come. Pure (bundled curriculum only) so the home rail, Learn cards and the
 * language page can all show identical numbers without network access.
 */
import { bundledCurriculum } from '../data/curriculum';
import { LANGUAGES } from '../data/languages';
import { STARTERS } from '../data/starters';
import type { Chapter } from './curriculum/types';

export type CourseStats = {
  chapters: number;
  lessons: number;
  exercises: number;
  minutes: number;
};

export type CourseProgress = CourseStats & {
  completedLessons: number;
  pct: number;
  started: boolean;
};

type ProgressMap = Record<string, { score: number }>;

const chaptersCache = new Map<string, Chapter[]>();

function chaptersOf(languageId: string): Chapter[] {
  const cached = chaptersCache.get(languageId);
  if (cached) return cached;
  const chapters = bundledCurriculum(languageId);
  chaptersCache.set(languageId, chapters);
  return chapters;
}

/** ~1.2 minutes per exercise; rounded to the nearest 5 for honest copy. */
export function courseStats(languageId: string): CourseStats {
  const chapters = chaptersOf(languageId);
  let lessons = 0;
  let exercises = 0;
  for (const chapter of chapters) {
    lessons += chapter.lessons.length;
    for (const lesson of chapter.lessons) exercises += lesson.exercises.length;
  }
  const minutes = Math.max(5, Math.round((exercises * 1.2) / 5) * 5);
  return { chapters: chapters.length, lessons, exercises, minutes };
}

export function progressForLanguage(
  languageId: string,
  progress: ProgressMap
): CourseProgress {
  const stats = courseStats(languageId);
  let completedLessons = 0;
  for (const chapter of chaptersOf(languageId)) {
    for (const lesson of chapter.lessons) {
      if ((progress[lesson.id]?.score ?? 0) >= 70) completedLessons += 1;
    }
  }
  return {
    ...stats,
    completedLessons,
    pct: stats.lessons > 0 ? completedLessons / stats.lessons : 0,
    started: completedLessons > 0,
  };
}

/** Aggregate over the whole atlas — "24 languages · 66 lessons · free". */
export function catalogueStats(): CourseStats & { languages: number } {
  return LANGUAGES.reduce(
    (total, language) => {
      const stats = courseStats(language.id);
      return {
        languages: total.languages + 1,
        chapters: total.chapters + stats.chapters,
        lessons: total.lessons + stats.lessons,
        exercises: total.exercises + stats.exercises,
        minutes: total.minutes + stats.minutes,
      };
    },
    { languages: 0, chapters: 0, lessons: 0, exercises: 0, minutes: 0 }
  );
}

/** Total words shipped inside the bundled starter packs. */
export function starterWordCount(): number {
  return Object.values(STARTERS).reduce(
    (total, pack) => total + pack.essentials.length + pack.numbers.length,
    0
  );
}
