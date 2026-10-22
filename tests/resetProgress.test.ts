/**
 * "Reset progress" boundaries.
 *
 * A reset that also wiped the account or the profile would be a data-loss bug
 * dressed as a convenience, and one that missed a learning store would leave
 * the learner staring at their old XP. These tests pin both directions.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { KEPT_ON_RESET, PROGRESS_KEYS, overlapsKeptKeys } from '../src/lib/resetProgress';
import { LOCAL_DATA_KEYS } from '../src/lib/privacy';

test('nothing that must survive a reset is in the reset list', () => {
  assert.deepEqual(overlapsKeptKeys(PROGRESS_KEYS), []);
});

test('the learning stores a reset must clear are all listed', () => {
  for (const key of [
    'zelvoca:progress:v1',
    'zelvoca:vocab:v1',
    'zelvoca:analytics',
    'zelvoca:speaking-stats',
  ]) {
    assert.ok((PROGRESS_KEYS as readonly string[]).includes(key), `${key} would survive a reset`);
  }
});

test('a reset is a strict subset of account deletion', () => {
  // Deleting the account removes everything a reset removes, plus the
  // account itself and the preferences/profile. If this fails, one list grew
  // without the other and the two actions have drifted apart.
  for (const key of PROGRESS_KEYS) {
    assert.ok((LOCAL_DATA_KEYS as readonly string[]).includes(key), `${key} is not in LOCAL_DATA_KEYS`);
  }
  assert.ok(LOCAL_DATA_KEYS.length > PROGRESS_KEYS.length);
  assert.ok(!(PROGRESS_KEYS as readonly string[]).includes('zelvoca:preferences'));
  assert.ok(!(PROGRESS_KEYS as readonly string[]).includes('zelvoca:profile'));
});

test('kept keys are the ones a learner would be furious to lose', () => {
  for (const key of ['zelvoca:preferences', 'zelvoca:profile']) {
    assert.ok((KEPT_ON_RESET as readonly string[]).includes(key));
  }
});

test('the keys are unique — a duplicate would hide a missed store', () => {
  assert.equal(new Set(PROGRESS_KEYS).size, PROGRESS_KEYS.length);
});
