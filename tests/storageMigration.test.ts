/**
 * Storage-migration tests for the Nativa → Babelish rename.
 *
 * Root cause these guard: renaming the `nativa:*` AsyncStorage keys without
 * carrying the values over would have looked like a clean rebrand and silently
 * wiped every existing install — progress back to zero, streaks gone, session
 * lost, everyone signed out by an update that was supposed to change only a
 * name. The mapping rules are pure (src/lib/storageKeys.ts) precisely so they
 * can be proven here under plain `node --test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PREFIX,
  LEGACY_PREFIX,
  MIGRATION_FLAG,
  SESSION_KEYS,
  migratedKey,
  planKeyMigration,
} from '../src/lib/storageKeys';
import {
  ALL_LOCAL_DATA_KEYS,
  LEGACY_LOCAL_DATA_KEYS,
  LOCAL_DATA_KEYS,
} from '../src/lib/privacy';

test('prefixes are the two sides of the rename', () => {
  assert.equal(LEGACY_PREFIX, 'nativa:');
  assert.equal(CURRENT_PREFIX, 'babelish:');
});

test('every legacy key maps to the same suffix under the new prefix', () => {
  const pairs = planKeyMigration([
    'nativa:preferences',
    'nativa:progress:v1',
    'nativa:vocab:v1',
    'nativa:speaking-stats',
  ]);
  assert.deepEqual(pairs, [
    ['nativa:preferences', 'babelish:preferences'],
    ['nativa:progress:v1', 'babelish:progress:v1'],
    ['nativa:vocab:v1', 'babelish:vocab:v1'],
    ['nativa:speaking-stats', 'babelish:speaking-stats'],
  ]);
});

test('versioned suffixes survive intact — no silent reset to a fresh key', () => {
  // A lost `:v1` would read as "no stored progress" and zero the learner out.
  assert.equal(migratedKey('nativa:progress:v1'), 'babelish:progress:v1');
  assert.equal(migratedKey('nativa:vocab:v1'), 'babelish:vocab:v1');
});

test('auth session keys migrate — a rename must not sign everyone out', () => {
  assert.equal(migratedKey(SESSION_KEYS.legacyNeon), SESSION_KEYS.currentNeon);
  assert.equal(migratedKey(SESSION_KEYS.legacyDemo), SESSION_KEYS.currentDemo);
  assert.equal(SESSION_KEYS.currentNeon, 'babelish:neon-session');
  assert.equal(SESSION_KEYS.currentDemo, 'babelish:demo-user');
});

test('keys that are not legacy are left alone', () => {
  const pairs = planKeyMigration([
    'babelish:preferences', // already migrated
    'expo-store', // unrelated third-party key
    'nativa', // no colon — not one of ours
    'NATIVA:PROFILE', // wrong case — AsyncStorage keys are case-sensitive
  ]);
  assert.deepEqual(pairs, [], 'nothing here should be rewritten');
});

test('the migration flag is never migrated into itself', () => {
  assert.deepEqual(planKeyMigration([MIGRATION_FLAG]), []);
  assert.equal(MIGRATION_FLAG, 'babelish:storage-migrated-v1');
  assert.ok(
    MIGRATION_FLAG.startsWith(CURRENT_PREFIX),
    'the flag must live under the NEW prefix so it is not itself a migration candidate'
  );
});

test('a bare prefix is not treated as a real key', () => {
  assert.deepEqual(planKeyMigration([LEGACY_PREFIX]), []);
});

test('privacy.ts legacy wipe list maps exactly onto the current key list', () => {
  // The two lists must stay mirror images: if someone adds a data key to one
  // and not the other, either the migration misses learner data or the GDPR
  // erase leaves a copy behind.
  const mapped = planKeyMigration(LEGACY_LOCAL_DATA_KEYS).map(([, next]) => next);
  assert.deepEqual(mapped, [...LOCAL_DATA_KEYS]);
  assert.equal(
    ALL_LOCAL_DATA_KEYS.length,
    LOCAL_DATA_KEYS.length + LEGACY_LOCAL_DATA_KEYS.length,
    'the erase set must cover both prefixes'
  );
});

test('every key the app persists is covered by the prefix rule', () => {
  // Guards against a module introducing a storage key outside the two known
  // prefixes, which the migration would then skip.
  const known = new Set<string>([
    ...LEGACY_LOCAL_DATA_KEYS,
    ...LOCAL_DATA_KEYS,
    SESSION_KEYS.legacyNeon,
    SESSION_KEYS.currentNeon,
    SESSION_KEYS.legacyDemo,
    SESSION_KEYS.currentDemo,
  ]);
  for (const key of known) {
    const ok = key.startsWith(LEGACY_PREFIX) || key.startsWith(CURRENT_PREFIX);
    assert.ok(ok, `${key} uses neither prefix — the migration would skip it`);
  }
});

test('migration is idempotent — a second pass finds nothing to move', () => {
  const first = planKeyMigration([...LEGACY_LOCAL_DATA_KEYS]);
  assert.equal(first.length, LEGACY_LOCAL_DATA_KEYS.length);
  // After the first pass the app only ever holds new-prefix keys.
  const second = planKeyMigration(first.map(([, next]) => next));
  assert.deepEqual(second, [], 're-running must not rewrite or resurrect anything');
});
