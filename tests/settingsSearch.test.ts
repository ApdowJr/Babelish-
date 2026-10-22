/**
 * Settings search.
 *
 * A settings screen that hides what you are looking for is worse than one with
 * no search box. These rules are pure: label, hint and keywords, any case, and
 * a matching group title keeps the whole group.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSettings, normalizeQuery } from '../src/lib/settingsSearch';

const groups = [
  {
    title: 'Learning',
    rows: [
      { id: 'goal', label: 'Daily goal', hint: 'XP target', keywords: 'minutes' },
      { id: 'native', label: 'Explanation language', hint: 'Translations', keywords: 'native' },
    ],
  },
  {
    title: 'Data & storage',
    rows: [
      { id: 'export', label: 'Export my data', hint: 'Backup', keywords: 'download privacy' },
      { id: 'clear', label: 'Clear saved conversations', keywords: 'delete history chat' },
    ],
  },
];

test('an empty query returns the same list', () => {
  assert.equal(filterSettings(groups, ''), groups);
  assert.equal(filterSettings(groups, '   '), groups);
  assert.equal(normalizeQuery('  Voice '), 'voice');
});

test('matching is case-insensitive and reaches the hint', () => {
  const result = filterSettings(groups, 'BACKUP');
  assert.equal(result.length, 1);
  assert.equal(result[0].title, 'Data & storage');
  assert.deepEqual(
    result[0].rows.map((row) => row.id),
    ['export']
  );
});

test('keywords find a row whose label says something else', () => {
  const result = filterSettings(groups, 'privacy');
  assert.deepEqual(
    result.flatMap((group) => group.rows.map((row) => row.id)),
    ['export']
  );
});

test('a group title match keeps every row in the group', () => {
  const result = filterSettings(groups, 'learning');
  assert.equal(result.length, 1);
  assert.equal(result[0].rows.length, 2);
});

test('a query with no match returns nothing, not everything', () => {
  assert.deepEqual(filterSettings(groups, 'dark mode'), []);
});
