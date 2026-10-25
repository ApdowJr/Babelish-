import { test } from 'node:test';
import assert from 'node:assert/strict';
import { translateUi } from '../src/lib/interfaceLocalization';

test('English interface preserves source copy', () => {
  assert.equal(translateUi('Settings', 'en'), 'Settings');
});

test('Somali interface translates common navigation and settings labels', () => {
  assert.equal(translateUi('Home', 'so'), 'Hoyga');
  assert.equal(translateUi('Interface language', 'so'), 'Luqadda app-ka');
  assert.equal(translateUi('Show translations', 'so'), 'Muuji tarjumaadaha');
});

test('unknown or dynamic text is preserved instead of being guessed', () => {
  assert.equal(translateUi('Custom course: Swahili', 'so'), 'Custom course: Swahili');
});
