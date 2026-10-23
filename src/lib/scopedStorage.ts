import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  LEGACY_OWNER_KEY,
  canClaimLegacyData,
  deletionKeysForUser,
  progressKeysForUser,
  scopedStorageKey,
} from './accountScope';
import { PROGRESS_KEYS } from './resetProgress';

/**
 * Reads an account-scoped AsyncStorage key. If a single-account device is
 * upgrading from an earlier un-scoped build, the first signed-in learner
 * claims and migrates the legacy value; any later account on the same device
 * starts clean and never sees the first learner's data.
 */
export async function readScopedItem(
  baseKey: string,
  userId?: string | null
): Promise<string | null> {
  try {
    if (!userId) {
      return await AsyncStorage.getItem(baseKey);
    }
    const key = scopedStorageKey(baseKey, userId);
    const existing = await AsyncStorage.getItem(key);
    if (existing !== null) return existing;

    const legacy = await AsyncStorage.getItem(baseKey);
    if (legacy === null) return null;

    const legacyOwner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
    if (!canClaimLegacyData(userId, legacyOwner)) return null;

    if (!legacyOwner) {
      await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId);
    }
    await AsyncStorage.setItem(key, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export async function writeScopedItem(
  baseKey: string,
  value: string,
  userId?: string | null
): Promise<void> {
  try {
    const key = scopedStorageKey(baseKey, userId);
    await AsyncStorage.setItem(key, value);
    if (userId) {
      const legacyOwner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
      if (!legacyOwner) {
        await AsyncStorage.setItem(LEGACY_OWNER_KEY, userId);
      }
    }
  } catch {
    // Best-effort local persistence.
  }
}

export async function removeScopedItem(
  baseKey: string,
  userId?: string | null
): Promise<void> {
  try {
    await AsyncStorage.removeItem(scopedStorageKey(baseKey, userId));
    if (userId) {
      const legacyOwner = await AsyncStorage.getItem(LEGACY_OWNER_KEY);
      if (canClaimLegacyData(userId, legacyOwner)) {
        await AsyncStorage.removeItem(baseKey);
      }
    } else {
      await AsyncStorage.removeItem(baseKey);
    }
  } catch {
    // Best-effort cleanup.
  }
}

export async function clearScopedProgress(userId?: string | null): Promise<void> {
  try {
    const scopedKeys = progressKeysForUser(userId);
    const legacyOwner = userId ? await AsyncStorage.getItem(LEGACY_OWNER_KEY) : null;
    const includeLegacy = !userId || canClaimLegacyData(userId, legacyOwner);

    const removeKeys = [
      ...scopedKeys.filter((k) => !k.includes(':progress:v1') && !k.includes(':vocab:v1')),
      ...(includeLegacy
        ? PROGRESS_KEYS.filter((k) => k !== 'zelvoca:progress:v1' && k !== 'zelvoca:vocab:v1')
        : []),
    ];
    if (removeKeys.length > 0) {
      await AsyncStorage.multiRemove(Array.from(new Set(removeKeys)));
    }

    const emptyPairs: [string, string][] = [
      [scopedStorageKey('zelvoca:progress:v1', userId), '{}'],
      [scopedStorageKey('zelvoca:vocab:v1', userId), '{}'],
      ...(includeLegacy
        ? ([
            ['zelvoca:progress:v1', '{}'],
            ['zelvoca:vocab:v1', '{}'],
          ] as [string, string][])
        : []),
    ];
    await AsyncStorage.multiSet(emptyPairs);
  } catch {
    // Storage unavailable: in-memory reset still took effect.
  }
}

export async function clearAllAccountLocalData(userId?: string | null): Promise<void> {
  try {
    const legacyOwner = userId ? await AsyncStorage.getItem(LEGACY_OWNER_KEY) : null;
    const keys = deletionKeysForUser(userId, legacyOwner);
    await AsyncStorage.multiRemove(keys);
  } catch {
    // Best-effort erasure.
  }
}
