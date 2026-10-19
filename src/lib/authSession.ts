/**
 * Pure session rules for Managed Auth — shared by the client and its tests.
 *
 * Why this module exists: a browser never exposes `Set-Cookie` to JavaScript and
 * refuses to let us set a `Cookie` request header, so the web client *cannot*
 * read or replay the session cookie the way React Native can. On web the browser
 * owns the cookie: we opt in with `credentials: 'include'` and confirm the
 * session with `GET /get-session`. React Native keeps the captured cookie and
 * replays it. The decision lives here so it is testable without an RN runtime.
 */

export const SESSION_COOKIE = '__Secure-neon-auth.session_token';

/** How this platform proves "I am still signed in". */
export type SessionTransport = 'cookie-header' | 'browser-cookie-jar';

export function sessionTransportFor(isWeb: boolean): SessionTransport {
  return isWeb ? 'browser-cookie-jar' : 'cookie-header';
}

type HeadersLike = {
  getSetCookie?: () => string[];
  get?: (name: string) => string | null;
};

/**
 * The signed session cookie from a response, without its attributes.
 *
 * Returns null on web: browsers filter `Set-Cookie` out of the Headers the page
 * can see, so a null here is expected and must NOT be treated as a failure.
 */
export function sessionCookieFromHeaders(headers: HeadersLike | null | undefined): string | null {
  if (!headers) return null;
  const candidates: string[] = [];
  if (typeof headers.getSetCookie === 'function') {
    candidates.push(...(headers.getSetCookie() ?? []));
  }
  const single = headers.get?.('set-cookie');
  if (single) candidates.push(single);
  const match = candidates.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  return match ? match.split(';')[0] : null;
}

export type AuthOutcome = 'ok' | 'rejected-credentials' | 'server-error';

/**
 * Classifies a sign-in/sign-up response. Kept separate from the transport logic
 * because "the server said no" and "the browser dropped the session" need very
 * different messages — conflating them is what made a successful web sign-in
 * look like a wrong password.
 */
export function classifyAuthResponse(status: number, hasUser: boolean): AuthOutcome {
  if (status === 200 && hasUser) return 'ok';
  if (status === 401 || status === 403) return 'rejected-credentials';
  return 'server-error';
}

type ErrorPayload = { message?: string; code?: string } | null | undefined;

const GENERIC = 'Something went wrong. Try again.';

/** Turns Managed Auth error payloads into something a human can act on. */
export function mapAuthErrorCode(json: ErrorPayload, fallback: string = GENERIC): string {
  const code = json?.code ?? '';
  const message = json?.message ?? fallback;
  switch (code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
      return 'Wrong email or password. Check it and try again — or tap “Forgot password?” to set a new one.';
    case 'USER_ALREADY_EXISTS':
      return 'This email already has an account. Try signing in instead.';
    case 'INVALID_EMAIL':
    case 'EMAIL_INVALID':
      return 'That email address doesn’t look right.';
    case 'WEAK_PASSWORD':
    case 'PASSWORD_TOO_SHORT':
      return 'Password must be at least 8 characters.';
    case 'RATE_LIMITED':
      return 'Too many attempts — wait a minute and try again.';
    case 'INVALID_TOKEN':
      return 'That reset link is invalid or has already been used. Request a new one.';
    case 'TOKEN_EXPIRED':
      return 'That reset link has expired. Request a new one.';
    default:
      break;
  }
  if (/already/i.test(message)) return 'This email already has an account. Try signing in instead.';
  return message;
}

/** Shown when the credentials were accepted but the browser kept no session. */
export const WEB_SESSION_BLOCKED =
  'Signed in, but this browser blocked the session cookie. Allow cookies for this site (or open the app in a new tab) and try again.';
