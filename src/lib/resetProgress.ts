/**
 * "Start over" — what a reset removes, and what it must never touch.
 *
 * A learner who wants a clean slate should not have to delete their account
 * (which also erases the profile, preferences and — on Neon — the auth user).
 * This module is the single list of learning data, kept separate from
 * `LOCAL_DATA_KEYS` (the account-deletion list) on purpose:
 *
 *   reset   → lessons, vocabulary, XP, streak, speaking stats, reports
 *   keep    → account, sign-in, profile, preferences, conversations,
 *             subscription state, bundled curriculum
 *
 * `PROGRESS_KEYS` is asserted by a test, so adding a new learning store means
 * updating this file rather than silently surviving a reset.
 */
/** Stores that hold learning progress. Cleared by "Reset progress". */
export const PROGRESS_KEYS = [
  'zelvoca:progress:v1',
  'zelvoca:vocab:v1',
  'zelvoca:analytics',
  'zelvoca:speaking-stats',
  'zelvoca:report-queue',
] as const;

/**
 * Stores that must survive a reset. Exported so the test can prove the two
 * lists never overlap — a stray key in both would be a silent data loss bug.
 */
export const KEPT_ON_RESET = [
  'zelvoca:preferences',
  'zelvoca:profile',
  'zelvoca:subscription',
  'zelvoca:session',
  'zelvoca:auth',
] as const;

export function overlapsKeptKeys(keys: readonly string[]): string[] {
  const kept = new Set<string>(KEPT_ON_RESET);
  return keys.filter((key) => kept.has(key));
}

/**
 * The removal itself lives in `@/lib/curriculum/store` (which already owns
 * those keys and the AsyncStorage binding). Keeping this module pure means the
 * boundary rules can be tested in plain Node.
 */
