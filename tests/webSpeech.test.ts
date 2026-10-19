/**
 * Web-speech fallback tests.
 *
 * Root cause these guard: on a deployment with no AI provider key the mic used
 * to be dead — the learner was told "type your reply instead" even on browsers
 * that ship a perfectly good speech recogniser. The fallback must only ever
 * engage when a REAL recogniser exists; if `isWebSpeechSupported()` lied and
 * returned true without one, the mic would start a session that can never
 * produce a transcript and the learner gets a silent dead tap — the exact
 * failure mode this codebase's audits exist to prevent.
 *
 * Under plain node there is no `window`, so these assert the honest
 * "unsupported" path. The supported path needs a browser and is covered by
 * docs/DEVICE_TEST_PLAN.md.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWebSpeechSupported, startWebSpeech } from '../src/lib/webSpeech';

test('no window means no recogniser — never claim support we do not have', () => {
  assert.equal(typeof window, 'undefined', 'sanity: node has no window');
  assert.equal(isWebSpeechSupported(), false);
});

test('startWebSpeech returns null instead of a session that cannot transcribe', () => {
  assert.equal(startWebSpeech('es-ES'), null);
  assert.equal(startWebSpeech('es-ES', () => {}), null);
});

test('a fake recogniser on window IS detected (support is capability-driven)', () => {
  // Prove the check reads the real global rather than hardcoding false: with a
  // constructor present (as Chrome/Edge provide), support must flip to true.
  class FakeRecognition {
    lang = '';
    continuous = false;
    interimResults = false;
    maxAlternatives = 1;
    onresult = null;
    onerror = null;
    onend = null;
    start() {}
    stop() {}
    abort() {}
  }
  const g = globalThis as unknown as { window?: unknown };
  g.window = { SpeechRecognition: FakeRecognition };
  try {
    assert.equal(isWebSpeechSupported(), true);
    const session = startWebSpeech('ja-JP');
    assert.notEqual(session, null, 'a supported runtime must yield a session');
    session?.cancel();
  } finally {
    delete g.window;
  }
  assert.equal(isWebSpeechSupported(), false, 'support disappears with the global');
});
