/**
 * Neon backend configuration for the app.
 *
 * The two endpoints below are **public service URLs, not secrets** (the auth
 * server and the API Function base; neither carries a key). They are baked in
 * as production defaults so every build — the Vercel web preview, an EAS
 * binary, a fresh clone with no `.env.local` — talks to the real backend
 * instead of silently degrading into on-device demo mode. This was the root
 * cause of the live site showing "Demo mode" while a real branch existed:
 * `EXPO_PUBLIC_*` values only exist if the *build* environment defines them.
 *
 * Any `EXPO_PUBLIC_NEON_*` value overrides the default (forks, staging
 * branches). Set `EXPO_PUBLIC_NEON_DISABLED=1` to force demo mode on purpose
 * (offline development, screenshots of the empty state).
 */

const PROD_AUTH_URL =
  'https://ep-autumn-glitter-b4h7bd4f.neonauth.c-6.us-east-2.aws.neon.tech/neondb/auth';
const PROD_API_URL = 'https://br-plain-block-b4zq4uge-api.compute.c-6.us-east-2.aws.neon.tech';

const disabled = process.env.EXPO_PUBLIC_NEON_DISABLED === '1';

const AUTH_URL = (
  process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL || PROD_AUTH_URL
).replace(/\/+$/, '');
const API_URL = (
  process.env.EXPO_PUBLIC_NEON_FUNCTION_API_URL || PROD_API_URL
).replace(/\/+$/, '');

export const isNeonConfigured = !disabled && Boolean(AUTH_URL && API_URL);

export const NEON_AUTH_URL = disabled ? '' : AUTH_URL;
export const NEON_API_URL = disabled ? '' : API_URL;

/**
 * Canonical app origin, registered as a trusted domain on the production
 * branch. Managed Auth validates the Origin header on auth requests (CSRF
 * protection); the native app has no real origin, so it sends this one.
 * Browser requests send their own Origin header, so the deployed web origin
 * must also be registered as a trusted domain.
 */
export const NEON_TRUSTED_ORIGIN =
  process.env.EXPO_PUBLIC_NEON_ORIGIN ?? 'https://babelish.vercel.app';
