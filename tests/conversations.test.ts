/**
 * Conversation persistence tests.
 *
 * A stored chat is the one place where a bug leaks another learner's words,
 * or fills the device forever. These pin the rules that matter: isolation by
 * owner, per-language/per-scenario slots, hard caps, clipping, expiry, and a
 * total refusal to throw on corrupt JSON.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_AGE_DAYS,
  MAX_CONVERSATIONS,
  MAX_MESSAGES,
  bookKey,
  cleanMessage,
  emptyBook,
  getConversation,
  hasConversation,
  normalizeBook,
  ownerIdFor,
  slotId,
  upsertConversation,
} from '../src/lib/conversations';

const now = Date.parse('2026-10-22T12:00:00Z');
const turn = (text: string, role: 'user' | 'assistant' = 'user') => ({ role, text });

test('owners are isolated: guests, and each signed-in account', () => {
  assert.equal(ownerIdFor(null), 'guest');
  assert.equal(ownerIdFor('   '), 'guest');
  assert.equal(ownerIdFor('abc'), 'u:abc');
  assert.notEqual(bookKey(ownerIdFor('a')), bookKey(ownerIdFor('b')));
  assert.notEqual(bookKey(ownerIdFor('a')), bookKey(ownerIdFor(null)));
});

test('slots separate languages and scenarios', () => {
  assert.equal(slotId('es'), 'es:free');
  assert.equal(slotId('es', 'cafe'), 'es:cafe');
  assert.notEqual(slotId('es', 'cafe'), slotId('fr', 'cafe'));
  assert.notEqual(slotId('es', 'cafe'), slotId('es', 'airport'));
});

test('a saved conversation comes back, messages intact', () => {
  let book = emptyBook();
  book = upsertConversation(book, 'es:cafe', [turn('Hola'), turn('¡Hola! ¿Qué tal?', 'assistant')], now);
  const stored = getConversation(book, 'es:cafe', now);
  assert.ok(stored);
  assert.equal(stored.messages.length, 2);
  assert.equal(stored.messages[1].role, 'assistant');
  assert.equal(stored.messages[1].text, '¡Hola! ¿Qué tal?');
  assert.equal(getConversation(book, 'fr:cafe', now), null, 'other languages stay separate');
});

test('unusable messages are dropped instead of stored', () => {
  assert.equal(cleanMessage(null), null);
  assert.equal(cleanMessage({ role: 'system', text: 'prompt' }), null, 'system prompts are not history');
  assert.equal(cleanMessage({ role: 'user', text: '   ' }), null);
  assert.equal(cleanMessage({ role: 'user', text: 42 }), null);

  const long = cleanMessage({ role: 'assistant', text: 'x'.repeat(9_000), tip: 't'.repeat(2_000) });
  assert.ok(long);
  assert.equal(long.text.length, 4_000, 'clipped to the server history limit');
  assert.ok((long.tip ?? '').length <= 600);
});

test('only the newest messages are kept', () => {
  const many = Array.from({ length: MAX_MESSAGES + 15 }, (_, i) => turn(`m${i}`));
  const book = upsertConversation(emptyBook(), 'es:free', many, now);
  const stored = getConversation(book, 'es:free', now);
  assert.ok(stored);
  assert.equal(stored.messages.length, MAX_MESSAGES);
  assert.equal(stored.messages[stored.messages.length - 1].text, `m${MAX_MESSAGES + 14}`);
  assert.equal(stored.messages[0].text, `m${15}`, 'the oldest are the ones dropped');
});

test('only the newest conversations are kept', () => {
  let book = emptyBook();
  for (let i = 0; i < MAX_CONVERSATIONS + 5; i += 1) {
    book = upsertConversation(book, `lang${i}:free`, [turn(`hello ${i}`)], now + i * 1_000);
  }
  const slots = Object.keys(book.conversations);
  assert.equal(slots.length, MAX_CONVERSATIONS);
  assert.ok(!slots.includes('lang0:free'), 'the oldest conversation was evicted');
  assert.ok(slots.includes(`lang${MAX_CONVERSATIONS + 4}:free`));
});

test('old conversations expire instead of lingering', () => {
  const stale = now - (MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000;
  const book = upsertConversation(emptyBook(), 'es:free', [turn('hola')], stale);
  assert.equal(getConversation(book, 'es:free', now), null);
  assert.equal(hasConversation(book, 'es:free', now), false);

  const fresh = upsertConversation(book, 'es:free', [turn('hola')], now);
  assert.equal(hasConversation(fresh, 'es:free', now), true);
});

test('corrupt storage never throws and never half-loads', () => {
  assert.deepEqual(normalizeBook(null), emptyBook());
  assert.deepEqual(normalizeBook('not json'), emptyBook());
  assert.deepEqual(normalizeBook({ version: 9 }), emptyBook());
  assert.deepEqual(normalizeBook({ conversations: 'nope' }), emptyBook());

  const mixed = normalizeBook({
    conversations: {
      'es:free': {
        updatedAt: now,
        messages: [turn('ok'), { role: 'user' }, 'garbage', turn('also ok', 'assistant')],
      },
      'fr:free': { updatedAt: now, messages: [] },
    },
  });
  assert.equal(Object.keys(mixed.conversations).length, 1);
  assert.equal(mixed.conversations['es:free'].messages.length, 2);
});

test('saving an empty conversation removes the slot', () => {
  const book = upsertConversation(emptyBook(), 'es:free', [turn('hola')], now);
  const cleared = upsertConversation(book, 'es:free', [], now);
  assert.equal(getConversation(cleared, 'es:free', now), null);
});

test('a round-trip through JSON preserves the book', () => {
  const book = upsertConversation(
    emptyBook(),
    'ja:cafe',
    [turn('こんにちは'), { role: 'assistant', text: 'こんにちは！', translation: 'Hello!', runtime: 'gateway' }],
    now
  );
  const restored = normalizeBook(JSON.stringify(book));
  assert.deepEqual(restored, book);
});
