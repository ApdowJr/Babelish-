/**
 * Neon backend configuration for the app.
 *
 * These EXPO_PUBLIC_* values are mirrors of the branch's Managed Auth URL and
 * the `api` Function URL (both pulled into .env.local by `neon deploy`).
 * When they are absent the app keeps its previous behavior: Supabase auth if
 * configured, otherwise clearly-labeled demo mode.
 */

const AUTH_URL = process.env.EXPO_PUBLIC_NEON_AUTH_BASE_URL?.replace(/\/+$/, '');
const API_URL = process.env.EXPO_PUBLIC_NEON_FUNCTION_API_URL?.replace(/\/+$/, '');

export const isNeonConfigured = Boolean(AUTH_URL && API_URL);

export const NEON_AUTH_URL = AUTH_URL ?? '';
export const NEON_API_URL = API_URL ?? '';

/**
 * Canonical app origin, registered as a trusted domain on the branch
 * (`neon neon-auth domain add https://nativa.app`). Managed Auth validates the
 * Origin header on auth requests (CSRF protection); the native app has no real
 * origin, so it always sends this one.
 */
export const NEON_TRUSTED_ORIGIN = process.env.EXPO_PUBLIC_NEON_ORIGIN ?? 'https://nativa.app';
