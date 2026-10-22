/**
 * Plans — Babelish 2.0 makes learning free: every language, every bundled
 * lesson, every review, every phrase is unlimited on the free tier. "Premium"
 * now means *supporter* (early access badges and family seats at launch), not
 * access to education. Pure and dependency-free for node tests.
 */
import { dayKey } from './analytics';

export type Plan = 'free' | 'premium';

/** Core learning is unlimited and free — kept as `null` (no limit). */
export const FREE_DAILY_SCENARIOS: number | null = null;

/** Codes accepted by the beta stand-in for real billing (documented in PHASE5). */
export const PREMIUM_CODES: Record<string, string> = {
  'BABELISH-FREE': 'Babelish free-forever programme',
  'BABELISH-BETA': 'Babelish beta supporter',
  'BABELISH-PREMIUM': 'Babelish supporter',
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

export function scenarioAllowance(_plan: Plan): number | null {
  return null; // every lesson is free for everyone
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
 * 2.0: every plan can start every lesson. The shape stays so the UI and the
 * stored `used` list keep working, but `allowed` is always true and `limit`
 * is null (unlimited).
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

  // Unlimited: nothing to gate, so every lesson starts (and replays stay free).
  return {
    allowed: true,
    reason: isReplay ? 'replay' : 'ok',
    used,
    limit,
    resetsAt: nextResetAt(now),
    remaining: limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
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

/** Supporter codes — beta stand-in for the App Store / Play billing flow. */
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
