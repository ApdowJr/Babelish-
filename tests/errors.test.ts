/**
 * Crash-copy and redaction tests.
 *
 * The crash screen is the one place guaranteed to run after something has gone
 * wrong — including after an auth or provider error. Its detail line must be
 * short and must never print a credential.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeCrash, errorDetail, redactSecrets } from '../src/lib/errors';

test('the copy promises that finished work is safe', () => {
  const copy = describeCrash(new Error('boom'));
  assert.match(copy.title, /problem/i);
  assert.match(copy.body, /saved/i);
  assert.match(copy.body, /nothing you completed is lost/i);
  assert.doesNotMatch(copy.body, /reinstall|clear data|storage/i);
});

test('a detail line is short and never a stack trace', () => {
  const detail = errorDetail(new Error(`Request failed\n    at fetch (/app/index.js:1:2)\n${'x'.repeat(900)}`));
  assert.ok(detail.length <= 160);
  assert.doesNotMatch(detail, /\n/);
});

test('junk values produce no detail instead of "undefined"', () => {
  assert.equal(errorDetail(null), '');
  assert.equal(errorDetail(undefined), '');
  assert.equal(errorDetail(''), '');
  assert.equal(errorDetail({}), '');
  assert.equal(errorDetail({ message: 'permission denied' }), 'permission denied');
  assert.equal(errorDetail('plain string'), 'plain string');
});

test('provider keys, bearer headers and JWTs are redacted', () => {
  const key = 'sk-or-v1-5c56a1b2c3d4e5f60718293a4b5c6d7e8f90123';
  assert.doesNotMatch(redactSecrets(`bad key ${key}`), /sk-or-v1/);
  assert.match(redactSecrets(`bad key ${key}`), /\[redacted\]/);

  assert.doesNotMatch(redactSecrets('Authorization: Bearer abcdef1234567890xyz'), /abcdef1234567890xyz/);
  const jwt =
    'eyJhbGciOiJFZERTQSJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImV4cCI6OTk5OTk5OTk5OX0.c2lnbmF0dXJlLXZhbHVl';
  assert.doesNotMatch(redactSecrets(`token ${jwt}`), /eyJhbGci/);

  const opaque = 'a'.repeat(48);
  assert.doesNotMatch(redactSecrets(`session ${opaque}`), new RegExp(opaque));
});

test('ordinary text survives redaction unchanged', () => {
  const sentence = 'The tutor server answered HTTP 502 while replying in Spanish.';
  assert.equal(redactSecrets(sentence), sentence);
  // A normal word must not be mistaken for a key.
  assert.equal(redactSecrets('conversación'), 'conversación');
});
