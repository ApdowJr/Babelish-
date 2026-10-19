/**
 * Storage key prefixes for the Nativa → Babelish rename.
 *
 * Pure and dependency-free (node-testable) on purpose: this is the logic that
 * decides which on-device keys get carried over, and it is the one part of the
 * rename that can silently destroy learner data if it is wrong. Keeping it free
 * of AsyncStorage means tests/storageMigration.test.ts can exercise it under
 * plain `node --test` with no React Native runtime.
 *
 * The AsyncStorage side lives in src/lib/storageMigration.ts.
 */

/** Prefix used before the rename. */
export const LEGACY_PREFIX = 'nativa:';
/** Prefix used from the rename onwards. */
export const CURRENT_PREFIX = 'babelish:';

/**
 * Written once the carry-over has completed; makes the pass a no-op forever
 * after. Lives under the NEW prefix so it is never itself migrated.
 */
export const MIGRATION_FLAG = 'babelish:storage-migrated-v1';

/**
 * Auth session keys. Listed here because they are the difference between a
 * rename and a mass sign-out: they are deliberately excluded from privacy.ts's
 * data-export/wipe set (the auth layer owns their lifecycle), so nothing else
 * in the codebase enumerates them.
 */
export const SESSION_KEYS = {
  legacyNeon: 'nativa:neon-session',
  currentNeon: 'babelish:neon-session',
  legacyDemo: 'nativa:demo-user',
  currentDemo: 'babelish:demo-user',
} as const;

/**
 * Pure mapping from legacy key to new key.
 *
 * Deliberately prefix-driven rather than a hardcoded list: it carries over any
 * `nativa:*` key that exists, including one added after this file was written
 * or a key this author forgot to enumerate.
 */
export function planKeyMigration(keys: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const key of keys) {
    if (!key.startsWith(LEGACY_PREFIX)) continue;
    const suffix = key.slice(LEGACY_PREFIX.length);
    if (!suffix) continue; // a bare "nativa:" is not a real key
    if (key === MIGRATION_FLAG) continue;
    pairs.push([key, `${CURRENT_PREFIX}${suffix}`]);
  }
  return pairs;
}

/** The new name for a single legacy key, or null if it is not one. */
export function migratedKey(key: string): string | null {
  const [pair] = planKeyMigration([key]);
  return pair ? pair[1] : null;
}
