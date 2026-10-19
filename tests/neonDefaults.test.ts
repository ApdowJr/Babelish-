/**
 * Deployment-default tests for the backend endpoints baked into the bundle.
 *
 * Root cause these guard: the Vercel build once had no EXPO_PUBLIC_NEON_*
 * vars, so `isNeonConfigured` went false → the app presented demo mode (and
 * demo accounts) on a deployment that had a real backend behind it. The
 * endpoints are now compile-time defaults with env overrides; this file
 * fails if anyone quietly re-fragilizes that.
 *
 * Values asserted are PUBLIC service URLs (documented in .env.example) —
 * never secrets.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

type NeonModule = typeof import('../src/lib/neon');

function freshNeon(env: Record<string, string | undefined>): NeonModule {
  // Re-require with a clean module cache: neon.ts reads env at import time.
  const resolved = require.resolve('../src/lib/neon');
  delete require.cache[resolved];
  for (const key of [
    'EXPO_PUBLIC_NEON_AUTH_BASE_URL',
    'EXPO_PUBLIC_NEON_FUNCTION_API_URL',
    'EXPO_PUBLIC_NEON_ORIGIN',
    'EXPO_PUBLIC_NEON_DISABLED',
  ]) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('../src/lib/neon') as NeonModule;
}

test('production endpoints are compiled-in defaults — configured with zero env', () => {
  const neon = freshNeon({});
  assert.equal(neon.isNeonConfigured, true, 'a plain build must see the real backend');
  assert.match(neon.NEON_API_URL, /^https:\/\/.+\.neon\.tech$/, 'public Function URL');
  assert.match(neon.NEON_AUTH_URL, /^https:\/\/.+/, 'public Auth URL');
  assert.match(neon.NEON_AUTH_URL, /\/neondb\/auth$/, 'Managed Auth base path');
  assert.equal(neon.NEON_TRUSTED_ORIGIN, 'https://zelvoca.app');
});

test('env still overrides the defaults (staging branches, forks)', () => {
  const neon = freshNeon({
    EXPO_PUBLIC_NEON_FUNCTION_API_URL: 'https://branch-api.example.test',
    EXPO_PUBLIC_NEON_AUTH_BASE_URL: 'https://branch-auth.example.test/neondb/auth',
    EXPO_PUBLIC_NEON_ORIGIN: 'https://staging.example.test',
  });
  assert.equal(neon.NEON_API_URL, 'https://branch-api.example.test');
  assert.equal(neon.NEON_AUTH_URL, 'https://branch-auth.example.test/neondb/auth');
  assert.equal(neon.NEON_TRUSTED_ORIGIN, 'https://staging.example.test');
});

test('EXPO_PUBLIC_NEON_DISABLED=1 is the explicit demo-mode escape hatch', () => {
  const neon = freshNeon({ EXPO_PUBLIC_NEON_DISABLED: '1' });
  assert.equal(neon.isNeonConfigured, false);
  assert.equal(neon.NEON_API_URL, '', 'no endpoint claims when deliberately off');
  assert.equal(neon.NEON_AUTH_URL, '');
});
