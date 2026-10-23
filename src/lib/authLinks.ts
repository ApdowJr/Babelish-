/**
 * Pure helpers for Supabase Auth deep links, password recovery callbacks,
 * and root navigation guards. Zero React / Expo imports so every edge case is
 * covered by Node unit tests.
 */

export type SupportedEmailOtpType =
  | 'signup'
  | 'invite'
  | 'magiclink'
  | 'recovery'
  | 'email_change'
  | 'email';

export type ParsedAuthCallback = {
  accessToken: string | null;
  refreshToken: string | null;
  code: string | null;
  tokenHash: string | null;
  legacyToken: string | null;
  otpType: SupportedEmailOtpType | null;
  isRecovery: boolean;
  hasAuthPayload: boolean;
  errorDescription: string | null;
};

const OTP_TYPES = new Set<SupportedEmailOtpType>([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function parseParamMap(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  const cleaned = raw.replace(/^[?#]/, '').trim();
  if (!cleaned) return map;
  const params = new URLSearchParams(cleaned);
  for (const [key, value] of params.entries()) {
    if (value.trim()) map.set(key, value.trim());
  }
  return map;
}

/**
 * Parses any Supabase Auth redirect URL (Android `babelish://...` custom
 * scheme or Web `https://...` URL) across implicit (`#access_token=...`),
 * PKCE (`?code=...`), token-hash (`?token_hash=...&type=recovery`), and legacy
 * (`?token=...`) formats.
 */
export function parseAuthCallbackUrl(rawUrl: string | null | undefined): ParsedAuthCallback {
  const empty: ParsedAuthCallback = {
    accessToken: null,
    refreshToken: null,
    code: null,
    tokenHash: null,
    legacyToken: null,
    otpType: null,
    isRecovery: false,
    hasAuthPayload: false,
    errorDescription: null,
  };
  const trimmed = (rawUrl ?? '').trim();
  if (!trimmed) return empty;

  let pathname = '';
  let search = '';
  let hash = '';
  try {
    const parsed = new URL(trimmed);
    pathname = parsed.pathname || '';
    search = parsed.search || '';
    hash = parsed.hash || '';
    // Custom scheme URLs like `babelish://reset-password` put `reset-password` in host.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:' && parsed.host) {
      pathname = `/${parsed.host}${pathname}`;
    }
  } catch {
    return empty;
  }

  const queryParams = parseParamMap(search);
  const hashParams = parseParamMap(hash);
  const get = (key: string): string | null => hashParams.get(key) ?? queryParams.get(key) ?? null;

  const accessToken = get('access_token');
  const refreshToken = get('refresh_token');
  const code = get('code');
  const tokenHash = get('token_hash');
  const legacyToken = get('token');
  const rawType = get('type');
  const otpType =
    rawType && OTP_TYPES.has(rawType as SupportedEmailOtpType)
      ? (rawType as SupportedEmailOtpType)
      : null;
  const errorDescription = get('error_description') ?? get('error');

  const pathIndicatesReset = /(?:^|\/)reset-password(?:\/|$)/i.test(pathname);
  const hasAuthPayload = Boolean(
    (accessToken && refreshToken) || code || (tokenHash && otpType) || legacyToken
  );
  const isRecovery =
    otpType === 'recovery' || (pathIndicatesReset && Boolean(hasAuthPayload || errorDescription));

  return {
    accessToken,
    refreshToken,
    code,
    tokenHash,
    legacyToken,
    otpType,
    isRecovery,
    hasAuthPayload,
    errorDescription,
  };
}

export type RootGuardInput = {
  signedIn: boolean;
  onboarded: boolean;
  isPasswordRecovery: boolean;
  segments: readonly string[];
};

/**
 * Public legal routes (`/privacy` and `/terms`) must ALWAYS be reachable:
 * - when signed out (Google Play / App Store policy URLs & sign-up links),
 * - during onboarding (the consent links at the bottom of `onboarding.tsx`),
 * - and when signed in (from `Settings`).
 *
 * Likewise, an active password-recovery session (`signedIn && isPasswordRecovery`)
 * must stay on `/reset-password` instead of being bounced to `/` before the
 * learner chooses their new password.
 */
export function resolveRootRedirect(
  input: RootGuardInput
): '/login' | '/onboarding' | '/reset-password' | '/' | null {
  const top = input.segments[0] ?? '';
  const second = input.segments[1] ?? '';
  const inAuthGroup = top === '(auth)';
  const inOnboarding = top === 'onboarding';
  const inPublicLegal = top === 'privacy' || top === 'terms';
  const inResetPassword =
    (inAuthGroup && second === 'reset-password') || top === 'reset-password';

  if (inPublicLegal) return null;

  if (input.isPasswordRecovery) {
    return inResetPassword ? null : '/reset-password';
  }

  if (!input.signedIn) {
    return inAuthGroup ? null : '/login';
  }

  if (!input.onboarded) {
    return inOnboarding ? null : '/onboarding';
  }

  if (inAuthGroup || inOnboarding) {
    return '/';
  }

  return null;
}
