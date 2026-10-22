/**
 * Daily-budget tests.
 *
 * The quota is the one place where a bug is invisible until real learners hit
 * it: a wrong reset time tells people to come back at an hour that has already
 * passed, and a budget checked after the per-learner cap lets one person drain
 * the provider for everyone. Every rule is pinned here with an injected clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_LIMITS,
  dayKey,
  decideQuota,
  formatResetTime,
  isQuotaResponse,
  limitFor,
  limitsFromEnv,
  nextResetAt,
  quotaMessage,
  secondsUntilReset,
} from '../src/lib/quota';

test('defaults are finite and lean enough for a free tier', () => {
  for (const value of Object.values(DEFAULT_LIMITS)) {
    assert.ok(Number.isInteger(value) && value > 0, `bad default ${value}`);
  }
  assert.ok(DEFAULT_LIMITS.dailyBudget >= DEFAULT_LIMITS.learnerChat, 'budget covers one learner');
  assert.ok(DEFAULT_LIMITS.learnerChat > DEFAULT_LIMITS.guestChat, 'signed-in learners get more');
});

test('env overrides are parsed, clamped and never trust junk', () => {
  const limits = limitsFromEnv({
    AI_DAILY_CHAT: '12',
    AI_DAILY_STT: '3',
    AI_DAILY_GUEST_CHAT: '1',
    AI_DAILY_GUEST_STT: '0',
    AI_DAILY_BUDGET: '999999',
  });
  assert.equal(limits.learnerChat, 12);
  assert.equal(limits.learnerStt, 3);
  assert.equal(limits.guestChat, 1);
  assert.equal(limits.guestStt, 0, 'zero explicitly disables a path');
  assert.equal(limits.dailyBudget, 100_000, 'absurd budget is clamped');

  const junk = limitsFromEnv({ AI_DAILY_CHAT: 'lots', AI_DAILY_STT: '-4' });
  assert.equal(junk.learnerChat, DEFAULT_LIMITS.learnerChat);
  assert.equal(junk.learnerStt, DEFAULT_LIMITS.learnerStt);
});

test('limitFor picks the tier and the kind independently', () => {
  const limits = { learnerChat: 10, learnerStt: 4, guestChat: 3, guestStt: 1, dailyBudget: 50 };
  assert.equal(limitFor(limits, 'learner', 'chat'), 10);
  assert.equal(limitFor(limits, 'learner', 'stt'), 4);
  assert.equal(limitFor(limits, 'guest', 'chat'), 3);
  assert.equal(limitFor(limits, 'guest', 'stt'), 1);
});

test('the day is UTC, so every instance resets at the same instant', () => {
  // 23:30 in one timezone is already tomorrow somewhere — the key must not care.
  assert.equal(dayKey(new Date('2026-10-22T23:59:59Z')), '2026-10-22');
  assert.equal(dayKey(new Date('2026-10-23T00:00:01Z')), '2026-10-23');

  const reset = nextResetAt(new Date('2026-10-22T09:46:00Z'));
  assert.equal(reset.toISOString(), '2026-10-23T00:00:00.000Z');
  assert.equal(secondsUntilReset(new Date('2026-10-22T23:59:30Z')), 30);
  assert.equal(secondsUntilReset(new Date('2026-10-22T00:00:00Z')), 86_400);
});

test('reset time is rendered as a time of day, not a raw ISO string', () => {
  const text = formatResetTime(new Date('2026-10-23T00:00:00Z'));
  assert.match(text, /\d{1,2}:\d{2}/, `expected a clock time, got ${text}`);
  assert.doesNotMatch(text, /2026-/);
});

test('decideQuota allows under both caps and refuses at each one', () => {
  const limits = { learnerChat: 3, learnerStt: 3, guestChat: 2, guestStt: 1, dailyBudget: 100 };
  const now = new Date('2026-10-22T10:00:00Z');

  const first = decideQuota({ limits, tier: 'learner', kind: 'chat', used: 0, globalUsed: 0, now });
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 2, 'remaining excludes the slot just spent');
  assert.equal(first.resetsAt, '2026-10-23T00:00:00.000Z');

  const last = decideQuota({ limits, tier: 'learner', kind: 'chat', used: 2, globalUsed: 0, now });
  assert.equal(last.allowed, true);
  assert.equal(last.remaining, 0);

  const over = decideQuota({ limits, tier: 'learner', kind: 'chat', used: 3, globalUsed: 0, now });
  assert.equal(over.allowed, false);
  assert.equal(over.reason, 'learner');
  assert.equal(over.remaining, 0);
});

test('the server-wide budget is checked before the per-learner cap', () => {
  const limits = { learnerChat: 30, learnerStt: 12, guestChat: 6, guestStt: 2, dailyBudget: 45 };
  const verdict = decideQuota({
    limits,
    tier: 'learner',
    kind: 'chat',
    used: 0, // this learner has spent nothing…
    globalUsed: 45, // …but the day for everyone is gone
  });
  assert.equal(verdict.allowed, false);
  assert.equal(verdict.reason, 'budget', 'the reason must name the real limit');
});

test('chats and voice have separate allowances', () => {
  const limits = { learnerChat: 2, learnerStt: 2, guestChat: 1, guestStt: 1, dailyBudget: 10 };
  const chatSpent = decideQuota({ limits, tier: 'learner', kind: 'chat', used: 2, globalUsed: 2 });
  assert.equal(chatSpent.allowed, false);
  const voice = decideQuota({ limits, tier: 'learner', kind: 'stt', used: 2, globalUsed: 2 });
  assert.equal(voice.allowed, false);
  const stillTyping = decideQuota({ limits, tier: 'learner', kind: 'stt', used: 0, globalUsed: 2 });
  assert.equal(stillTyping.allowed, true);
});

test('the refusal message names a time and never mentions a provider', () => {
  const resetsAt = new Date('2026-10-23T00:00:00Z');
  const learner = quotaMessage({ reason: 'learner', kind: 'chat', tier: 'learner', resetsAt });
  assert.match(learner, /reset/i);
  assert.match(learner, /\d{1,2}:\d{2}/);
  assert.doesNotMatch(learner, /openrouter|openai|api key|quota/i);

  const budget = quotaMessage({ reason: 'budget', kind: 'chat', tier: 'learner', resetsAt });
  assert.match(budget, /everyone/i);

  const guestVoice = quotaMessage({ reason: 'learner', kind: 'stt', tier: 'guest', resetsAt });
  assert.match(guestVoice, /voice/i);
  assert.match(guestVoice, /guests/i);
});

test('isQuotaResponse accepts only the documented 429 body', () => {
  assert.equal(
    isQuotaResponse({ error: 'daily-limit', message: 'Resets at 02:00.', resetsAt: 'x' }),
    true
  );
  assert.equal(isQuotaResponse({ error: 'daily-budget', message: 'Back at 02:00.' }), true);
  assert.equal(isQuotaResponse({ error: 'daily-limit' }), false, 'message is required');
  assert.equal(isQuotaResponse({ error: 'rate-limited', message: '…' }), false, 'per-minute ≠ daily');
  assert.equal(isQuotaResponse(null), false);
  assert.equal(isQuotaResponse('daily-limit'), false);
});
