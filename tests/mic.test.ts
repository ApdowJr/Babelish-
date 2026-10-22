/**
 * Microphone failure copy — the reason the bug existed.
 *
 * expo-audio's web path reports every getUserMedia failure as
 * `granted: false`, which the app used to turn into "enable it in Settings" —
 * useless in a browser and impossible inside a preview iframe. These tests pin
 * the actionable copy for each real cause.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeMicFailure } from '../src/lib/mic';

const web = { platform: 'web' as const, iframe: false, secure: true };
const native = { platform: 'native' as const, iframe: false, secure: true };

test('a framed preview gets frame-specific advice, not a settings dead end', () => {
  const framed = { ...web, iframe: true };
  const denied = describeMicFailure('NotAllowedError', framed);
  assert.equal(denied.reason, 'iframe');
  assert.match(denied.message, /own browser tab/i);
  assert.equal(denied.canOpenSettings, false);

  const blocked = describeMicFailure('SecurityError', framed);
  assert.equal(blocked.reason, 'iframe');
});

test('browser denial explains the address-bar control', () => {
  const failure = describeMicFailure('NotAllowedError', web);
  assert.equal(failure.reason, 'denied');
  assert.match(failure.message, /lock icon/i);
  assert.match(failure.message, /allow/i);
  // A web page cannot open the OS settings sheet.
  assert.equal(failure.canOpenSettings, false);
  assert.doesNotMatch(failure.message, /app.s system settings/i);
});

test('native denial offers the system settings action', () => {
  const failure = describeMicFailure('NotAllowedError', native);
  assert.equal(failure.reason, 'denied');
  assert.equal(failure.canOpenSettings, true);
  assert.match(failure.message, /microphone/i);
});

test('missing device and busy device are told apart', () => {
  const missing = describeMicFailure('NotFoundError', web);
  assert.equal(missing.reason, 'nodevice');
  assert.match(missing.message, /no microphone/i);

  const busy = describeMicFailure('NotReadableError', web);
  assert.equal(busy.reason, 'busy');
  assert.match(busy.message, /busy/i);

  assert.equal(describeMicFailure('OverconstrainedError', web).reason, 'nodevice');
  assert.equal(describeMicFailure('TrackStartError', web).reason, 'busy');
});

test('insecure origins and unknown failures still say something useful', () => {
  const insecure = describeMicFailure('NotAllowedError', { ...web, secure: false });
  assert.equal(insecure.reason, 'insecure');
  assert.match(insecure.message, /https/i);

  const unknown = describeMicFailure('WeirdBrowserThing', web);
  assert.equal(unknown.reason, 'unsupported');
  assert.match(unknown.message, /type your reply/i);

  const noError = describeMicFailure(undefined, web);
  assert.ok(noError.message.length > 0);
  assert.equal(noError.canOpenSettings, false);
});
