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
  speechErrorMessage,
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
