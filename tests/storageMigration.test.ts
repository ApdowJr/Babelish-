/**
 * Storage-migration tests for the rebrand history Nativa → (Zelvoca) → Babelish.
 *
 * Root cause these guard: renaming the on-device AsyncStorage keys without
 * carrying the values over would have looked like a clean rebrand and silently
 * wiped every existing install — progress back to zero, streaks gone, session
 * lost, everyone signed out by an update that was supposed to change only a
 * name. That is precisely what the interim `zelvoca:*` rename did, which is why
 * it is a second migration source here. The mapping rules are pure
 * (src/lib/storageKeys.ts) precisely so they can be proven under plain
 * `node --test`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_PREFIX,
  INTERIM_PREFIX,
  LEGACY_PREFIX,
  LEGACY_PREFIXES,
  MIGRATION_FLAG,
  SESSION_KEYS,
  migratedKey,
  planKeyMigration,
  preferredSources,
} from '../src/lib/storageKeys';
import {
  ALL_LOCAL_DATA_KEYS,
  LEGACY_LOCAL_DATA_KEYS,
  LOCAL_DATA_KEYS,
} from '../src/lib/privacy';

test('prefixes are the three sides of the rebrand history', () => {
  assert.equal(LEGACY_PREFIX, 'nativa:');
  assert.equal(INTERIM_PREFIX, 'zelvoca:');
  assert.equal(CURRENT_PREFIX, 'babelish:');
  assert.deepEqual([...LEGACY_PREFIXES], ['nativa:', 'zelvoca:'], 'precedence order');
});

test('every legacy prefix maps to the same suffix under the new prefix', () => {
  assert.deepEqual(planKeyMigration(['nativa:preferences', 'zelvoca:preferences']), [
    ['nativa:preferences', 'babelish:preferences'],
    ['zelvoca:preferences', 'babelish:preferences'],
  ]);
});

test('versioned suffixes survive intact — no silent reset to a fresh key', () => {
  // A lost `:v1` would read as "no stored progress" and zero the learner out.
  assert.equal(migratedKey('nativa:progress:v1'), 'babelish:progress:v1');
  assert.equal(migratedKey('zelvoca:progress:v1'), 'babelish:progress:v1');
  assert.equal(migratedKey('nativa:vocab:v1'), 'babelish:vocab:v1');
});

test('auth session keys migrate from BOTH legacy brands — no mass sign-out', () => {
  assert.equal(migratedKey(SESSION_KEYS.legacyNeon), SESSION_KEYS.currentNeon);
  assert.equal(migratedKey(SESSION_KEYS.interimNeon), SESSION_KEYS.currentNeon);
  assert.equal(migratedKey(SESSION_KEYS.legacyDemo), SESSION_KEYS.currentDemo);
  assert.equal(migratedKey(SESSION_KEYS.interimDemo), SESSION_KEYS.currentDemo);
});

test('keys that are not legacy are left alone', () => {
  assert.deepEqual(
    planKeyMigration([
      'babelish:preferences', // already current
      'expo-store', // unrelated third-party key
      'nativa', // no colon — not one of ours
      'NATIVA:PROFILE', // wrong case — AsyncStorage keys are case-sensitive
    ]),
    []
  );
});

test('the migration flag is never a migration source', () => {
  assert.deepEqual(planKeyMigration([MIGRATION_FLAG]), []);
  assert.ok(MIGRATION_FLAG.startsWith(CURRENT_PREFIX));
});

test('a bare prefix is not treated as a real key', () => {
  assert.deepEqual(planKeyMigration([LEGACY_PREFIX, INTERIM_PREFIX]), []);
});

test('precedence: the older nativa value wins when both legacy brands exist', () => {
  // nativa holds the complete history; zelvoca only captured a short window.
  const pairs = planKeyMigration([
    'zelvoca:progress:v1',
    'nativa:progress:v1',
    'zelvoca:preferences', // no nativa counterpart — interim value must survive
  ]);
  const winners = preferredSources(pairs);
  assert.equal(winners.get('babelish:progress:v1'), 'nativa:progress:v1');
  assert.equal(winners.get('babelish:preferences'), 'zelvoca:preferences');
  assert.equal(winners.size, 2);
});

test('privacy.ts legacy wipe list covers every prefix and dedupes to the current set', () => {
  const targets = new Set(planKeyMigration(LEGACY_LOCAL_DATA_KEYS).map(([, next]) => next));
  assert.deepEqual([...targets].sort(), [...LOCAL_DATA_KEYS].sort());
  assert.equal(
    ALL_LOCAL_DATA_KEYS.length,
    LOCAL_DATA_KEYS.length + LEGACY_LOCAL_DATA_KEYS.length,
    'the erase set must cover current + both legacy prefixes'
  );
  for (const prefix of LEGACY_PREFIXES) {
    assert.ok(
      LEGACY_LOCAL_DATA_KEYS.some((k) => k.startsWith(prefix)),
      `${prefix} keys must be in the erase set`
    );
  }
});

test('every persisted key uses a known prefix, so the migration cannot skip it', () => {
  const known = [
    ...LEGACY_LOCAL_DATA_KEYS,
    ...LOCAL_DATA_KEYS,
    SESSION_KEYS.legacyNeon,
    SESSION_KEYS.interimNeon,
    SESSION_KEYS.currentNeon,
    SESSION_KEYS.legacyDemo,
    SESSION_KEYS.interimDemo,
    SESSION_KEYS.currentDemo,
  ];
  for (const key of known) {
    const covered =
      LEGACY_PREFIXES.some((p) => key.startsWith(p)) || key.startsWith(CURRENT_PREFIX);
    assert.ok(covered, `${key} uses no known prefix`);
  }
});

test('migration is idempotent — a second pass finds nothing to move', () => {
  const first = planKeyMigration([...LEGACY_LOCAL_DATA_KEYS]);
  assert.equal(first.length, LEGACY_LOCAL_DATA_KEYS.length);
  const second = planKeyMigration(first.map(([, next]) => next));
  assert.deepEqual(second, [], 're-running must not rewrite or resurrect anything');
});
