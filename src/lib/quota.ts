/**
 * Daily tutor budget — pure, shared by the Function and the app.
 *
 * Why this exists: free model endpoints are not infinite. An unfunded
 * OpenRouter account allows roughly 50 requests per day; after a one-time $10
 * credit it is 1,000/day. Without a budget the first busy day silently drains
 * the quota and every learner drops to Coach mode with a generic error.
 *
 * So the server keeps two limits:
 *   - a per-learner daily cap (fairness — one person cannot eat the day), and
 *   - a server-wide daily budget (cost guard — the provider's real ceiling).
 *
 * When either is reached the answer is a *dated* message ("resumes at 00:00
 * UTC"), not a shrug. UTC is used on purpose: it is the same instant for every
 * server instance, which a local midnight is not.
 */

export type QuotaKind = 'chat' | 'stt';
export type QuotaTier = 'learner' | 'guest';

export type QuotaLimits = {
  /** Messages per signed-in learner per UTC day. */
  learnerChat: number;
  /** Transcriptions per signed-in learner per UTC day. */
  learnerStt: number;
  /** Messages per anonymous IP per UTC day. */
  guestChat: number;
  /** Transcriptions per anonymous IP per UTC day. */
  guestStt: number;
  /** All chat requests across all users per UTC day (the provider ceiling). */
  dailyBudget: number;
};

/**
 * Defaults assume the free tier (~50/day). Raise `AI_DAILY_BUDGET` after a
 * credit purchase (1,000/day) — the code never assumes it.
 */
export const DEFAULT_LIMITS: QuotaLimits = {
  learnerChat: 30,
  learnerStt: 12,
  guestChat: 6,
  guestStt: 2,
  dailyBudget: 45,
};

const MAX_LIMIT = 100_000;

function asLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(Math.floor(parsed), MAX_LIMIT);
}

/** Reads the owner's overrides from the environment (names documented in .env.example). */
export function limitsFromEnv(env: Record<string, string | undefined> = {}): QuotaLimits {
  return {
    learnerChat: asLimit(env.AI_DAILY_CHAT, DEFAULT_LIMITS.learnerChat),
    learnerStt: asLimit(env.AI_DAILY_STT, DEFAULT_LIMITS.learnerStt),
    guestChat: asLimit(env.AI_DAILY_GUEST_CHAT, DEFAULT_LIMITS.guestChat),
    guestStt: asLimit(env.AI_DAILY_GUEST_STT, DEFAULT_LIMITS.guestStt),
    dailyBudget: asLimit(env.AI_DAILY_BUDGET, DEFAULT_LIMITS.dailyBudget),
  };
}

/** The cap that applies to one caller. `0` means "disabled", not "unlimited". */
export function limitFor(limits: QuotaLimits, tier: QuotaTier, kind: QuotaKind): number {
  if (kind === 'chat') return tier === 'learner' ? limits.learnerChat : limits.guestChat;
  return tier === 'learner' ? limits.learnerStt : limits.guestStt;
}

/** UTC calendar day, `YYYY-MM-DD` — the partition key for usage rows. */
export function dayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** The instant the current UTC day ends — what "resumes at" refers to. */
export function nextResetAt(now: Date = new Date()): Date {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next;
}

/** `13:00 UTC` — short, unambiguous, timezone-free. */
export function formatResetTime(date: Date): string {
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} UTC`;
}

/** How long until the reset, for `Retry-After` and the client's countdown. */
export function secondsUntilReset(now: Date = new Date()): number {
  return Math.max(1, Math.ceil((nextResetAt(now).getTime() - now.getTime()) / 1000));
}

export type QuotaDecision = {
  allowed: boolean;
  /** Which cap stopped the request, when one did. */
  reason: 'learner' | 'budget' | null;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
};

/**
 * Decides one request.
 *
 * `globalUsed` is the whole-server count for today; it is checked against
 * `dailyBudget` so a handful of heavy learners cannot exhaust the provider
 * quota for everyone else.
 */
export function decideQuota(input: {
  limits: QuotaLimits;
  tier: QuotaTier;
  kind: QuotaKind;
  used: number;
  globalUsed: number;
  now?: Date;
}): QuotaDecision {
  const now = input.now ?? new Date();
  const limit = limitFor(input.limits, input.tier, input.kind);
  const resetsAt = nextResetAt(now).toISOString();
  const used = Math.max(0, input.used);

  if (input.globalUsed >= input.limits.dailyBudget) {
    return { allowed: false, reason: 'budget', used, limit, remaining: 0, resetsAt };
  }
  if (used >= limit) {
    return { allowed: false, reason: 'learner', used, limit, remaining: 0, resetsAt };
  }
  return {
    allowed: true,
    reason: null,
    used,
    limit,
    remaining: Math.max(0, limit - used - 1),
    resetsAt,
  };
}

/**
 * The sentence a learner sees when the day's budget is gone. Named times beat
 * "try again later", and neither mentions a provider or a bill.
 */
export function quotaMessage(input: {
  reason: 'learner' | 'budget';
  kind: QuotaKind;
  tier: QuotaTier;
  resetsAt: Date;
}): string {
  const when = formatResetTime(input.resetsAt);
  const thing =
    input.kind === 'chat'
      ? 'tutor messages'
      : input.tier === 'guest'
        ? 'voice notes'
        : 'voice messages';
  if (input.reason === 'budget') {
    return `The tutor has used today's free capacity for everyone. It comes back at ${when} — lessons, review and the phrasebook keep working in the meantime.`;
  }
  const who = input.tier === 'guest' ? 'guests' : 'learners';
  return `You've used today's ${thing} for ${who}. It resets at ${when} — lessons, review and the phrasebook keep working.`;
}

/** Client-side shape check for a quota response (never throws on junk). */
export function isQuotaResponse(body: unknown): body is {
  error: 'daily-limit' | 'daily-budget';
  message: string;
  resetsAt?: string;
} {
  if (!body || typeof body !== 'object') return false;
  const record = body as Record<string, unknown>;
  return (
    (record.error === 'daily-limit' || record.error === 'daily-budget') &&
    typeof record.message === 'string'
  );
}
