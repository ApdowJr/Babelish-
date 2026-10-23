/**
 * Per-account storage key scoping on shared devices.
 *
 * Without account scoping, User A signing out and User B signing in on the
 * same phone would merge User A's local progress, vocabulary, profile, XP,
 * speaking stats, and queued reports directly into User B's Supabase account.
 *
 * Scoping keys by `u:<userId>` isolates accounts on the same device while
 * still preserving each learner's offline data across sign-out / sign-in.
 */
import { LOCAL_DATA_KEYS } from './privacy';
import { PROGRESS_KEYS } from './resetProgress';

/** Storage key recording which user originally owned legacy un-scoped keys. */
export const LEGACY_OWNER_KEY = 'zelvoca:legacy-owner:v1';

/** Canonical account scope token (`u:<id>` when signed in, `null` when signed out). */
export function accountScopeId(userId?: string | null): string | null {
  const trimmed = (userId ?? '').trim();
  return trimmed ? `u:${trimmed}` : null;
}

/**
 * Returns the user-scoped AsyncStorage key when `userId` is present, or the
 * base key when signed out. Never mixes two distinct user IDs.
 */
export function scopedStorageKey(baseKey: string, userId?: string | null): string {
  const scope = accountScopeId(userId);
  return scope ? `${baseKey}:${scope}` : baseKey;
}

/**
 * Decides whether a signed-in user may migrate legacy un-scoped local data
 * (`zelvoca:progress:v1`, etc.) into their personal scoped slot:
 *   - allowed ONLY when no previous account has claimed the legacy data on
 *     this device (`legacyOwnerId` is null/empty) OR it belongs to this same
 *     user (`legacyOwnerId === userId`).
 *   - NEVER allowed for a second, different account on the same device.
 */
export function canClaimLegacyData(
  userId: string | null | undefined,
  legacyOwnerId: string | null | undefined
): boolean {
  const uid = (userId ?? '').trim();
  if (!uid) return false;
  const owner = (legacyOwnerId ?? '').trim();
  return !owner || owner === uid;
}

/** Every storage key that "Reset progress" must clear for `userId`. */
export function progressKeysForUser(userId?: string | null): string[] {
  const scoped = PROGRESS_KEYS.map((key) => scopedStorageKey(key, userId));
  return Array.from(new Set([...scoped]));
}

/** Every storage key that "Delete account" must erase for `userId`. */
export function deletionKeysForUser(
  userId?: string | null,
  legacyOwnerId?: string | null
): string[] {
  const scoped = LOCAL_DATA_KEYS.map((key) => scopedStorageKey(key, userId));
  const includeLegacy = !userId || canClaimLegacyData(userId, legacyOwnerId);
  return Array.from(
    new Set([
      ...scoped,
      ...(includeLegacy ? [...LOCAL_DATA_KEYS, LEGACY_OWNER_KEY] : []),
      'babelish:demo-user',
    ])
  );
}
