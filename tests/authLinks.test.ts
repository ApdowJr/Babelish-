import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAuthCallbackUrl, resolveRootRedirect } from '../src/lib/authLinks';

test('parseAuthCallbackUrl extracts implicit hash recovery tokens', () => {
  const parsed = parseAuthCallbackUrl(
    'https://babelish-ururka-lp.vercel.app/(auth)/reset-password#access_token=at_123&refresh_token=rt_456&type=recovery'
  );
  assert.equal(parsed.accessToken, 'at_123');
  assert.equal(parsed.refreshToken, 'rt_456');
  assert.equal(parsed.isRecovery, true);
  assert.equal(parsed.hasAuthPayload, true);
});

test('parseAuthCallbackUrl extracts PKCE auth code and detects custom-scheme reset-password path', () => {
  const parsed = parseAuthCallbackUrl('babelish://reset-password?code=pkce_code_99');
  assert.equal(parsed.code, 'pkce_code_99');
  assert.equal(parsed.isRecovery, true);
  assert.equal(parsed.hasAuthPayload, true);
});

test('parseAuthCallbackUrl extracts OTP token_hash for recovery and signup', () => {
  const recovery = parseAuthCallbackUrl(
    'zelvoca://reset-password?token_hash=th_abc&type=recovery'
  );
  assert.equal(recovery.tokenHash, 'th_abc');
  assert.equal(recovery.otpType, 'recovery');
  assert.equal(recovery.isRecovery, true);
  assert.equal(recovery.hasAuthPayload, true);

  const signup = parseAuthCallbackUrl(
    'https://babelish-ururka-lp.vercel.app/login?token_hash=th_signup&type=signup'
  );
  assert.equal(signup.tokenHash, 'th_signup');
  assert.equal(signup.otpType, 'signup');
  assert.equal(signup.isRecovery, false);
  assert.equal(signup.hasAuthPayload, true);
});

test('parseAuthCallbackUrl ignores ordinary navigation URLs', () => {
  const plain = parseAuthCallbackUrl('https://babelish-ururka-lp.vercel.app/privacy');
  assert.equal(plain.hasAuthPayload, false);
  assert.equal(plain.isRecovery, false);
});

test('resolveRootRedirect keeps /privacy and /terms public while signed out', () => {
  assert.equal(
    resolveRootRedirect({
      signedIn: false,
      isPasswordRecovery: false,
      onboarded: false,
      segments: ['privacy'],
    }),
    null
  );
  assert.equal(
    resolveRootRedirect({
      signedIn: false,
      isPasswordRecovery: false,
      onboarded: false,
      segments: ['terms'],
    }),
    null
  );
  assert.equal(
    resolveRootRedirect({
      signedIn: false,
      isPasswordRecovery: false,
      onboarded: false,
      segments: ['(tabs)', 'speak'],
    }),
    '/login'
  );
});

test('resolveRootRedirect pins recovery sessions onto /reset-password until saved', () => {
  assert.equal(
    resolveRootRedirect({
      signedIn: true,
      isPasswordRecovery: true,
      onboarded: true,
      segments: ['(tabs)'],
    }),
    '/reset-password'
  );
  assert.equal(
    resolveRootRedirect({
      signedIn: true,
      isPasswordRecovery: true,
      onboarded: true,
      segments: ['(auth)', 'reset-password'],
    }),
    null
  );
});

test('resolveRootRedirect routes normal signed-in sessions through onboarding first', () => {
  assert.equal(
    resolveRootRedirect({
      signedIn: true,
      isPasswordRecovery: false,
      onboarded: false,
      segments: ['(auth)', 'login'],
    }),
    '/onboarding'
  );
  assert.equal(
    resolveRootRedirect({
      signedIn: true,
      isPasswordRecovery: false,
      onboarded: true,
      segments: ['(auth)', 'login'],
    }),
    '/'
  );
});
