/**
 * Daily usage storage for the tutor budget.
 *
 * Two layers, on purpose:
 *   1. Postgres (`public.ai_usage` + `public.ai_usage_daily`) — authoritative
 *      across Function instances, so a learner cannot reset their day by
 *      hitting a different instance.
 *   2. In-memory — a crash-safe fallback. If the table is missing or the DB
 *      hiccups, the Function still enforces *something* per instance instead
 *      of either failing every request or letting usage run unbounded. The
 *      response marks which layer answered (`source`), and the app never
 *      claims more than that.
 *
 * Counting is atomic, not read-then-write. Each claim is a single statement
 * (`insert … on conflict do update … where <cap> returning …`): Postgres takes
 * the row lock for the conflicting row and re-evaluates the guard against the
 * committed value, so two simultaneous requests cannot both take the last slot.
 * The server-wide budget lives in one row per day for the same reason — without
 * that row, N learners could each pass a read-based check and collectively
 * overshoot the provider's ceiling.
 *
 * The in-memory path is atomic for a different reason: it never awaits between
 * reading a counter and writing it, and Node runs one callback at a time.
 */
import type { QueryFn } from './admin';
import {
  dayKey,
  decideQuota,
  limitFor,
  nextResetAt,
  quotaMessage,
  secondsUntilReset,
  type QuotaKind,
  type QuotaLimits,
  type QuotaTier,
} from '../../src/lib/quota';

/**
 * Two tables:
 *   - one row per (user, day): that learner's chats and transcriptions;
 *   - one row per day: every chat request made on the server.
 * Both statements are idempotent, so this can run on first use per instance.
 */
export const USAGE_SQL = `
create table if not exists public.ai_usage (
  user_id text not null,
  day     date not null,
  chats   integer not null default 0,
  stt     integer not null default 0,
  primary key (user_id, day)
);
create table if not exists public.ai_usage_daily (
  day   date primary key,
  chats integer not null default 0
);
`;

/** Best-effort per-instance counters, keyed `day:user:kind`. */
const memory = new Map<string, number>();
const memoryChatTotal = new Map<string, number>();

function memoryKey(day: string, userId: string, kind: QuotaKind): string {
  return `${day}:${userId}:${kind}`;
}

function memoryUsed(day: string, userId: string, kind: QuotaKind): number {
  return memory.get(memoryKey(day, userId, kind)) ?? 0;
}

function pruneMemory(day: string): void {
  if (memory.size < 5_000) return;
  for (const key of memory.keys()) {
    if (!key.startsWith(`${day}:`)) memory.delete(key);
  }
  for (const key of memoryChatTotal.keys()) {
    if (key !== day) memoryChatTotal.delete(key);
  }
}

export type QuotaOutcome = {
  allowed: boolean;
  reason: 'learner' | 'budget' | null;
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  /**
   * Which layer made the decision — surfaced for honest status reporting.
   * `config` means the owner disabled the path outright (limit 0), so no
   * storage was consulted.
   */
  source: 'database' | 'memory' | 'config';
  /** Ready-to-show sentence when `allowed` is false. */
  message?: string;
  retryAfterSeconds?: number;
};

let schemaReady: Promise<void> | null = null;

