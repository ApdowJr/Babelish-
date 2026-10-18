/**
 * Leagues — ethical design: tiers are earned from LIFETIME XP and never
 * demoted (no weekly loss aversion, no "you fell out of Gold" shame loops).
 * The weekly target is an information bar, not a threat. Live rank among
 * other learners comes from the backend leaderboard when available.
 */

export type Tier = {
  id: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  name: string;
  emoji: string;
  /** Lifetime XP required to hold this tier. */
  min: number;
  /** Suggested weekly XP for this tier — a goal, never a penalty. */
  weeklyGoal: number;
};

export const TIERS: Tier[] = [
  { id: 'bronze', name: 'Bronze', emoji: '🥉', min: 0, weeklyGoal: 150 },
  { id: 'silver', name: 'Silver', emoji: '🥈', min: 300, weeklyGoal: 250 },
  { id: 'gold', name: 'Gold', emoji: '🥇', min: 800, weeklyGoal: 400 },
  { id: 'platinum', name: 'Platinum', emoji: '💠', min: 1600, weeklyGoal: 600 },
  { id: 'diamond', name: 'Diamond', emoji: '💎', min: 3000, weeklyGoal: 900 },
];

export function tierForXp(lifetimeXp: number): Tier {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (lifetimeXp >= tier.min) current = tier;
  }
  return current;
}

export function nextTier(lifetimeXp: number): Tier | null {
  for (const tier of TIERS) {
    if (tier.min > lifetimeXp) return tier;
  }
  return null;
}

/** Weekly progress bar for the learner's current tier (never blocks anything). */
export function weeklyProgress(
  weeklyXp: number,
  tier: Tier
): { goal: number; pct: number; met: boolean; remaining: number } {
  const goal = tier.weeklyGoal;
  const pct = Math.min(1, Math.max(0, weeklyXp / goal));
  return { goal, pct, met: weeklyXp >= goal, remaining: Math.max(0, goal - weeklyXp) };
}

/** Human rank line — privacy-first (count only, never other learners' ids). */
export function rankLabel(rank: number | null, total: number | null): string | null {
  if (!rank || !total || total < 2) return null;
  return `#${rank} of ${total} learners this week`;
}
