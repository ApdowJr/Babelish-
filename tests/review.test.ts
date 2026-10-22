/**
 * Review-layer maths: answer grading, due queue, grouping and box movement.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysForBox,
  describeBox,
  dueWords,
  groupByLanguage,
  isTypedAnswerCorrect,
  nextBox,
  normalizeAnswer,
  summarizeSession,
} from '../src/lib/review';
import type { VocabItem } from '../src/lib/curriculum/types';

function word(partial: Partial<VocabItem> & Pick<VocabItem, 'itemKey'>): VocabItem {
  return {
    languageId: 'es',
    target: 'hola',
    translation: 'hello',
    box: 1,
    dueAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

test('grading is accent- and case-insensitive but not sloppy', () => {
  assert.equal(normalizeAnswer('  ¡Buenas   TARDES! '), 'buenas tardes');
  assert.equal(isTypedAnswerCorrect('Buenas tardes', 'buenas tardes'), true);
  assert.equal(isTypedAnswerCorrect('buenas  tardes', 'Buenas tardes'), true);
  assert.equal(isTypedAnswerCorrect('buenas', 'buenas tardes'), false);
  assert.equal(isTypedAnswerCorrect('   ', 'hola'), false);
  assert.equal(isTypedAnswerCorrect('こんにちは', 'こんにちは'), true);
});

test('dueWords returns only due cards, oldest first', () => {
  const vocab = {
    a: word({ itemKey: 'a', dueAt: '2026-01-02T00:00:00.000Z' }),
    b: word({ itemKey: 'b', dueAt: '2025-12-30T00:00:00.000Z' }),
    c: word({ itemKey: 'c', dueAt: '2027-01-01T00:00:00.000Z' }),
  };
  const due = dueWords(vocab, new Date('2026-01-03T00:00:00.000Z'));
  assert.deepEqual(
    due.map((item) => item.itemKey),
    ['b', 'a']
  );
});

test('groupByLanguage counts and orders by load', () => {
  const grouped = groupByLanguage([
    word({ itemKey: '1', languageId: 'es' }),
    word({ itemKey: '2', languageId: 'es' }),
    word({ itemKey: '3', languageId: 'ja' }),
    word({ itemKey: '4', languageId: 'fr' }),
    word({ itemKey: '5', languageId: 'fr' }),
    word({ itemKey: '6', languageId: 'fr' }),
  ]);
  assert.deepEqual(grouped, [
    { languageId: 'fr', count: 3 },
    { languageId: 'es', count: 2 },
    { languageId: 'ja', count: 1 },
  ]);
  assert.deepEqual(groupByLanguage([]), []);
});

test('session summaries are clamped and never divide by zero', () => {
  assert.deepEqual(summarizeSession(3, 4), { total: 4, correct: 3, incorrect: 1, accuracy: 0.75 });
  assert.deepEqual(summarizeSession(0, 0), { total: 0, correct: 0, incorrect: 0, accuracy: 0 });
  assert.deepEqual(summarizeSession(9, 4), { total: 4, correct: 4, incorrect: 0, accuracy: 1 });
  assert.deepEqual(summarizeSession(-2, 4), { total: 4, correct: 0, incorrect: 4, accuracy: 0 });
});

test('Leitner boxes move one step up and reset on a miss', () => {
  assert.equal(nextBox(1, true), 2);
  assert.equal(nextBox(3, true), 4);
  assert.equal(nextBox(5, true), 5, 'box 5 is the ceiling');
  assert.equal(nextBox(4, false), 1);
  assert.equal(nextBox(1, false), 1);
});

test('box intervals and copy match the learning store', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((box) => daysForBox(box)), [1, 2, 4, 8, 15]);
  assert.equal(describeBox(1), 'tomorrow');
  assert.equal(describeBox(4), 'in 8 days');
  assert.equal(daysForBox(99), 15);
});
