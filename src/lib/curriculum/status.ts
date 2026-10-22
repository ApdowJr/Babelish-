/**
 * Course completeness — the honest label behind every language.
 *
 * Babelish ships three kinds of content and never blurs them:
 *   - a hand-authored course (Spanish): grammar/culture notes, marked
 *     `in-progress` because A1 is finished but B1–B2 are not;
 *   - a generated starter course (every other language): real, validated
 *     vocabulary drills at A1–A2, explicitly *not* a complete CEFR path;
 *   - nothing: never shipped as a "course".
 */
import { bundledCurriculum } from '../../data/curriculum';
import { LANGUAGES } from '../../data/languages';
import { starterWords } from '../../data/starters';

export type CourseTier = 'authored' | 'starter';

export type CourseStatus = {
  languageId: string;
  level: string;
  tier: CourseTier;
  status: 'in-progress' | 'starter';
  chapters: number;
  lessons: number;
  exercises: number;
  words: number;
  /** Whether grammar explanations have been human-reviewed for this course. */
  grammarNotes: boolean;
  label: string;
  note: string;
};

export function courseStatus(languageId: string): CourseStatus {
  const chapters = bundledCurriculum(languageId);
  const lessons = chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  const exercises = chapters.reduce(
    (sum, chapter) => sum + chapter.lessons.reduce((n, lesson) => n + lesson.exercises.length, 0),
    0
  );
  const words = starterWords(languageId).length;
  const authored = languageId === 'es';
  const level = authored ? 'A1' : 'A1–A2';

  return {
    languageId,
    level,
    tier: authored ? 'authored' : 'starter',
    status: authored ? 'in-progress' : 'starter',
    chapters: chapters.length,
    lessons,
    exercises,
    words,
    grammarNotes: authored,
    label: authored ? `Authored course · ${level}` : `Verified starter course · ${level}`,
    note: authored
      ? 'Five hand-authored chapters with grammar and culture notes. A2–B2 are still in progress — this course is not advertised as complete.'
      : `${chapters.length} chapters · ${lessons} lessons built from ${words} verified starter words. Grammar explanations have not been native-reviewed for this language yet, so it is a starter course — not a full CEFR path.`,
  };
}

export type CatalogueCompleteness = {
  languages: number;
  authored: number;
  starter: number;
  chapters: number;
  lessons: number;
  exercises: number;
  /** Share of the atlas that is still starter-level only. */
  starterShare: number;
};

export function catalogueCompleteness(): CatalogueCompleteness {
  const statuses = LANGUAGES.map((language) => courseStatus(language.id));
  const chapters = statuses.reduce((sum, status) => sum + status.chapters, 0);
  const lessons = statuses.reduce((sum, status) => sum + status.lessons, 0);
  const exercises = statuses.reduce((sum, status) => sum + status.exercises, 0);
  const authored = statuses.filter((status) => status.tier === 'authored').length;
  return {
    languages: statuses.length,
    authored,
    starter: statuses.length - authored,
    chapters,
    lessons,
    exercises,
    starterShare: statuses.length === 0 ? 0 : (statuses.length - authored) / statuses.length,
  };
}
