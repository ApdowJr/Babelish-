/**
 * One-time on-device storage migration for the rebrand history
 * Nativa → (Zelvoca) → Babelish.
 *
 * Why this exists: every piece of learner state was persisted under a
 * `nativa:*` AsyncStorage key (progress, vocabulary, XP analytics, profile,
 * preferences, subscription, the report queue and — importantly — the auth
 * session). Renaming those keys in place would have looked like a successful
 * rebrand and silently wiped every existing install: progress reset to zero,
 * streaks gone, and everyone signed out on the update that was supposed to
 * change nothing but a name. That is exactly what the interim `zelvoca:*`
 * rename did, which is why it is a second source here.
 *
 * So the rename ships with a carry-over pass that runs BEFORE any provider
 * reads its key (see src/app/_layout.tsx, which gates the whole tree on it).
 *
 * Guarantees, in priority order:
 *  1. Never clobber — a key that already exists under `babelish:*` is left
 *     alone. The new value always wins, so a re-run can't resurrect stale data.
 *  2. Never lose — a legacy key is removed only AFTER its copy is confirmed
 *     written. Any failure leaves the originals untouched.
 *  3. Precedence — when both `nativa:*` and `zelvoca:*` exist for one key, the
 *     older `nativa:*` value wins: it holds the complete history, while the
 *     interim build only captured a short window.
 *  4. Never white-screen — this module does not throw. A failed migration
 *     reports honestly and, by not setting the flag, retries on next launch.
 *
 * The key-mapping rules live in src/lib/storageKeys.ts, which is pure and
 * unit-tested under plain node (no React Native runtime required).
 *
 * The legacy keys are also still listed in privacy.ts's wipe set: a learner may
 * exercise their right to erase before this ever runs, and erasing a key that
 * no longer exists is a harmless no-op.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MIGRATION_FLAG, planKeyMigration, preferredSources } from '@/lib/storageKeys';

export {
  CURRENT_PREFIX,
  INTERIM_PREFIX,
  LEGACY_PREFIX,
  LEGACY_PREFIXES,
  MIGRATION_FLAG,
  migratedKey,
  planKeyMigration,
  preferredSources,
} from '@/lib/storageKeys';

export type MigrationResult = {
  /** false when the migration had already run (or there was nothing to do). */
  ran: boolean;
  /** Legacy keys whose data now exists under the new prefix. */
  migrated: string[];
  /** Legacy keys that could not be carried over — their originals are intact. */
  failed: string[];
};

const NOTHING_TO_DO: MigrationResult = { ran: false, migrated: [], failed: [] };

/**
 * Carries every legacy (`nativa:*`, `zelvoca:*`) value over to `babelish:*`,
 * once. Safe to call on every launch: after the first success it returns
 * immediately.
 */
export async function migrateLegacyStorage(): Promise<MigrationResult> {
  const migrated: string[] = [];
  const failed: string[] = [];

  try {
    if (await AsyncStorage.getItem(MIGRATION_FLAG)) return NOTHING_TO_DO;

    const pairs = planKeyMigration(await AsyncStorage.getAllKeys());
    if (pairs.length === 0) {
      // Nothing legacy on this device — record that so later launches skip
      // the getAllKeys scan entirely.
      await AsyncStorage.setItem(MIGRATION_FLAG, '1');
      return NOTHING_TO_DO;
    }

    const winner = preferredSources(pairs);
    // Every legacy source per target, so all copies get cleaned up, not just
    // the one that won.
    const allSources = new Map<string, string[]>();
    for (const [source, target] of pairs) {
      allSources.set(target, [...(allSources.get(target) ?? []), source]);
    }

    for (const [target, source] of winner) {
      const staleSources = allSources.get(target) ?? [source];
      try {
        const value = await AsyncStorage.getItem(source);
        if (value === null) continue;

        if ((await AsyncStorage.getItem(target)) !== null) {
          // Already migrated (or written natively under the new prefix). The
          // newer value wins; drop the stale originals so they can't come back.
          await AsyncStorage.multiRemove(staleSources);
          migrated.push(source);
          continue;
        }

        await AsyncStorage.setItem(target, value);
        // Remove only now that the copy is confirmed written.
        await AsyncStorage.multiRemove(staleSources);
        migrated.push(source);
      } catch {
        // Leave the legacy values in place and let the next launch retry.
        failed.push(source);
      }
    }

    // Only claim success if nothing failed — otherwise retry on next launch.
    if (failed.length === 0) await AsyncStorage.setItem(MIGRATION_FLAG, '1');
  } catch {
    // Storage itself is unavailable (private mode, full disk, SSR). The app
    // must still boot: providers fall back to their own empty-state defaults.
    return NOTHING_TO_DO;
  }

  return { ran: migrated.length > 0 || failed.length > 0, migrated, failed };
}
