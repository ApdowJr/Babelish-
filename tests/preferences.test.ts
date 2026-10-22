/**
 * Stored-preference rules.
 *
 * Preferences are read once at boot and then trusted by every screen: a bad
 * `voiceSpeed` reaches the speech engine as a rate, and a missing
 * `showTranslation` would render `undefined` in the composer. These tests pin
 * that a blob from any version (or a hand-edited one) comes back complete.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_GOALS,
  DEFAULT_PREFERENCES,
  dailyGoalXp,
  isVoiceSpeed,
  normalizePreferences,
} from '../src/lib/preferenceRules';

const known = new Set(['es', 'fr', 'ja']);
const validate = { isKnownLanguage: (id: string) => known.has(id) };
const returning = { ...DEFAULT_PREFERENCES, onboarded: true };

test('an empty or junk blob falls back field by field', () => {
  for (const raw of [null, undefined, 42, 'nope', [], true]) {
    assert.deepEqual(normalizePreferences(raw, returning, validate), returning);
  }
});

test('a partial blob keeps what it can and defaults the rest', () => {
  const result = normalizePreferences({ targetLanguageId: 'fr', dailyGoalMinutes: 20 }, returning, validate);
  assert.equal(result.targetLanguageId, 'fr');
  assert.equal(result.dailyGoalMinutes, 20);
  assert.equal(result.nativeLanguageId, DEFAULT_PREFERENCES.nativeLanguageId);
  assert.equal(result.voiceSpeed, 'normal');
  assert.equal(result.showTranslation, true);
  assert.equal(result.autoSpeak, false);
});

test('an unknown language never becomes the course', () => {
  const result = normalizePreferences({ targetLanguageId: 'xx' }, returning, validate);
  assert.equal(result.targetLanguageId, DEFAULT_PREFERENCES.targetLanguageId);
});

test('the active list is de-duplicated and always contains the target', () => {
  const result = normalizePreferences(
    { targetLanguageId: 'ja', activeLanguageIds: ['fr', 'fr', 'nope', 'ja'] },
    returning,
    validate
  );
  assert.deepEqual(result.activeLanguageIds, ['fr', 'ja']);
  const onlyBad = normalizePreferences({ targetLanguageId: 'es', activeLanguageIds: ['nope'] }, returning, validate);
  assert.deepEqual(onlyBad.activeLanguageIds, ['es']);
});

test('booleans and enums are validated, not coerced', () => {
  const result = normalizePreferences(
    {
      showTranslation: 'yes',
      autoSpeak: 1,
      reduceMotion: null,
      voiceSpeed: 'warp',
      reminderKey: 17,
      dailyGoalMinutes: 7,
    },
    returning,
    validate
  );
  assert.equal(result.showTranslation, true);
  assert.equal(result.autoSpeak, false);
  assert.equal(result.reduceMotion, false);
  assert.equal(result.voiceSpeed, 'normal');
  assert.equal(result.reminderKey, null);
  assert.equal(result.dailyGoalMinutes, DEFAULT_PREFERENCES.dailyGoalMinutes);
  assert.ok(DAILY_GOALS.includes(result.dailyGoalMinutes));
});

test('valid new settings survive a round trip', () => {
  const result = normalizePreferences(
    {
      targetLanguageId: 'fr',
      showTranslation: false,
      voiceSpeed: 'slow',
      autoSpeak: true,
      reduceMotion: true,
      reminderKey: '18:00',
    },
    returning,
    validate
  );
  assert.equal(result.showTranslation, false);
  assert.equal(result.voiceSpeed, 'slow');
  assert.equal(result.autoSpeak, true);
  assert.equal(result.reduceMotion, true);
  assert.equal(result.reminderKey, '18:00');
});

test('a 1.x blob is treated as a returning learner', () => {
  const result = normalizePreferences({ targetLanguageId: 'es' }, returning, validate);
  assert.equal(result.onboarded, true);
  assert.equal(isVoiceSpeed('fast'), true);
  assert.equal(isVoiceSpeed('FAST'), false);
});

test('the daily XP target is the published minutes × 10 rule', () => {
  assert.equal(dailyGoalXp(10), 100);
  assert.equal(dailyGoalXp(0), 1);
  assert.equal(dailyGoalXp(15), 150);
});
