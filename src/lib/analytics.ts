/**
 * Skill analytics — pure aggregators over the learner's practice history.
 * State storage lives in `@/state/analytics`; everything here is
 * dependency-free so it can be tested directly under node.
 */
import { EMPTY_XP, type XpState } from './xp';

export type Skill = 'read' | 'listen' | 'write' | 'speak';

export type SkillTally = { correct: number; total: number };
export type SpeakTally = { scoreSum: number; count: number };

export type AnalyticsEvent = { name: string; at: string };

export type AnalyticsState = {
  read: SkillTally;
  listen: SkillTally;
  write: SkillTally;
  /** Pronunciation practice: scores are 0–100 per attempt, not right/wrong. */
  speak: SpeakTally;
  /** Ring buffer of coarse activity events (newest last) — streaks, insights. */
  events: AnalyticsEvent[];
  /** Lifetime + current-week XP (rules live in `@/lib/xp`). */
  xp: XpState;
};

export const EMPTY_ANALYTICS: AnalyticsState = {
  read: { correct: 0, total: 0 },
  listen: { correct: 0, total: 0 },
  write: { correct: 0, total: 0 },
  speak: { scoreSum: 0, count: 0 },
  events: [],
  xp: { ...EMPTY_XP },
};

/** Quiz skills need a few answers before we call anything "weak". */
export const MIN_SKILL_SAMPLES = 4;
export const MAX_EVENTS = 300;
/**
 * Speaking is scored on a fuzzy rubric, so "perfect" isn't 100 — an average
 * of 85%+ reads as solid and shouldn't keep generating practice cards.
 */
export const SPEAK_GOOD_ENOUGH = 0.85;

/** Lesson exercise types → the skill they actually train. */
export function skillForExerciseType(type: string): Skill | null {
  if (type === 'choose') return 'read';
  if (type === 'listen') return 'listen';
  if (type === 'type') return 'write';
  if (type === 'speak') return 'speak';
  return null;
}

/** Accuracy 0..1, or null when there isn't enough data yet. */
export function skillAccuracy(state: AnalyticsState, skill: Skill): number | null {
  if (skill === 'speak') {
    return state.speak.count > 0 ? state.speak.scoreSum / state.speak.count / 100 : null;
  }
  const tally = state[skill];
  if (tally.total < MIN_SKILL_SAMPLES) return null;
  return tally.correct / tally.total;
}

/**
 * The skill performing worst right now — drives the daily plan and the
 * tutor's difficulty. `exclude` lets callers skip skills they just practiced.
 * Ties break in a fixed order so plans stay deterministic.
 */
export function weakestSkill(
  state: AnalyticsState,
  opts: { exclude?: Skill[] } = {}
): Skill | null {
  const order: Skill[] = ['listen', 'write', 'read', 'speak'];
  let worst: Skill | null = null;
  let worstAccuracy = Number.POSITIVE_INFINITY;
  for (const skill of order) {
    if (opts.exclude?.includes(skill)) continue;
    const accuracy = skillAccuracy(state, skill);
    if (accuracy === null || accuracy >= 1) continue; // no data, or perfect
    if (skill === 'speak' && accuracy >= SPEAK_GOOD_ENOUGH) continue; // solid enough
    if (accuracy < worstAccuracy) {
      worst = skill;
      worstAccuracy = accuracy;
    }
  }
  return worst;
}

/** Appends an event, trimming the oldest overflow (newest last). */
export function pushEvent(
  events: AnalyticsEvent[],
  event: AnalyticsEvent,
  max = MAX_EVENTS
): AnalyticsEvent[] {
  const next = [...events, event];
  return next.length > max ? next.slice(next.length - max) : next;
}

/** Local calendar day key (YYYY-MM-DD) — streaks are per device day. */
export function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Consecutive days with activity, counting back from today. If today is
 * still quiet, yesterday still keeps the streak alive (it ends at midnight).
 */
export function computeStreak(events: AnalyticsEvent[], now = new Date()): number {
  const days = new Set(events.map((e) => new Date(e.at)).map(dayKey));
  if (days.size === 0) return 0;

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  if (!days.has(dayKey(cursor))) return 0;

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Whether the learner has done anything yet today. */
export function activeToday(events: AnalyticsEvent[], now = new Date()): boolean {
  const key = dayKey(now);
  return events.some((e) => dayKey(new Date(e.at)) === key);
}


/**
 * Activity counts for the last `days` local days, oldest → newest.
 * Used by the home weekly chart — real data only, zero bars when quiet.
 */
export function activityByDay(
  events: AnalyticsEvent[],
  days = 7,
  now = new Date()
): number[] {
  const buckets = new Map<string, number>();
  for (const event of events) {
    const key = dayKey(new Date(event.at));
    buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }
  const out: number[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    out.push(buckets.get(dayKey(date)) ?? 0);
  }
  return out;
}

/** Day-of-week initials for the chart labels, Monday-first optional. */
export function weekdayLabels(now = new Date(), days = 7): string[] {
  const names = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const out: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    out.push(names[date.getDay()]);
  }
  return out;
}

/** How many times a named event occurred in the whole ring buffer. */
export function countEvents(events: AnalyticsEvent[], name: string): number {
  return events.filter((event) => event.name === name).length;
}
