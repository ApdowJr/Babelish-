/**
 * Rate-limiter tests: the AI proxy is the one path a provider bills, and the
 * admin gate is the one path worth guessing — both must hold their budgets
 * exactly, per key, with clock-injected fixed windows.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFailureLimiter, createLimiter } from '../functions/api/rateLimit';

test('admission limiter: allows exactly `max` calls per window, per key', () => {
  let now = 0;
  const limiter = createLimiter(3, 60_000, () => now);

  assert.deepEqual(
    [limiter.take('u1'), limiter.take('u1'), limiter.take('u1')],
    [true, true, true]
  );
  assert.equal(limiter.take('u1'), false, '4th call inside the window is refused');
  assert.equal(limiter.take('u2'), true, 'other keys keep their own budget');
  assert.equal(limiter.take('u2'), true);

  now += 60_000;
  assert.equal(limiter.take('u1'), true, 'window elapsed → budget restored');
});

test('admission limiter: windows are fixed from the first hit', () => {
  let now = 0;
  const limiter = createLimiter(1, 1_000, () => now);

  assert.equal(limiter.take('k'), true);
  now += 500;
  assert.equal(limiter.take('k'), false, 'mid-window: still spent');
  now += 500;
  assert.equal(limiter.take('k'), true, 'boundary: new window');
});

test('failure limiter: blocks after max failures, recovers after the window', () => {
  let now = 10_000;
  const failures = createFailureLimiter(2, 30_000, () => now);

  assert.equal(failures.blocked('ip'), false, 'fresh key is never blocked');
  failures.hit('ip');
  assert.equal(failures.blocked('ip'), false, '1 of 2 failures spent');
  failures.hit('ip');
  assert.equal(failures.blocked('ip'), true, '2nd failure exhausts the budget');

  assert.equal(failures.blocked('other-ip'), false, 'keys are independent');

  now += 30_000;
  assert.equal(failures.blocked('ip'), false, 'window elapsed → unblocked');
  failures.hit('ip');
  assert.equal(failures.blocked('ip'), false, 'budget counts within the new window only');
  failures.hit('ip');
  assert.equal(failures.blocked('ip'), true, 'new window exhausts again at max');
});
