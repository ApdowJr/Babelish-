/**
 * Plans — free tier = 1 NEW scenario (lesson) per calendar day, premium =
 * unlimited. Replays of scenarios already used today are always free:
 * re-practice is never punished. Pure and dependency-free for node tests.
 */
import { dayKey } from '@/lib/analytics';

export type Plan = 'free' | 'premium';

export const FREE_DAILY_SCENARIOS = 1;

/** Codes accepted by the beta stand-in for real billing (documented in PHASE5). */
export const PREMIUM_CODES: Record<string, string> = {
  'ZELVOCA-BETA': 'Zelvoca beta programme',
  'ZELVOCA-PREMIUM': 'Zelvoca premium',
};

/** On-device plan usage; day-rolls lazily so midnight needs no timer. */
export type ScenarioState = {
  plan: Plan;
  day: string;
  /** Distinct lesson ids completed on `day`. */
  used: string[];
};

export function emptyScenarioState(now = new Date()): ScenarioState {
  return { plan: 'free', day: dayKey(now), used: [] };
}

export function scenarioAllowance(plan: Plan): number | null {
  return plan === 'premium' ? null : FREE_DAILY_SCENARIOS;
}

function rolled(state: ScenarioState, now: Date): ScenarioState {
  const today = dayKey(now);
  return state.day === today ? state : { ...state, day: today, used: [] };
}

export type ScenarioDecision = {
  allowed: boolean;
  reason: 'ok' | 'replay' | 'limit';
  used: number;
  limit: number | null;
  /** Local midnight after `now` — when the free allowance resets. */
  resetsAt: Date;
  remaining: number;
};

/** Local midnight after `now`. */
export function nextResetAt(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
}

/**
 * The gate: premium always starts; free users start their FIRST new scenario
 * of the day and any replay. Otherwise `reason: 'limit'`.
 */
export function canStartScenario(
  state: ScenarioState,
  lessonId: string,
  now = new Date()
): ScenarioDecision {
  const current = rolled(state, now);
  const limit = scenarioAllowance(current.plan);
  const isReplay = current.used.includes(lessonId);
  const used = current.used.length;

  if (current.plan === 'premium' || isReplay) {
    return {
      allowed: true,
      reason: isReplay && current.plan === 'free' ? 'replay' : 'ok',
      used,
      limit,
      resetsAt: nextResetAt(now),
      remaining: limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    };
  }
  const allowed = used < limit!; // free: limit is a number
  return {
    allowed,
    reason: allowed ? 'ok' : 'limit',
    used,
    limit,
    resetsAt: nextResetAt(now),
    remaining: Math.max(0, (limit ?? 0) - used),
  };
}

/** Marks a scenario as used (day-rolls and dedupes). Fire-and-forget. */
export function consumeScenario(
  state: ScenarioState,
  lessonId: string,
  now = new Date()
): ScenarioState {
  const current = rolled(state, now);
  if (current.used.includes(lessonId)) return current;
  return { ...current, used: [...current.used, lessonId] };
}

/** Beta stand-in for the App Store / Play billing flow. */
export function redeemCode(state: ScenarioState, raw: string): { state: ScenarioState; label: string } | null {
  const label = PREMIUM_CODES[String(raw ?? '').trim().toUpperCase()];
  if (!label) return null;
  return { state: { ...state, plan: 'premium' }, label };
}

/** Stable, privacy-safe referral code derived from the user id (no PII in it). */
export function referralCode(userId: string): string {
  let hash = 0x811c9dc5; // FNV-1a
  for (let i = 0; i < userId.length; i++) {
    hash ^= userId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `NV${hash.toString(36).toUpperCase().padStart(6, '0').slice(-6)}`;
}

/** Seats included with a family plan. */
export const FAMILY_SEATS = 6;
