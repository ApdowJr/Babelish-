/**
 * Adaptive difficulty — maps how much the learner has completed to the
 * CEFR band the tutor should speak at, so conversations stretch as they grow.
 */

export type Level = 'A1' | 'A2' | 'B1' | 'B2';

/** Lessons completed at 70%+ (any language) → suggested tutor level. */
export function suggestLevel(lessonsCompleted: number): Level {
  if (lessonsCompleted < 6) return 'A1';
  if (lessonsCompleted < 16) return 'A2';
  if (lessonsCompleted < 32) return 'B1';
  return 'B2';
}

/** Human label for the level chip ("A2 · 7 lessons to B1"-style copy). */
export function levelLabel(level: Level): string {
  return level;
}
