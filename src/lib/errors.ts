/**
 * Crash copy and detail redaction — pure, so it can be tested in Node.
 *
 * An unexpected render error must not leave a learner staring at a white
 * screen, and it must not leak anything either: error messages from fetch/
 * auth layers can carry a token or a full URL. The boundary renders the copy
 * below and shows a short, redacted detail line.
 *
 * What it deliberately does NOT do: clear storage, reset progress or sign the
 * learner out. Progress and review are written after every lesson, so a crash
 * loses at most the screen — never the work.
 */

export type CrashCopy = {
  title: string;
  body: string;
  /** One short line of context, secrets removed. Empty when unhelpful. */
  detail: string;
};

const TOKEN_PATTERNS: RegExp[] = [
  /\bsk-[A-Za-z0-9_-]{8,}\b/g, // provider keys
  /\bBearer\s+[A-Za-z0-9._-]{8,}/gi, // authorization headers
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\b/g, // JWTs
  /\b[A-Za-z0-9_-]{32,}\b/g, // opaque API keys / session ids
];

/** Removes credentials and collapses whitespace. */
export function redactSecrets(value: string): string {
  let text = value;
  for (const pattern of TOKEN_PATTERNS) text = text.replace(pattern, '[redacted]');
  return text.replace(/\s+/g, ' ').trim();
}

/** A short, safe detail line from whatever was thrown. */
export function errorDetail(error: unknown, max = 160): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : error && typeof error === 'object' && 'message' in error
          ? String((error as { message: unknown }).message ?? '')
          : '';
  const clean = redactSecrets(raw);
  if (!clean) return '';
  // Never show a stack frame or a multi-paragraph dump.
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * The text a learner sees. The second line is the important one: it tells them
 * their work is safe, and that the fix is a retry — not a reinstall.
 */
export function describeCrash(error: unknown): CrashCopy {
  return {
    title: 'This screen hit a problem',
    body:
      'Your lessons, reviews and streak are saved after every one you finish, so nothing you completed is lost. Retry this screen, or go back to Learn and carry on.',
    detail: errorDetail(error),
  };
}
