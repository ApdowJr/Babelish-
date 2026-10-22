/**
 * The 2.0 promise is "every language, every lesson, free". These tests pin the
 * plan layer to that promise so a future paywall cannot be reintroduced by
 * accident without a failing test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PREMIUM_CODES,
  canStartScenario,
  consumeScenario,
  emptyScenarioState,
  redeemCode,
  referralCode,
  scenarioAllowance,
} from '../src/lib/plans';


test('the free plan has no lesson allowance', () => {
  assert.equal(scenarioAllowance('free'), null);
  assert.equal(scenarioAllowance('premium'), null);
});

test('free learners can start more lessons than a day has hours', () => {
  let state = emptyScenarioState();
  for (let i = 0; i < 50; i += 1) {
    const decision = canStartScenario(state, `lesson-${i}`);
    assert.equal(decision.allowed, true, `lesson ${i} should start`);
    assert.equal(decision.limit, null);
    state = consumeScenario(state, `lesson-${i}`);
  }
  assert.equal(state.used.length, 50);
});

test('replays still report as replays but never block', () => {
  const state = consumeScenario(emptyScenarioState(), 'es-ch1-l1');
  const replay = canStartScenario(state, 'es-ch1-l1');
  assert.equal(replay.allowed, true);
  assert.equal(replay.reason, 'replay');
  assert.equal(replay.remaining, Number.POSITIVE_INFINITY);
});

test('supporter codes (including BABELISH-BETA) unlock the badge tier', () => {
  assert.ok(PREMIUM_CODES['BABELISH-BETA']);
  const redeemed = redeemCode(emptyScenarioState(), ' babelish-beta ');
  assert.ok(redeemed);
  assert.equal(redeemed.state.plan, 'premium');
  assert.equal(redeemCode(emptyScenarioState(), 'NOT-A-CODE'), null);
});

test('referral codes are stable and contain no PII', () => {
  assert.equal(referralCode('user-123'), referralCode('user-123'));
  assert.notEqual(referralCode('user-123'), referralCode('user-124'));
  assert.match(referralCode('user-123'), /^NV[0-9A-Z]{6}$/);
  assert.ok(!referralCode('user-123').includes('user'));
});
