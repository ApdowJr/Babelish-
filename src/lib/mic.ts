/**
 * Microphone failure messages — pure, testable, and platform-aware.
 *
 * Why this exists: expo-audio's web implementation wraps `getUserMedia` in a
 * try/catch and returns `granted: false` for *every* failure. That turned four
 * very different problems (permission denied, an embedded frame with no mic
 * policy, no input device, an insecure origin) into one sentence telling the
 * learner to "enable it in Settings" — a setting a browser tab does not have,
 * and one an iframe cannot grant. This module keeps the real reason and says
 * something the learner can actually act on.
 */

export type MicFailureReason =
  | 'denied'
  | 'iframe'
  | 'nodevice'
  | 'busy'
  | 'insecure'
  | 'unsupported'
  | 'error';

export type MicResult =
  | { ok: true }
  | { ok: false; reason: MicFailureReason; message: string; canOpenSettings: boolean };

export type MicContext = {
  platform: 'web' | 'native';
  /** Web only: the page is inside an iframe (mic is gated by Permissions-Policy). */
  iframe: boolean;
  /** Web only: `window.isSecureContext` — getUserMedia needs HTTPS or localhost. */
  secure: boolean;
};

/** Maps a DOMException name (or none) to the sentence shown next to the mic. */
export function describeMicFailure(
  errorName: string | undefined,
  ctx: MicContext
): { reason: MicFailureReason; message: string; canOpenSettings: boolean } {
  if (ctx.platform === 'web') {
    const denied = errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError';
    if (ctx.iframe && (denied || errorName === 'SecurityError')) {
      return {
        reason: 'iframe',
        message:
          'This embedded preview can’t use the microphone. Open Babelish in its own browser tab, then tap the mic again.',
        canOpenSettings: false,
      };
    }
    // An insecure origin throws the same NotAllowedError as a denial, so the
    // origin is checked first: telling someone to "allow the mic" on an http
    // page would never work.
    if (!ctx.secure) {
      return {
        reason: 'insecure',
        message:
          'Browsers only allow the microphone on HTTPS (or localhost). Open Babelish over a secure address and try again.',
        canOpenSettings: false,
      };
    }
    if (denied) {
      return {
        reason: 'denied',
        message:
          'Your browser blocked the microphone for this site. Tap the lock icon next to the address, set Microphone to “Allow”, then try again.',
        canOpenSettings: false,
      };
    }
    if (
      errorName === 'NotFoundError' ||
      errorName === 'DevicesNotFoundError' ||
      errorName === 'OverconstrainedError'
    ) {
      return {
        reason: 'nodevice',
        message: 'No microphone was found. Connect one (or pick another input), then try again.',
        canOpenSettings: false,
      };
    }
    if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
      return {
        reason: 'busy',
        message: 'The microphone is busy in another tab or app. Close it and try again.',
        canOpenSettings: false,
      };
    }
    return {
      reason: 'unsupported',
      message: 'This browser can’t record audio — type your reply instead.',
      canOpenSettings: false,
    };
  }

  // Native: the OS permission dialog is the only place to change this, so the
  // button that opens it is genuinely useful.
  return {
    reason: 'denied',
    message:
      'Microphone access is off for Babelish. Turn on Microphone in the app’s system settings, then tap the mic again.',
    canOpenSettings: true,
  };
}

/** True when the current page is framed (embeds block mic by default). */
export function isFramed(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    // Cross-origin access to `top` throws — which can only happen in a frame.
    return true;
  }
}
