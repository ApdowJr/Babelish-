import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestLevel } from '../src/lib/adaptive';

test('adaptive level starts conservatively and scales with target-language completions', () => {
  assert.equal(suggestLevel(0), 'A1');
  assert.equal(suggestLevel(5), 'A1');
  assert.equal(suggestLevel(6), 'A2');
  assert.equal(suggestLevel(16), 'B1');
  assert.equal(suggestLevel(32), 'B2');
});

test('adaptive level waits for three recent scores before changing the baseline', () => {
  assert.equal(suggestLevel(16, [100, 100]), 'B1');
  assert.equal(suggestLevel(16, [100, 100, 100]), 'B2');
  assert.equal(suggestLevel(16, [40, 50, 55]), 'A2');
});

test('adaptive level ignores invalid scores and never moves beyond CEFR bounds', () => {
  assert.equal(suggestLevel(0, [100, 100, 100]), 'A2');
  assert.equal(suggestLevel(32, [20, 30, 40]), 'B1');
  assert.equal(suggestLevel(6, [1000, -10, Number.NaN]), 'A2');
  assert.equal(suggestLevel(-3), 'A1');
});
