/**
 * Budget storage tests.
 *
 * The database path needs Postgres, so these exercise the fallback contract
 * that has to hold when it is *not* there: the counters are still bounded,
 * still atomic across concurrent callers, and refunds never go below zero.
 *
 * (The SQL path is a single `insert … on conflict do update … where <cap>`
 * per claim, which is what makes the database case safe under concurrency;
 * that statement cannot be exercised without a live branch.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { QueryFn } from '../functions/api/admin';
import { consumeQuota, refundQuota } from '../functions/api/quotaStore';
import { DEFAULT_LIMITS, type QuotaLimits } from '../src/lib/quota';

/** A database that is always down — forces the in-memory layer. */
const down: QueryFn = async () => {
  throw new Error('database unavailable');
};

const limits = (over: Partial<QuotaLimits> = {}): QuotaLimits => ({
  ...DEFAULT_LIMITS,
  ...over,
});

const at = new Date('2026-10-22T12:00:00Z');
// Each test that touches the shared budget gets its own UTC day: the fallback
// counters are module-level (one process), exactly like a warm instance.
const budgetDay = new Date('2026-10-24T12:00:00Z');

test('concurrent requests cannot exceed the per-learner cap', async () => {
  const caps = limits({ guestChat: 5, dailyBudget: 10_000 });
  const results = await Promise.all(
    Array.from({ length: 40 }, () =>
      consumeQuota(down, { userId: 'burst-guest', tier: 'guest', kind: 'chat', limits: caps, now: at })
    )
  );
  const allowed = results.filter((r) => r.allowed);
  assert.equal(allowed.length, 5, 'exactly the cap passed, no more');
  assert.ok(
    results.filter((r) => !r.allowed).every((r) => r.reason === 'learner'),
    'refusals name the per-learner cap'
  );
  assert.ok(results.every((r) => r.source === 'memory'));
});

test('concurrent requests cannot exceed the server-wide budget', async () => {
  const caps = limits({ learnerChat: 1_000, dailyBudget: 3 });
  const results = await Promise.all(
    Array.from({ length: 25 }, (_, i) =>
      consumeQuota(down, {
        userId: `budget-user-${i}`,
        tier: 'learner',
        kind: 'chat',
        limits: caps,
        now: budgetDay,
      })
    )
  );
  assert.equal(results.filter((r) => r.allowed).length, 3);
  assert.ok(
    results.filter((r) => !r.allowed).every((r) => r.reason === 'budget'),
    'refusals name the shared budget'
  );
});

test('chat and voice counters are independent', async () => {
  const caps = limits({ learnerChat: 2, learnerStt: 1, dailyBudget: 100 });
  const user = 'two-kinds';
  const first = await consumeQuota(down, { userId: user, tier: 'learner', kind: 'stt', limits: caps, now: at });
  const second = await consumeQuota(down, { userId: user, tier: 'learner', kind: 'stt', limits: caps, now: at });
  const chat = await consumeQuota(down, { userId: user, tier: 'learner', kind: 'chat', limits: caps, now: at });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, false, 'voice cap holds');
  assert.equal(chat.allowed, true, 'a spent voice allowance does not block typing');
});

test('a refund returns the slot and never goes negative', async () => {
  const caps = limits({ learnerChat: 2, dailyBudget: 100 });
  const user = 'refund-user';
  assert.equal(
    (await consumeQuota(down, { userId: user, tier: 'learner', kind: 'chat', limits: caps, now: at })).allowed,
    true
  );
  await refundQuota(down, { userId: user, kind: 'chat', now: at });
  // Two refunds for one spend must not print a negative day or a free extra
  // slot: the counter floors at zero.
  await refundQuota(down, { userId: user, kind: 'chat', now: at });
  const again = await consumeQuota(down, { userId: user, tier: 'learner', kind: 'chat', limits: caps, now: at });
  assert.equal(again.allowed, true);
  assert.equal(again.used, 1, 'refund landed back at zero before this claim');
});

test('a zero limit is a switch-off, not unlimited access', async () => {
  const caps = limits({ learnerStt: 0 });
  const result = await consumeQuota(down, {
    userId: 'disabled-voice',
    tier: 'learner',
    kind: 'stt',
    limits: caps,
    now: at,
  });
  assert.equal(result.allowed, false);
  assert.equal(result.source, 'config');
  assert.match(result.message ?? '', /voice/i);
});

test('refusals carry a reset time and a positive Retry-After', async () => {
  const caps = limits({ guestChat: 1, dailyBudget: 100 });
  await consumeQuota(down, { userId: 'retry-guest', tier: 'guest', kind: 'chat', limits: caps, now: at });
  const refused = await consumeQuota(down, {
    userId: 'retry-guest',
    tier: 'guest',
    kind: 'chat',
    limits: caps,
    now: at,
  });
  assert.equal(refused.allowed, false);
  assert.equal(refused.resetsAt, '2026-10-23T00:00:00.000Z');
  assert.equal(refused.retryAfterSeconds, 12 * 60 * 60, 'noon to midnight UTC');
  assert.match(refused.message ?? '', /guests/);
});
