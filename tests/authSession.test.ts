/**
 * Session rules for Managed Auth (Phase K — the "Wrong email or password" bug).
 *
 * Root cause these guard: the client treated "I could not read the session
 * cookie" as "the server rejected you". On web the browser *never* exposes
 * `Set-Cookie`, so a perfectly good sign-in threw the credential error — and,
 * because the fetch omitted `credentials: 'include'`, no session was ever
 * established in the browser at all.
 *
 * If someone re-couples "no cookie" to "bad password", this file goes red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_COOKIE,
  WEB_SESSION_BLOCKED,
  classifyAuthResponse,
  mapAuthErrorCode,
  sessionCookieFromHeaders,
  sessionTransportFor,
} from '../src/lib/authSession';

const SESSION_HEADER =
  `${SESSION_COOKIE}=PCRchxYymaXadP5wzkmLczEx8fO4Wwc3.YzWVAmiSP%2FVJ%2BACzpJ1ifuyy6HrcNb%2F1IQCvY2hpy4o%3D; ` +
  'Max-Age=604800; Path=/; HttpOnly; Secure; SameSite=None; Partitioned';

test('web keeps the session in the browser jar; native in a cookie header', () => {
  assert.equal(sessionTransportFor(true), 'browser-cookie-jar');
  assert.equal(sessionTransportFor(false), 'cookie-header');
});

test('native: the signed session cookie is captured and its attributes dropped', () => {
  const cookie = sessionCookieFromHeaders({
    getSetCookie: () => [SESSION_HEADER],
    get: () => null,
  });
  assert.equal(cookie, SESSION_HEADER.split(';')[0]);
  assert.ok(cookie && cookie.startsWith(`${SESSION_COOKIE}=`));
  assert.ok(!cookie.includes('HttpOnly'), 'attributes must not be replayed');
});

test('native: a single set-cookie header works too (react-native fetch)', () => {
  const cookie = sessionCookieFromHeaders({ get: () => SESSION_HEADER });
  assert.equal(cookie, SESSION_HEADER.split(';')[0]);
});

test('web: an unreadable Set-Cookie is null, not an error', () => {
  // Exactly what a browser returns: the header is filtered out entirely.
  assert.equal(sessionCookieFromHeaders({ getSetCookie: () => [], get: () => null }), null);
  assert.equal(sessionCookieFromHeaders(null), null);
  assert.equal(sessionCookieFromHeaders(undefined), null);
});

test('unrelated cookies are ignored', () => {
  const cookie = sessionCookieFromHeaders({
    getSetCookie: () => ['theme=dark; Path=/', 'consent=1; Path=/'],
  });
  assert.equal(cookie, null);
});

test('a 200 with a user is a SUCCESS even when no cookie is readable', () => {
  // The regression: this used to throw the "wrong password" error on web.
  assert.equal(classifyAuthResponse(200, true), 'ok');
});

test('only 401/403 count as a credential rejection', () => {
  assert.equal(classifyAuthResponse(401, false), 'rejected-credentials');
  assert.equal(classifyAuthResponse(403, false), 'rejected-credentials');
  assert.equal(classifyAuthResponse(400, false), 'server-error');
  assert.equal(classifyAuthResponse(500, false), 'server-error');
  assert.equal(classifyAuthResponse(200, false), 'server-error');
});

test('credential errors stay meaningful and point at recovery', () => {
  const message = mapAuthErrorCode({
    code: 'INVALID_EMAIL_OR_PASSWORD',
    message: 'Invalid email or password',
  });
  assert.match(message, /Wrong email or password/);
  assert.match(message, /Forgot password/, 'must offer the way out, not a dead end');
});

test('every known provider error maps to plain language', () => {
  assert.match(mapAuthErrorCode({ code: 'USER_ALREADY_EXISTS' }), /already has an account/);
  assert.match(mapAuthErrorCode({ code: 'INVALID_EMAIL' }), /doesn’t look right/);
  assert.match(mapAuthErrorCode({ code: 'WEAK_PASSWORD' }), /at least 8 characters/);
  assert.match(mapAuthErrorCode({ code: 'RATE_LIMITED' }), /Too many attempts/);
  assert.match(mapAuthErrorCode({ message: 'You already have an account' }), /already has an account/);
  assert.equal(mapAuthErrorCode({ message: 'odd but explicit' }), 'odd but explicit');
  assert.equal(mapAuthErrorCode(null, 'fallback text'), 'fallback text');
});

test('the blocked-cookie message names the cause and the fix', () => {
  assert.match(WEB_SESSION_BLOCKED, /browser blocked the session cookie/);
  assert.match(WEB_SESSION_BLOCKED, /Allow cookies/);
});
