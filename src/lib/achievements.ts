/**
 * Achievements — transparent, purely positive milestones computed from state
 * that already lives on the device. No dark patterns: nothing is lost, nothing
 * expires, and every badge shows exactly how far along the learner is.
 *
 * Pure and dependency-free so it can be unit-tested under node.
 */

export type AchievementTier = 'bronze' | 'silver' | 'gold';

export type AchievementInput = {
  lifetimeXp: number;
  streak: number;
  /** Lessons scoring 70%+. */
  lessonsCompleted: number;
  /** Distinct languages with at least one lesson completed. */
  languagesStarted: number;
  /** Words currently in the review queue. */
  wordsSaved: number;
  /** Words in Leitner box 4 or 5. */
  wordsMastered: number;
  perfectLessons: number;
  reviewSessions: number;
  speakingAttempts: number;
};

export type Achievement = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  tier: AchievementTier;
  target: number;
  progress: number;
  unlocked: boolean;
  /** 0–1 toward the badge. */
  pct: number;
};

type Definition = {
  id: string;
  title: string;
  description: string;
  emoji: string;
  tier: AchievementTier;
  target: number;
  value: (input: AchievementInput) => number;
};

const DEFINITIONS: Definition[] = [
  {
    id: 'first-lesson',
    title: 'First steps',
    description: 'Finish your first lesson.',
    emoji: '🌱',
    tier: 'bronze',
    target: 1,
    value: (i) => i.lessonsCompleted,
  },
  {
    id: 'first-word',
    title: 'Word collector',
    description: 'Save 10 words to your review queue.',
    emoji: '📚',
    tier: 'bronze',
    target: 10,
    value: (i) => i.wordsSaved,
  },
  {
    id: 'streak-3',
    title: 'Three in a row',
    description: 'Practice three days in a row.',
    emoji: '🔥',
    tier: 'bronze',
    target: 3,
    value: (i) => i.streak,
  },
  {
    id: 'speaker',
    title: 'Say it out loud',
    description: 'Score 10 pronunciation attempts.',
    emoji: '🎙️',
    tier: 'bronze',
    target: 10,
    value: (i) => i.speakingAttempts,
  },
  {
    id: 'review-10',
    title: 'Memory builder',
    description: 'Complete 10 review sessions.',
    emoji: '🔁',
    tier: 'silver',
    target: 10,
    value: (i) => i.reviewSessions,
  },
  {
    id: 'lesson-10',
    title: 'Getting fluent',
    description: 'Finish 10 lessons.',
    emoji: '🚀',
    tier: 'silver',
    target: 10,
    value: (i) => i.lessonsCompleted,
  },
  {
    id: 'polyglot',
    title: 'Polyglot',
    description: 'Complete a lesson in 3 different languages.',
    emoji: '🌍',
    tier: 'silver',
    target: 3,
    value: (i) => i.languagesStarted,
  },
  {
    id: 'mastery-10',
    title: 'Deep roots',
    description: 'Master 10 words (Leitner box 4+).',
    emoji: '🌳',
    tier: 'silver',
    target: 10,
    value: (i) => i.wordsMastered,
  },
  {
    id: 'perfect-5',
    title: 'Flawless five',
    description: 'Finish 5 lessons with every answer right.',
    emoji: '💎',
    tier: 'gold',
    target: 5,
    value: (i) => i.perfectLessons,
  },
  {
    id: 'streak-7',
    title: 'Week of words',
    description: 'Keep a 7-day streak.',
    emoji: '🏆',
    tier: 'gold',
    target: 7,
    value: (i) => i.streak,
  },
  {
    id: 'xp-1000',
    title: 'Thousand club',
    description: 'Earn 1,000 lifetime XP.',
    emoji: '✨',
    tier: 'gold',
    target: 1000,
    value: (i) => i.lifetimeXp,
  },
  {
    id: 'explorer',
    title: 'World explorer',
    description: 'Complete lessons in 5 different languages.',
    emoji: '🧭',
    tier: 'gold',
    target: 5,
    value: (i) => i.languagesStarted,
  },
];

export function evaluateAchievements(input: AchievementInput): Achievement[] {
  return DEFINITIONS.map((definition) => {
    const raw = Math.max(0, definition.value(input));
    const progress = Math.min(definition.target, raw);
    return {
      id: definition.id,
      title: definition.title,
      description: definition.description,
      emoji: definition.emoji,
      tier: definition.tier,
      target: definition.target,
      progress,
      unlocked: raw >= definition.target,
      pct: definition.target === 0 ? 1 : Math.min(1, raw / definition.target),
    };
  });
}

/** Counts distinct languages touched from a lesson-progress map. */
export function languagesStartedFromProgress(
  progress: Record<string, { score: number; completedAt: string }>
): number {
  const ids = new Set<string>();
  for (const [lessonId, entry] of Object.entries(progress)) {
    if (entry.score < 70) continue;
    const languageId = lessonId.split('-ch')[0];
    if (languageId) ids.add(languageId);
  }
  return ids.size;
}

export function unlockedCount(achievements: Achievement[]): number {
  return achievements.filter((achievement) => achievement.unlocked).length;
}