/** Creates the usage tables once per instance; a failure is not fatal. */
export function ensureUsageSchema(q: QueryFn): Promise<void> {
  if (!schemaReady) {
    schemaReady = q(USAGE_SQL)
      .then(() => undefined)
      .catch((err) => {
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

const columnOf = (kind: QuotaKind) => (kind === 'chat' ? 'chats' : 'stt');

/**
 * Claims one server-wide chat slot. Returns the day's new total, or `null`
 * when the budget is already spent. Single statement → the check and the
 * increment cannot interleave with another request.
 */
async function claimGlobalSlot(
  q: QueryFn,
  day: string,
  budget: number
): Promise<number | null> {
  const { rows } = await q(
    `insert into public.ai_usage_daily (day, chats) values ($1::date, 1)
     on conflict (day) do update set chats = public.ai_usage_daily.chats + 1
       where public.ai_usage_daily.chats < $2
     returning chats`,
    [day, budget]
  );
  const row = rows[0] as { chats?: number | string } | undefined;
  return row ? Number(row.chats ?? 0) : null;
}

/** Gives a server-wide slot back (learner cap hit, or our failure). */
async function releaseGlobalSlot(q: QueryFn, day: string): Promise<void> {
  await q(
    `update public.ai_usage_daily
        set chats = greatest(chats - 1, 0)
      where day = $1::date`,
    [day]
  );
}

/**
 * Claims one per-user slot for `kind`. Returns the learner's new count, or
 * `null` when the cap is already reached.
 */
async function claimUserSlot(
  q: QueryFn,
  input: { userId: string; day: string; kind: QuotaKind; limit: number }
): Promise<number | null> {
  const column = columnOf(input.kind);
  const { rows } = await q(
    `insert into public.ai_usage (user_id, day, ${column}) values ($1, $2::date, 1)
     on conflict (user_id, day) do update set ${column} = public.ai_usage.${column} + 1
       where public.ai_usage.${column} < $3
     returning ${column} as used`,
    [input.userId, input.day, input.limit]
  );
  const row = rows[0] as { used?: number | string } | undefined;
  return row ? Number(row.used ?? 0) : null;
}

/** Current count, used only to describe a refusal precisely. */
async function readUsage(
  q: QueryFn,
  input: { userId: string; day: string; kind: QuotaKind }
): Promise<number> {
  const column = columnOf(input.kind);
  const { rows } = await q(
    `select ${column} as used from public.ai_usage where user_id = $1 and day = $2::date`,
    [input.userId, input.day]
  );
  return Number((rows[0] as { used?: number | string } | undefined)?.used ?? 0);
}

/**
 * Counts one request against the caller's day and the server's day.
 * Returns the decision; callers turn `allowed === false` into a 429.
 */
export async function consumeQuota(
  q: QueryFn,
  input: {
    userId: string;
    tier: QuotaTier;
    kind: QuotaKind;
    limits: QuotaLimits;
    now?: Date;
  }
): Promise<QuotaOutcome> {
  const now = input.now ?? new Date();
  const day = dayKey(now);
  const resetsAt = nextResetAt(now);
  const limit = limitFor(input.limits, input.tier, input.kind);

  const deny = (
    reason: 'learner' | 'budget',
    used: number,
    source: 'database' | 'memory' | 'config'
  ): QuotaOutcome => ({
    allowed: false,
    reason,
    used,
    limit,
    remaining: 0,
    resetsAt: resetsAt.toISOString(),
    source,
    message: quotaMessage({ reason, kind: input.kind, tier: input.tier, resetsAt }),
    retryAfterSeconds: secondsUntilReset(now),
  });

  // A zero limit is a deliberate switch-off, not "unlimited".
  if (limit <= 0) return deny('learner', 0, 'config');

  try {
    await ensureUsageSchema(q);

    let globalUsed = 0;
    if (input.kind === 'chat') {
      const claimed = await claimGlobalSlot(q, day, input.limits.dailyBudget);
      if (claimed === null) {
        // Report the real total if it is readable; the cap itself is exact.
        const read = await q(
          `select chats from public.ai_usage_daily where day = $1::date`,
          [day]
        ).catch(() => null);
        globalUsed = Number(
          (read?.rows[0] as { chats?: number | string } | undefined)?.chats ?? input.limits.dailyBudget
        );
        return deny('budget', globalUsed, 'database');
      }
      globalUsed = claimed;
    }

    let used: number | null;
    try {
      used = await claimUserSlot(q, {
        userId: input.userId,
        day,
        kind: input.kind,
        limit,
      });
    } catch (err) {
      // The global slot was taken but the learner's row failed: give it back
      // before surfacing the error, or the day drifts downward for everyone.
      if (input.kind === 'chat') await releaseGlobalSlot(q, day).catch(() => undefined);
      throw err;
    }

    if (used === null) {
      if (input.kind === 'chat') await releaseGlobalSlot(q, day).catch(() => undefined);
      const current = await readUsage(q, {
        userId: input.userId,
        day,
        kind: input.kind,
      }).catch(() => limit);
      return deny('learner', current, 'database');
    }

    return {
      allowed: true,
      reason: null,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetsAt: resetsAt.toISOString(),
      source: 'database',
    };
  } catch {
    // Fallback: per-instance counters. Still bounded, still dated, still
    // atomic — there is no await between the read and the write below.
    const used = memoryUsed(day, input.userId, input.kind);
    // The shared budget covers chat spend only; voice has its own per-tier cap
    // and must not be blocked by a busy day of typing. The database path makes
    // the same distinction by only claiming a global slot for chats.
    const globalUsed = input.kind === 'chat' ? (memoryChatTotal.get(day) ?? 0) : 0;
    const decision = decideQuota({
      limits: input.limits,
      tier: input.tier,
      kind: input.kind,
      used,
      globalUsed,
      now,
    });
    if (!decision.allowed) return deny(decision.reason ?? 'learner', used, 'memory');

    pruneMemory(day);
    memory.set(memoryKey(day, input.userId, input.kind), used + 1);
    if (input.kind === 'chat') memoryChatTotal.set(day, globalUsed + 1);
    // Same meaning as the database path: `used` counts the request just
    // allowed, and `remaining` is what is left afterwards.
    return {
      allowed: true,
      reason: null,
      used: used + 1,
      limit,
      remaining: Math.max(0, limit - used - 1),
      resetsAt: decision.resetsAt,
      source: 'memory',
    };
  }
}

/**
 * Gives a request back when the fault was ours (provider down, timeout, bad
 * network). A learner should not lose a message because the model misbehaved.
 *
 * Deliberately *not* called when the provider answered — even badly, even with
 * silence. The call was billed upstream; refunding it would let a caller spend
 * the server's provider quota without ever increasing a counter.
 */
export async function refundQuota(
  q: QueryFn,
  input: { userId: string; kind: QuotaKind; now?: Date }
): Promise<void> {
  const now = input.now ?? new Date();
  const day = dayKey(now);
  const column = columnOf(input.kind);
  try {
    // Same lock order as consumeQuota (day row first, then the learner row) so
    // a refund and a new turn can never deadlock each other.
    if (input.kind === 'chat') await releaseGlobalSlot(q, day);
    await q(
      `update public.ai_usage set ${column} = greatest(${column} - 1, 0)
       where user_id = $1 and day = $2::date`,
      [input.userId, day]
    );
  } catch {
    const key = memoryKey(day, input.userId, input.kind);
    const used = memory.get(key);
    if (used) memory.set(key, Math.max(0, used - 1));
    // The server-wide counter must give the slot back too, otherwise our own
    // failures slowly shrink everyone else's day.
    if (input.kind === 'chat') {
      const total = memoryChatTotal.get(day) ?? 0;
      if (total) memoryChatTotal.set(day, total - 1);
    }
  }
}

/** What the status endpoint reports: limits and the next reset, never usage of others. */
export function quotaStatus(limits: QuotaLimits, now: Date = new Date()) {
  return {
    learnerChat: limits.learnerChat,
    learnerStt: limits.learnerStt,
    guestChat: limits.guestChat,
    guestStt: limits.guestStt,
    dailyBudget: limits.dailyBudget,
    resetsAt: nextResetAt(now).toISOString(),
  };
}
