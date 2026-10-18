/**
 * Curriculum content model — units → lessons → exercises.
 *
 * Source types are what authors (human or AI-draft script) write; the loader
 * hydrates them with stable ids for the player and the database.
 */

export type ExerciseType = 'choose' | 'type' | 'listen' | 'speak';

/** What a content author writes. */
export type ExerciseSource = {
  type: ExerciseType;
  /** Instruction shown above the exercise (defaults come from helpers). */
  prompt: string;
  /** The content: word/sentence to translate, or the line to hear. */
  question: string;
  /** Options for choose/listen exercises (must include the answer). */
  options?: string[];
  /** Accepted answers; answer[0] is the canonical one. */
  answer: string[];
  hint?: string;
  /** Shown after answering — grammar/culture note. */
  note?: string;
  /** Vocabulary this exercise teaches — missed → Leitner review queue. */
  vocab?: { target: string; translation: string };
};

export type LessonSource = {
  title: string;
  goal: string;
  exercises: ExerciseSource[];
};

export type ChapterSource = {
  cefr: string;
  title: string;
  description: string;
  lessons: LessonSource[];
};

/** Hydrated for the player / API. */
export type Exercise = ExerciseSource & { id: string; lessonId: string; orderIndex: number };

export type Lesson = {
  id: string;
  chapterId: string;
  languageId: string;
  orderIndex: number;
  title: string;
  goal: string;
  exercises: Exercise[];
};

export type Chapter = {
  id: string;
  languageId: string;
  cefr: string;
  orderIndex: number;
  title: string;
  description: string;
  lessons: Lesson[];
};

/** Best completion per lesson (percent of playable exercises correct). */
export type LessonProgress = {
  lessonId: string;
  score: number;
  completedAt: string;
};

/** A word in the spaced-repetition system (Leitner boxes 1–5). */
export type VocabItem = {
  itemKey: string;
  languageId: string;
  target: string;
  translation: string;
  box: number;
  dueAt: string;
  lastReviewedAt?: string;
};

/** Missed vocabulary captured at lesson completion. */
export type VocabSeed = { target: string; translation: string };

/** Leitner review intervals in days, per box. */
export const LEITNER_DAYS = [1, 2, 4, 8, 15] as const;
