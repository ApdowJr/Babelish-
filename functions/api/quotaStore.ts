/**
 * Daily usage storage for the tutor budget.
 *
 * Two layers, on purpose:
 *   1. Postgres (`public.ai_usage`) — authoritative across Function instances,
 *      so a learner cannot reset their day by hitting a different instance.
 *   2. In-memory — a crash-safe fallback. If the table is missing or the DB
 *      hiccups, the Function still enforces *something* per instance instead
 *      of either failing every request or letting usage run unbounded. The
 *      response marks which layer answered (`source`), and the app never
 *      claims more than that.
 *
 * Counting is deliberately not transactional across the read and the write:
 * two simultaneous requests may both pass and both increment. That is a soft
 * cost guard (a few requests either way), not a billing ledger — the provider
 * still enforces its own quota.
 */
import type { QueryFn } from './admin';
import {
  dayKey,
  decideQuota,
  limitFor,
  nextResetAt,
  secondsUntilReset,
  quotaMessage,
  type QuotaKind,
  type QuotaLimits,
  type QuotaTier,
} from '../../src/lib/quota';

export const USAGE_SQL = `
create table if not exists public.ai_usage (
  user_id text not null,
  day     date not null,
  chats   integer not null default 0,
  stt     integer not null default 0,
  primary key (user_id, day)
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
  /** Which layer made the decision — surfaced for honest status reporting. */
  source: 'database' | 'memory';
  /** Ready-to-show sentence when `allowed` is false. */
  message?: string;
  retryAfterSeconds?: number;
};

let schemaReady: Promise<void> | null = null;

/** Creates the usage table once per instance; a failure is not fatal. */
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

type UsageRow = { mine?: number | string; total?: number | string };

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
  const column = input.kind === 'chat' ? 'chats' : 'stt';

  const finish = (decision: ReturnType<typeof decideQuota>, source: 'database' | 'memory'): QuotaOutcome => ({
    allowed: decision.allowed,
    reason: decision.reason,
    used: decision.used,
    limit: decision.limit,
    remaining: decision.remaining,
    resetsAt: decision.resetsAt,
    source,
    ...(decision.allowed
      ? {}
      : {
          message: quotaMessage({
            reason: decision.reason ?? 'learner',
            kind: input.kind,
            tier: input.tier,
            resetsAt,
          }),
          retryAfterSeconds: secondsUntilReset(now),
        }),
  });

  try {
    await ensureUsageSchema(q);
    const read = await q(
      `select
         coalesce((select ${column} from public.ai_usage where user_id = $1 and day = $2::date), 0) as mine,
         coalesce((select sum(chats) from public.ai_usage where day = $2::date), 0) as total`,
      [input.userId, day]
    );
    const row = (read.rows[0] ?? {}) as UsageRow;
    const used = Number(row.mine ?? 0);
    const globalUsed = Number(row.total ?? 0);

    const decision = decideQuota({
      limits: input.limits,
      tier: input.tier,
      kind: input.kind,
      used,
      globalUsed,
      now,
    });
    if (!decision.allowed) return finish(decision, 'database');

    await q(
      `insert into public.ai_usage (user_id, day, ${column}) values ($1, $2::date, 1)
       on conflict (user_id, day) do update set ${column} = public.ai_usage.${column} + 1`,
      [input.userId, day]
    );
    return finish(decision, 'database');
  } catch {
    // Fallback: per-instance counters. Still bounded, still dated.
    const used = memoryUsed(day, input.userId, input.kind);
    const globalUsed = memoryChatTotal.get(day) ?? 0;
    const decision = decideQuota({
      limits: input.limits,
      tier: input.tier,
      kind: input.kind,
      used,
      globalUsed,
      now,
    });
    if (!decision.allowed) return finish(decision, 'memory');

    pruneMemory(day);
    memory.set(memoryKey(day, input.userId, input.kind), used + 1);
    if (input.kind === 'chat') memoryChatTotal.set(day, globalUsed + 1);
    return finish(decision, 'memory');
  }
}

/**
 * Gives a request back when the fault was ours (provider down, timeout, bad
 * reply). A learner should not lose a message because the model misbehaved.
 */
export async function refundQuota(
  q: QueryFn,
  input: { userId: string; kind: QuotaKind; now?: Date }
): Promise<void> {
  const now = input.now ?? new Date();
  const day = dayKey(now);
  const column = input.kind === 'chat' ? 'chats' : 'stt';
  try {
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

/** Re-exported so the Function can report the per-caller cap in headers. */
export { limitFor };
