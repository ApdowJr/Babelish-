import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { NEON_AUTH_URL, NEON_TRUSTED_ORIGIN } from '@/lib/neon';
import {
  classifyAuthResponse,
  jsonBodyFor,
  mapAuthErrorCode,
  sessionCookieFromHeaders,
  sessionTransportFor,
  WEB_SESSION_BLOCKED,
} from '@/lib/authSession';

/**
 * Managed Better Auth client for React Native + web.
 *
 * The Managed Auth server issues a signed, **HttpOnly** session cookie. The two
 * platforms reach that cookie differently, and mixing them up is what made a
 * successful web sign-in look like a rejected password:
 *
 *  • Native (iOS/Android): `Set-Cookie` is readable from the response, so we
 *    capture the signed cookie and replay it as a `Cookie` header on
 *    `/get-session` and `/token`.
 *  • Web: browsers forbid reading `Set-Cookie` and forbid setting `Cookie`.
 *    The browser's own cookie jar owns the session, which means every auth
 *    request must opt in with `credentials: 'include'`; after sign-in we confirm
 *    the session with `GET /get-session` instead of assuming failure.
 *
 * Either way, `/token` mints the 15-minute EdDSA JWT the Neon Function API
 * verifies against the branch JWKS — the app never sends the session cookie to
 * the API itself.
 */

const IS_WEB = Platform.OS === 'web';
const TRANSPORT = sessionTransportFor(IS_WEB);
const SESSION_KEY = 'zelvoca:neon-session';

export type NeonUser = { id: string; email: string; name: string };
/** `cookie` is absent on web — the browser's jar holds it, not us. */
type StoredSession = { user: NeonUser; cookie?: string };

type AuthResponseBody = {
  token?: string;
  user?: { id?: string; email?: string; name?: string };
  message?: string;
  code?: string;
};

