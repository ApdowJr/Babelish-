/**
 * Conversations that survive a reload — pure logic, no storage calls.
 *
 * The Speak screen used to start from scratch every time the tab remounted
 * (and on every web refresh), which made a lesson conversation disposable.
 * This module owns the shape, the limits and the isolation rules; the thin
 * AsyncStorage wrapper lives in `conversationStorage.ts` so all of this can be
 * tested in Node.
 *
 * Privacy rules baked in here:
 *   - a book is keyed by OWNER (`u:<user id>` / `guest`), so two accounts on
 *     one device never read each other's chats;
 *   - only what the learner already saw is stored (no prompts, no system
 *     message, no model metadata beyond its id);
 *   - text is clipped to the same 4 000-character limit the server enforces,
 *     so a corrupt entry cannot blow up storage or the request body later;
 *   - old conversations expire instead of accumulating forever.
 */

export type ChatRecord = {
  role: 'user' | 'assistant';
  text: string;
  translation?: string;
  tip?: string;
  fromVoice?: boolean;
  runtime?: string;
  model?: string;
};

export type StoredConversation = {
  updatedAt: number;
  messages: ChatRecord[];
};

export type ConversationBook = {
  version: 1;
  conversations: Record<string, StoredConversation>;
};

/** Matches the server's `history` cap — anything older cannot be sent anyway. */
export const MAX_MESSAGES = 40;
/** Newest N language/scenario pairs kept per owner (LRU by `updatedAt`). */
export const MAX_CONVERSATIONS = 12;
/** Conversations untouched for this long are dropped on read. */
export const MAX_AGE_DAYS = 45;

const MAX_TEXT = 4_000;
const MAX_TRANSLATION = 4_000;
const MAX_TIP = 600;
const MAX_MODEL = 80;

/** `u:<id>` for a signed-in learner, `guest` otherwise. Never mixed. */
export function ownerIdFor(userId?: string | null): string {
  const id = (userId ?? '').trim();
  return id ? `u:${id}` : 'guest';
}

export function bookKey(owner: string): string {
  return `babelish:chat:v1:${owner}`;
}

/** `<language>:<scenario | free>` — a French lesson is not a Japanese one. */
export function slotId(languageId: string, scenarioId?: string | null): string {
  const language = (languageId ?? '').trim() || 'unknown';
  const scenario = (scenarioId ?? '').trim() || 'free';
  return `${language}:${scenario}`;
}

function text(value: unknown, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

/** Returns a storable copy of one message, or `null` if it is unusable. */
export function cleanMessage(raw: unknown): ChatRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (record.role !== 'user' && record.role !== 'assistant') return null;
  const body = text(record.text, MAX_TEXT);
  if (!body) return null;

  const message: ChatRecord = { role: record.role, text: body };
  const translation = text(record.translation, MAX_TRANSLATION);
  const tip = text(record.tip, MAX_TIP);
  const model = text(record.model, MAX_MODEL);
  const runtime = text(record.runtime, MAX_MODEL);
  if (translation) message.translation = translation;
  if (tip) message.tip = tip;
  if (model) message.model = model;
  if (runtime) message.runtime = runtime;
  if (record.fromVoice === true) message.fromVoice = true;
  return message;
}

export function emptyBook(): ConversationBook {
  return { version: 1, conversations: {} };
}

/**
 * Turns whatever is in storage into a book. Junk is dropped, never thrown:
 * a half-written JSON blob must not take the Speak screen down.
 */
export function normalizeBook(raw: unknown): ConversationBook {
  let value = raw;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return emptyBook();
    }
  }
  if (!value || typeof value !== 'object') return emptyBook();
  const record = value as Record<string, unknown>;
  const conversations = record.conversations;
  if (!conversations || typeof conversations !== 'object') return emptyBook();

  const book = emptyBook();
  for (const [slot, entry] of Object.entries(conversations as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const stored = entry as Record<string, unknown>;
    const rawMessages = Array.isArray(stored.messages) ? stored.messages : [];
    const messages = rawMessages
      .map(cleanMessage)
      .filter((message): message is ChatRecord => message !== null)
      .slice(-MAX_MESSAGES);
    if (messages.length === 0) continue;
    const updatedAt = Number(stored.updatedAt);
    book.conversations[slot] = {
      updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? updatedAt : 0,
      messages,
    };
  }
  return book;
}

function isFresh(conversation: StoredConversation, now: number): boolean {
  if (!conversation.updatedAt) return false;
  return now - conversation.updatedAt <= MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

/** The stored conversation for a slot, or `null` when absent/too old. */
export function getConversation(
  book: ConversationBook,
  slot: string,
  now: number = Date.now()
): StoredConversation | null {
  const conversation = book.conversations[slot];
  if (!conversation || conversation.messages.length === 0) return null;
  return isFresh(conversation, now) ? conversation : null;
}

/**
 * Stores `messages` for one slot. The newest `MAX_MESSAGES` are kept, and only
 * the newest `MAX_CONVERSATIONS` slots survive — so a learner who samples
 * twelve languages does not slowly fill the device.
 */
export function upsertConversation(
  book: ConversationBook,
  slot: string,
  messages: readonly unknown[],
  now: number = Date.now()
): ConversationBook {
  const cleaned = messages
    .map(cleanMessage)
    .filter((message): message is ChatRecord => message !== null)
    .slice(-MAX_MESSAGES);

  const conversations: Record<string, StoredConversation> = { ...book.conversations };
  if (cleaned.length === 0) {
    delete conversations[slot];
    return { version: 1, conversations };
  }
  conversations[slot] = { updatedAt: now, messages: cleaned };

  const kept = Object.entries(conversations)
    .filter(([, entry]) => isFresh(entry, now))
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
    .slice(0, MAX_CONVERSATIONS);

  return { version: 1, conversations: Object.fromEntries(kept) };
}

/**
 * Removes one slot and leaves every other conversation alone.
 * Used by "Clear conversation" in the Speak screen.
 */
export function removeConversation(book: ConversationBook, slot: string): ConversationBook {
  const conversations = { ...book.conversations };
  delete conversations[slot];
  return { version: 1, conversations };
}

/** True when the slot has something a learner would recognise as a chat. */
export function hasConversation(book: ConversationBook, slot: string, now = Date.now()): boolean {
  return getConversation(book, slot, now) !== null;
}
