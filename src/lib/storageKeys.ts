/**
 * Storage key prefixes for the rebrand history: Nativa → (Zelvoca) → Babelish.
 *
 * There are TWO legacy prefixes, not one. `nativa:*` is the original. `zelvoca:*`
 * comes from a competing rename that reached `main` (PR #2) and was deployed to
 * the Vercel preview before this branch superseded it — so a learner who opened
 * the web preview in that window has `zelvoca:*` keys, and their older
 * `nativa:*` data was left orphaned by that build (it renamed keys in place with
 * no carry-over). Carrying both over is what makes this rename actually
 * non-destructive for every cohort.
 *
 * Pure and dependency-free (node-testable) on purpose: this is the logic that
 * decides which on-device keys get carried over, and it is the one part of a
 * rename that can silently destroy learner data if it is wrong. Keeping it free
 * of AsyncStorage means tests/storageMigration.test.ts can exercise it under
 * plain `node --test` with no React Native runtime.
 *
 * The AsyncStorage side lives in src/lib/storageMigration.ts.
 */

/** The original prefix, pre-rename. Holds the learner's full history. */
export const LEGACY_PREFIX = 'nativa:';
/** Prefix from the short-lived Zelvoca build that reached the web preview. */
export const INTERIM_PREFIX = 'zelvoca:';
/**
 * Legacy prefixes in PRECEDENCE order: when several exist for the same key,
 * the earliest brand wins, because it holds the complete history while later
 * builds only captured what the learner did in their (short) window.
 */
export const LEGACY_PREFIXES = [LEGACY_PREFIX, INTERIM_PREFIX] as const;
/** Prefix used from this rename onwards. */
export const CURRENT_PREFIX = 'babelish:';

/**
 * Written once the carry-over has completed; makes the pass a no-op forever
 * after. Lives under the NEW prefix so it is never itself a migration source.
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
  interimNeon: 'zelvoca:neon-session',
  currentNeon: 'babelish:neon-session',
  legacyDemo: 'nativa:demo-user',
  interimDemo: 'zelvoca:demo-user',
  currentDemo: 'babelish:demo-user',
} as const;

/** The new name for a legacy key under any legacy prefix, or null if it is not one. */
export function migratedKey(key: string): string | null {
  for (const prefix of LEGACY_PREFIXES) {
    if (!key.startsWith(prefix)) continue;
    const suffix = key.slice(prefix.length);
    if (!suffix) continue; // a bare prefix is not a real key
    if (key === MIGRATION_FLAG) continue;
    return `${CURRENT_PREFIX}${suffix}`;
  }
  return null;
}

/**
 * Pure mapping from every legacy key (any legacy prefix) to its new key.
 *
 * Deliberately prefix-driven rather than a hardcoded list: it carries over any
 * legacy key that exists, including one added after this file was written or a
 * key this author forgot to enumerate. Multiple legacy keys may map to the same
 * target — use `preferredSources` to pick the winner.
 */
export function planKeyMigration(keys: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (const key of keys) {
    const target = migratedKey(key);
    if (target) pairs.push([key, target]);
  }
  return pairs;
}

/** Rank of a legacy key: lower = older brand = wins. Unknown prefixes rank last. */
function precedence(key: string): number {
  const i = LEGACY_PREFIXES.findIndex((p) => key.startsWith(p));
  return i === -1 ? LEGACY_PREFIXES.length : i;
}

/**
 * For each migration target, the single legacy source that should win, by
 * brand precedence (`nativa:*` over `zelvoca:*`).
 */
export function preferredSources(pairs: readonly [string, string][]): Map<string, string> {
  const best = new Map<string, string>();
  for (const [source, target] of pairs) {
    const current = best.get(target);
    if (current === undefined || precedence(source) < precedence(current)) {
      best.set(target, source);
    }
  }
  return best;
}