/** React Native and Node expose Set-Cookie differently; web hides it entirely. */
function cookieFromResponse(res: Response): string | null {
  return sessionCookieFromHeaders(res.headers as unknown as Parameters<typeof sessionCookieFromHeaders>[0]);
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<{ status: number; json: T | null; setCookie: string | null }> {
  const method = String(opts.method ?? 'POST').toUpperCase();
  // Non-GET requests are always real JSON (`{}` when there is nothing to say),
  // otherwise Managed Auth answers 415 and the call silently does nothing.
  const payload = jsonBodyFor(method, opts.body);
  const headers: Record<string, string> = { Origin: NEON_TRUSTED_ORIGIN };
  if (payload !== undefined) headers['Content-Type'] = 'application/json';
  // Only native replays the cookie by hand; the browser attaches its own and
  // rejects a manually-set `Cookie` header anyway.
  if (opts.cookie && TRANSPORT === 'cookie-header') headers.Cookie = opts.cookie;

  const res = await fetch(`${NEON_AUTH_URL}${path}`, {
    method,
    headers,
    ...(IS_WEB ? { credentials: 'include' as RequestCredentials } : {}),
    body: payload,
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as T) : null;
  return { status: res.status, json, setCookie: cookieFromResponse(res) };
}

function neonError(json: AuthResponseBody | null, fallback: string): Error {
  return new Error(mapAuthErrorCode(json, fallback));
}

async function storeSession(session: StoredSession | null) {
  try {
    if (session) await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else await AsyncStorage.removeItem(SESSION_KEY);
  } catch {
    // non-fatal: worst case the user signs in again
  }
}

export async function loadStoredSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

function userFrom(json: AuthResponseBody | null): NeonUser | null {
  if (!json?.user?.id) return null;
  return {
    id: json.user.id,
    email: json.user.email ?? '',
    name: json.user.name ?? (json.user.email ?? '').split('@')[0],
  };
}

/** Asks the auth server who we are using the browser's own cookie jar. */
async function confirmBrowserSession(): Promise<NeonUser | null> {
  const { status, json } = await request<AuthResponseBody>('/get-session', { method: 'GET' });
  return status === 200 ? userFrom(json) : null;
}

/**
 * Persists a session returned by sign-up/sign-in.
 *
 * Native proves the session with the captured cookie. Web proves it by asking
 * the server again — a 200 with a user but no readable cookie is the *normal*
 * browser case, not a failure.
 */
async function adoptSession(
  status: number,
  json: AuthResponseBody | null,
  setCookie: string | null,
  fallback: string
): Promise<NeonUser> {
  const user = userFrom(json);
  const outcome = classifyAuthResponse(status, Boolean(user));
  if (outcome !== 'ok' || !user) throw neonError(json, fallback);

  if (TRANSPORT === 'cookie-header') {
    if (!setCookie) throw new Error('The auth server did not return a session — please try again.');
    await storeSession({ user, cookie: setCookie });
    return user;
  }

  const confirmed = await confirmBrowserSession();
  if (!confirmed) throw new Error(WEB_SESSION_BLOCKED);
  await storeSession({ user: confirmed });
  return confirmed;
}

/** Creates an account. Managed Auth returns a live session on success. */
export async function neonSignUp(params: {
  email: string;
  password: string;
  name: string;
}): Promise<NeonUser> {
  const { status, json, setCookie } = await request<AuthResponseBody>('/sign-up/email', {
    body: params,
  });
  return adoptSession(status, json, setCookie, 'Could not create the account.');
}

/** Signs in and stores the session. */
export async function neonSignIn(email: string, password: string): Promise<NeonUser> {
  const { status, json, setCookie } = await request<AuthResponseBody>('/sign-in/email', {
    body: { email, password },
  });
  return adoptSession(status, json, setCookie, 'Could not sign in.');
}

/** Restores the stored session against the server. Clears it when invalid. */
export async function neonGetSession(): Promise<NeonUser | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  const { status, json } = await request<AuthResponseBody>('/get-session', {
    method: 'GET',
    cookie: stored.cookie,
  });
  const body = json as AuthResponseBody | null;
  if (status !== 200 || !body?.user?.id) {
    await storeSession(null);
    return null;
  }
  return stored.user;
}

/** Mints a short-lived EdDSA JWT (≈15 min) for the Neon Function API. */
export async function neonGetJwt(): Promise<string | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  const { status, json } = await request<{ token?: string }>('/token', {
    method: 'GET',
    cookie: stored.cookie,
  });
  if (status !== 200 || !json?.token) return null;
  return json.token;
}

/**
 * Signs out. The local session is cleared first so the user always gets out;
 * the server is then asked to revoke the signed cookie (verified live: with the
 * JSON `{}` body the response is 200 and `/get-session` stops returning the
 * user — without it the server answers 415 and the session stayed alive).
 */
export async function neonSignOut(): Promise<void> {
  const stored = await loadStoredSession();
  await storeSession(null);
  if (!stored) return;
  await request('/sign-out', { method: 'POST', cookie: stored.cookie }).catch(() => undefined);
}

/**
 * Where a password-reset link should send the user back to.
 *
 * On web that is the origin they are actually using (the Vercel preview and
 * `zelvoca.app` are different sites); native has no real origin, so it uses the
 * branch's trusted domain.
 */
function resetCallbackOrigin(): string {
  if (IS_WEB && typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return NEON_TRUSTED_ORIGIN;
}

/** Sends a password-reset email through the branch's shared SMTP. */
export async function neonRequestPasswordReset(email: string): Promise<void> {
  const { status, json } = await request<AuthResponseBody>('/request-password-reset', {
    body: { email, callbackURL: resetCallbackOrigin() },
  });
  if (status !== 200) throw neonError(json, 'Could not send the reset email.');
}

/**
 * Completes a reset with the token from the email link.
 *
 * The email carries a one-time token; Managed Auth has no hosted reset page, so
 * the app must collect the new password itself (`/reset-password` screen).
 */
export async function neonResetPassword(token: string, newPassword: string): Promise<void> {
  const { status, json } = await request<AuthResponseBody>('/reset-password', {
    body: { newPassword, token },
  });
  if (status !== 200) throw neonError(json, 'Could not set the new password.');
}
