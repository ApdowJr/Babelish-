import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEGACY_OWNER_KEY,
  canClaimLegacyData,
  deletionKeysForUser,
  progressKeysForUser,
  scopedStorageKey,
} from '../src/lib/accountScope';

test('scopedStorageKey namespaces user keys and keeps guest keys unchanged', () => {
  assert.equal(scopedStorageKey('zelvoca:progress:v1', null), 'zelvoca:progress:v1');
  assert.equal(scopedStorageKey('zelvoca:progress:v1', '  '), 'zelvoca:progress:v1');
  assert.equal(
    scopedStorageKey('zelvoca:progress:v1', 'user-123'),
    'zelvoca:progress:v1:u:user-123'
  );
});

test('canClaimLegacyData allows only the first signed-in owner and blocks subsequent accounts', () => {
  assert.equal(canClaimLegacyData('user-a', null), true);
  assert.equal(canClaimLegacyData('user-a', 'user-a'), true);
  assert.equal(canClaimLegacyData('user-b', 'user-a'), false);
  assert.equal(canClaimLegacyData(null, null), false);
});

test('progressKeysForUser and deletionKeysForUser isolate second accounts from first-account legacy keys', () => {
  const aKeys = progressKeysForUser('user-a');
  const bKeys = progressKeysForUser('user-b');
  assert.ok(aKeys.every((k) => k.endsWith(':u:user-a')));
  assert.ok(bKeys.every((k) => k.endsWith(':u:user-b')));

  const deleteOwner = deletionKeysForUser('user-a', 'user-a');
  const deleteSecond = deletionKeysForUser('user-b', 'user-a');
  assert.ok(deleteOwner.includes(LEGACY_OWNER_KEY));
  assert.ok(deleteOwner.includes('zelvoca:subscription:u:user-a'));
  assert.ok(deleteOwner.includes('zelvoca:subscription'));
  assert.ok(!deleteSecond.includes(LEGACY_OWNER_KEY));
  assert.ok(deleteSecond.includes('zelvoca:subscription:u:user-b'));
  assert.ok(!deleteSecond.includes('zelvoca:subscription'));
});
