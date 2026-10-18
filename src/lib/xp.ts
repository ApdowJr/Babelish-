/**
 * XP — ethical gamification: transparent rules, no loss mechanics, no
 * pay-to-win. Pure and dependency-free so every rule is unit-testable;
 * state storage lives in `@/state/analytics`.
 */

export type XpState = { lifetime: number; week: string; weekly: number };

export const EMPTY_XP: XpState = { lifetime: 0, week: '', weekly: 0 };

/** Published rules — the learner can always see why they earned XP. */
export const XP_RULES = {
  /** Finishing a lesson (scenario). */
  lesson: 20,
  /** Extra when every answer was right first try. */
  lessonPerfect: 15,
  /** One scored pronunciation attempt. */
  pronunciation: 3,
  /** One practice-phrase card attempt. */
  phrase: 2,
  /** First activity of a calendar day. */
  dailyBonus: 10,
  /** One spaced-repetition review session. */
  review: 4,
} as const;

export type XpReason = keyof typeof XP_RULES;

export function xpFor(reason: XpReason): number {
  return XP_RULES[reason];
}

/**
 * Lesson XP: full reward for a new scenario or a fresh-day replay, but
 * replaying the SAME lesson again later today earns nothing (anti-farm —
 * replays stay allowed, they just don't mint XP on demand).
 */
export function lessonXp(input: {
  firstCompletion: boolean;
  completedToday: boolean;
  perfect: boolean;
}): number {
  if (!input.firstCompletion && input.completedToday) return 0;
  return XP_RULES.lesson + (input.perfect ? XP_RULES.lessonPerfect : 0);
}

/**
 * Week key in local time, Monday-based (YYYY-Www). Two awards in the same
 * calendar week share a bucket; crossing into a new week starts fresh.
 */
export function weekKey(now = new Date()): string {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekday = (day.getDay() + 6) % 7; // Mon=0 … Sun=6
  day.setDate(day.getDate() - weekday + 3); // Thursday of this ISO week
  const isoYear = day.getFullYear();
  const jan1 = new Date(isoYear, 0, 1);
  const jan1Weekday = (jan1.getDay() + 6) % 7;
  const week = 1 + Math.round(((day.getTime() - jan1.getTime()) / 86400000 - 3 + jan1Weekday) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

/** XP earned in the CURRENT week — 0 after a rollover until new awards land. */
export function weeklyXp(state: XpState, now = new Date()): number {
  return state.week === weekKey(now) ? state.weekly : 0;
}

/** Adds XP, rolling the weekly counter over when the week changes. */
export function addXp(state: XpState, amount: number, now = new Date()): XpState {
  if (amount <= 0) return state;
  const key = weekKey(now);
  const sameWeek = state.week === key;
  return {
    lifetime: state.lifetime + amount,
    week: key,
    weekly: (sameWeek ? state.weekly : 0) + amount,
  };
}

/**
 * Gentle lifetime curve: level 1 at 0 XP, level L at 100·(L−1)² XP.
 * Levels never regress — progress is only ever additive (no loss aversion).
 */
export function levelForXp(xp: number): { level: number; floor: number; target: number; pct: number } {
  const safe = Math.max(0, xp);
  let level = 1;
  while (safe >= 100 * level * level) level += 1;
  const floor = level === 1 ? 0 : 100 * (level - 1) * (level - 1);
  const target = 100 * level * level;
  const pct = target === floor ? 0 : (safe - floor) / (target - floor);
  return { level, floor, target, pct: Math.min(1, Math.max(0, pct)) };
}
