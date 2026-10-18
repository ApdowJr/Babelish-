import AsyncStorage from '@react-native-async-storage/async-storage';
import { NEON_AUTH_URL, NEON_TRUSTED_ORIGIN } from '@/lib/neon';

/**
 * Managed Better Auth client for React Native.
 *
 * The Managed Auth server issues a signed session cookie; the sign-up/sign-in
 * responses also carry the raw session token and user object in JSON. We store
 * the signed cookie value (captured from Set-Cookie — React Native's fetch
 * exposes it, unlike browsers' HttpOnly rule) and reuse it for session restore
 * (`GET /get-session`) and JWT minting (`GET /token`, 15-minute EdDSA JWT the
 * Neon Function verifies against the branch JWKS).
 */

const COOKIE_NAME = '__Secure-neon-auth.session_token';
const SESSION_KEY = 'nativa:neon-session';

export type NeonUser = { id: string; email: string; name: string };
type StoredSession = { cookie: string; user: NeonUser };

/** React Native and Node expose Set-Cookie differently; handle both. */
function cookieFromResponse(res: Response): string | null {
  const headers = res.headers as unknown as {
    getSetCookie?: () => string[];
    get?: (name: string) => string | null;
  };
  const candidates: string[] = [];
  if (typeof headers.getSetCookie === 'function') candidates.push(...headers.getSetCookie());
  const single = headers.get?.('set-cookie');
  if (single) candidates.push(single);
  const match = candidates.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return match ? match.split(';')[0] : null;
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: unknown; cookie?: string } = {}
): Promise<{ status: number; json: T | null; setCookie: string | null }> {
  const headers: Record<string, string> = { Origin: NEON_TRUSTED_ORIGIN };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  if (opts.cookie) headers.Cookie = opts.cookie;

  const res = await fetch(`${NEON_AUTH_URL}${path}`, {
    method: opts.method ?? 'POST',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as T) : null;
  return { status: res.status, json, setCookie: cookieFromResponse(res) };
}

/** Turns Managed Auth error payloads into something a human wants to read. */
function neonError(json: { message?: string; code?: string } | null, fallback: string): Error {
  const code = json?.code ?? '';
  const message = json?.message ?? fallback;
  if (code === 'INVALID_EMAIL_OR_PASSWORD') return new Error('Wrong email or password. Give it another try.');
  if (code === 'USER_ALREADY_EXISTS' || message.toLowerCase().includes('already'))
    return new Error('This email already has an account. Try signing in instead.');
  if (code === 'INVALID_EMAIL' || code === 'EMAIL_INVALID') return new Error('That email address doesn’t look right.');
  if (code === 'WEAK_PASSWORD') return new Error('Password must be at least 8 characters.');
  if (code === 'RATE_LIMITED') return new Error('Too many attempts — wait a minute and try again.');
  return new Error(message);
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

type AuthResponseBody = {
  token?: string;
  user?: { id?: string; email?: string; name?: string };
  message?: string;
  code?: string;
};

function userFrom(json: AuthResponseBody | null): NeonUser | null {
  if (!json?.user?.id) return null;
  return {
    id: json.user.id,
    email: json.user.email ?? '',
    name: json.user.name ?? (json.user.email ?? '').split('@')[0],
  };
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
  const user = userFrom(json);
  if (status !== 200 || !user || !setCookie) throw neonError(json, 'Could not create the account.');
  await storeSession({ cookie: setCookie, user });
  return user;
}

/** Signs in and stores the session. */
export async function neonSignIn(email: string, password: string): Promise<NeonUser> {
  const { status, json, setCookie } = await request<AuthResponseBody>('/sign-in/email', {
    body: { email, password },
  });
  const user = userFrom(json);
  if (status !== 200 || !user || !setCookie) throw neonError(json, 'Could not sign in.');
  await storeSession({ cookie: setCookie, user });
  return user;
}

/** Restores the stored session against the server. Clears it when invalid. */
export async function neonGetSession(): Promise<NeonUser | null> {
  const stored = await loadStoredSession();
  if (!stored) return null;
  const { status, json } = await request<{ user?: { id?: string } }>('/get-session', {
    method: 'GET',
    cookie: stored.cookie,
  });
  const body = json as { user?: { id?: string } } | null;
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

export async function neonSignOut(): Promise<void> {
  const stored = await loadStoredSession();
  await storeSession(null);
  if (!stored) return;
  await request('/sign-out', { method: 'POST', cookie: stored.cookie }).catch(() => undefined);
}

/** Sends a password-reset email through the branch's shared SMTP. */
export async function neonRequestPasswordReset(email: string): Promise<void> {
  const { status, json } = await request<{ message?: string; code?: string }>(
    '/request-password-reset',
    {
      body: { email, callbackURL: NEON_TRUSTED_ORIGIN },
    }
  );
  if (status !== 200) throw neonError(json, 'Could not send the reset email.');
}
