/**
 * Adaptive tutor difficulty.
 *
 * Completion count sets a conservative CEFR baseline; the learner's last few
 * completed lessons can move it by at most one band. Scores are best recorded
 * lesson scores, so this is a gentle signal rather than a claim of proficiency.
 */

export type Level = 'A1' | 'A2' | 'B1' | 'B2';

const LEVELS: readonly Level[] = ['A1', 'A2', 'B1', 'B2'];

/**
 * Suggest a tutor level from lessons completed in the target language and
 * optional recent lesson scores (0–100). Three scores are required before
 * accuracy changes the baseline, which prevents one difficult lesson from
 * swinging the conversation level.
 */
export function suggestLevel(lessonsCompleted: number, recentScores: readonly number[] = []): Level {
  const completed = Number.isFinite(lessonsCompleted) ? Math.max(0, Math.floor(lessonsCompleted)) : 0;
  const baselineIndex = completed < 6 ? 0 : completed < 16 ? 1 : completed < 32 ? 2 : 3;
  const scores = recentScores
    .filter((score) => Number.isFinite(score) && score >= 0 && score <= 100)
    .slice(-5);

  if (scores.length < 3) return LEVELS[baselineIndex];
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const adjustedIndex = average < 55
    ? Math.max(0, baselineIndex - 1)
    : average >= 90
      ? Math.min(LEVELS.length - 1, baselineIndex + 1)
      : baselineIndex;
  return LEVELS[adjustedIndex];
}

/** Human label for the level chip. */
export function levelLabel(level: Level): string {
  return level;
}
