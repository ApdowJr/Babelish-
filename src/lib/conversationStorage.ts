/**
 * AsyncStorage binding for conversation history.
 *
 * Deliberately thin: every rule (limits, validation, isolation, expiry) lives
 * in `conversations.ts`, which is pure and node-testable. This file can only
 * fail softly — storage being unavailable or full must never break the tutor,
 * it just means the conversation is not restored next time.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  bookKey,
  getConversation,
  normalizeBook,
  ownerIdFor,
  slotId,
  upsertConversation,
  type ConversationBook,
  type StoredConversation,
} from './conversations';

/** Reads one owner's book. Never throws; a missing/corrupt blob is empty. */
export async function loadBook(owner: string): Promise<ConversationBook> {
  try {
    const raw = await AsyncStorage.getItem(bookKey(owner));
    return normalizeBook(raw);
  } catch {
    return normalizeBook(null);
  }
}

/** The conversation for a language/scenario pair, or `null`. Never throws. */
export async function loadConversation(
  owner: string,
  languageId: string,
  scenarioId?: string | null
): Promise<StoredConversation | null> {
  const book = await loadBook(owner);
  // `getConversation` also applies the age limit, so an expired chat reads as
  // absent instead of surfacing a stale one from months ago.
  return getConversation(book, slotId(languageId, scenarioId));
}

/** Persists the visible turns for one slot. Best-effort by design. */
export async function saveConversation(
  owner: string,
  languageId: string,
  scenarioId: string | null | undefined,
  messages: readonly unknown[]
): Promise<void> {
  try {
    const book = await loadBook(owner);
    const next = upsertConversation(book, slotId(languageId, scenarioId), messages);
    await AsyncStorage.setItem(bookKey(owner), JSON.stringify(next));
  } catch {
    // Offline, quota-full or private-mode storage: the session still works.
  }
}

/**
 * Removes one owner's conversations (account deletion, "clear chat").
 * The other account on the same device is untouched.
 */
export async function clearConversations(owner: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(bookKey(owner));
  } catch {
    // Nothing to do; the data stays local to this device either way.
  }
}

export { ownerIdFor, slotId };
