/**
 * Browser speech-output rules.
 *
 * Android Chrome fires `interrupted` / `canceled` whenever a new utterance
 * replaces an old one — normal behaviour that used to surface as
 * "Speech playback failed — try again." These tests pin what is worth showing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  baseLanguage,
  isMobileWeb,
  matchVoice,
  normalizeLocale,
  scaleSpeechRate,
  speechErrorMessage,
  toggleSpeechTarget,
  toVoiceLike,
} from '../src/lib/speech';

const voices = [
  { identifier: 'Samantha', language: 'en-US', localService: true },
  { identifier: 'Paulina', language: 'es-MX', localService: true },
  { identifier: 'Mónica', language: 'es-ES', localService: true },
  { identifier: 'Kyoko', language: 'ja-JP', localService: false },
  { identifier: 'Google हिन्दी', language: 'hi-IN', localService: false },
];

test('locales normalise across separators and case', () => {
  assert.equal(normalizeLocale('ja_JP'), 'ja-jp');
  assert.equal(normalizeLocale('EN-US'), 'en-us');
  assert.equal(baseLanguage('ar-EG'), 'ar');
  assert.equal(baseLanguage(undefined), '');
});

test('the exact region wins, then the language family', () => {
  assert.equal(matchVoice(voices, 'es-ES')?.identifier, 'Mónica');
  assert.equal(matchVoice(voices, 'es-AR')?.language, 'es-MX');
  assert.equal(matchVoice(voices, 'ja-JP')?.identifier, 'Kyoko');
  assert.equal(matchVoice(voices, 'hi-IN')?.identifier, 'Google हिन्दी');
  assert.equal(matchVoice(voices, 'ar-EG'), null);
});

test('browser-shaped voices map to the fields matchVoice understands', () => {
  // Real SpeechSynthesisVoice objects use {name, lang} — passing them straight
  // to matchVoice matched nothing and produced a false "no voice" warning.
  const browserShaped = toVoiceLike([
    { name: 'Japanese (Japan)', lang: 'ja-JP', localService: true },
    { name: 'Google 日本語', lang: 'ja-JP', localService: false },
    { name: 'Ting-Ting', lang: 'zh-CN', localService: true },
  ]);
  assert.equal(browserShaped[0].identifier, 'Japanese (Japan)');
  assert.equal(browserShaped[0].language, 'ja-JP');
  assert.equal(matchVoice(browserShaped, 'ja-JP')?.identifier, 'Japanese (Japan)');
  assert.equal(matchVoice(browserShaped, 'ja')?.language, 'ja-JP');
  assert.equal(matchVoice(toVoiceLike([{ name: 'X', lang: 'ar-EG' }]), 'ar-EG')?.identifier, 'X');
});

test('an offline voice is preferred when both exist', () => {
  const mixed = [
    { identifier: 'online', language: 'fr-FR', localService: false },
    { identifier: 'offline', language: 'fr-FR', localService: true },
  ];
  assert.equal(matchVoice(mixed, 'fr-FR')?.identifier, 'offline');
  assert.equal(matchVoice(mixed, 'fr-CA')?.identifier, 'offline');
});

test('replacement events are silent, real failures are explained', () => {
  for (const code of ['interrupted', 'canceled', 'cancelled', 'stop']) {
    assert.equal(speechErrorMessage(code, 'ja-JP'), null, code);
  }
  assert.match(String(speechErrorMessage('not-allowed', 'ja-JP')), /lock icon/i);
  assert.match(String(speechErrorMessage('audio-busy', 'ja-JP')), /speaker/i);
  assert.match(String(speechErrorMessage('voice-unavailable', 'ja-JP')), /ja-JP voice/i);
  assert.match(String(speechErrorMessage('synthesis-failed', 'ja-JP')), /text is still there/i);
  // Unknown codes must not produce a scary banner.
  assert.equal(speechErrorMessage('mystery', 'ja-JP'), null);
  assert.equal(speechErrorMessage(undefined, 'ja-JP'), null);
});

test('mobile browsers are recognised so no one is offered a 150 MB download on data', () => {
  assert.equal(isMobileWeb('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/126 Mobile'), true);
  assert.equal(isMobileWeb('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), true);
  assert.equal(isMobileWeb('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Chrome/126'), false);
  assert.equal(isMobileWeb(undefined), false);
});

test('one line plays at a time: tapping the playing line stops it', () => {
  const first = toggleSpeechTarget(null, 'msg-2');
  assert.deepEqual(first, { action: 'speak', next: 'msg-2' });

  const same = toggleSpeechTarget('msg-2', 'msg-2');
  assert.deepEqual(same, { action: 'stop', next: null }, 'second tap stops instead of restarting');

  const other = toggleSpeechTarget('msg-2', 'msg-5');
  assert.deepEqual(other, { action: 'speak', next: 'msg-5' }, 'another line replaces the current one');
  assert.equal(other.next === 'msg-2', false, 'the old key is never left active');
});

test('playback speed is a multiplier with hard sanity bounds', () => {
  assert.equal(scaleSpeechRate(1, 'normal'), 1);
  assert.equal(scaleSpeechRate(0.55, 'normal'), 0.55);
  assert.ok(scaleSpeechRate(1, 'slow') < 1);
  assert.ok(scaleSpeechRate(1, 'fast') > 1);
  // "Slow" must stay slower than "normal" for every base rate, and the result
  // can never leave the range a speech engine accepts.
  assert.ok(scaleSpeechRate(0.55, 'slow') < scaleSpeechRate(0.55, 'normal'));
  assert.ok(scaleSpeechRate(2, 'fast') <= 2);
  assert.ok(scaleSpeechRate(0.05, 'slow') >= 0.1);
});
