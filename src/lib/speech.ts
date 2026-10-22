/**
 * Speech-output helpers — pure, so the browser rules can be tested without a
 * DOM.
 *
 * Why a dedicated web path: expo-speech's web shim forwards `speechSynthesis`
 * errors verbatim, and Android Chrome reports perfectly normal events
 * (`interrupted`, `canceled` when a new utterance replaces an old one) as
 * failures. Learners saw "Speech playback failed — try again." for what was
 * actually a successful replacement. The rules below decide which errors are
 * worth showing, and pick the best installed voice for a locale.
 */

export type VoiceLike = {
  identifier?: string;
  language?: string;
  name?: string;
  localService?: boolean;
};

/**
 * Browsers expose `SpeechSynthesisVoice` as `{name, lang, localService}`, but
 * `matchVoice` works on `{identifier, language}`. Passing the raw objects
 * silently matched nothing (and produced a false "no voice installed" note),
 * so every call goes through this mapping.
 */
export function toVoiceLike(
  list: readonly { name?: string; lang?: string; localService?: boolean }[]
): VoiceLike[] {
  return list.map((voice) => ({
    identifier: voice.name,
    language: voice.lang,
    localService: voice.localService,
  }));
}

/** `en_US` / `EN-us` → `en-us`. */
export function normalizeLocale(tag: string | undefined): string {
  return (tag ?? '').trim().toLowerCase().replace(/_/g, '-');
}

/** `es-ES` → `es`. */
export function baseLanguage(tag: string | undefined): string {
  return normalizeLocale(tag).split('-')[0] ?? '';
}

/**
 * Picks the best installed voice for a locale:
 *   1. exact region match (`ar-EG`), preferring an offline voice;
 *   2. any voice of the same language (`ar-*`), preferring the requested
 *      region, then offline;
 *   3. null — the caller speaks with the default voice and says so once.
 */
export function matchVoice<T extends VoiceLike>(voices: readonly T[], locale: string): T | null {
  const wanted = normalizeLocale(locale);
  const base = baseLanguage(locale);
  if (!wanted) return null;

  const exact = voices.filter((voice) => normalizeLocale(voice.language) === wanted);
  if (exact.length > 0) {
    return exact.find((voice) => voice.localService !== false) ?? exact[0];
  }

  const family = voices.filter((voice) => baseLanguage(voice.language) === base);
  if (family.length > 0) {
    return family.find((voice) => voice.localService !== false) ?? family[0];
  }
  return null;
}

/** Errors that mean "playback was replaced/stopped" — never worth a banner. */
const SILENT_ERRORS = new Set(['interrupted', 'canceled', 'cancelled', 'stop']);

/**
 * Maps a `SpeechSynthesisErrorEvent.error` code to a sentence a learner can
 * act on. Returns `null` when the event should be ignored.
 */
export function speechErrorMessage(code: string | undefined, locale: string): string | null {
  const normalized = (code ?? '').toLowerCase();
  if (SILENT_ERRORS.has(normalized)) return null;
  switch (normalized) {
    case 'not-allowed':
      return 'Your browser blocked audio for this page. Tap the lock icon, allow sound, then tap Listen again.';
    case 'audio-busy':
      return 'Another app is using the speaker. Close it and tap Listen again.';
    case 'audio-hardware':
      return 'No speaker was found on this device.';
    case 'language-unavailable':
    case 'voice-unavailable':
      return `This device has no ${locale} voice installed — the text is still there to read.`;
    case 'network':
      return 'The voice service needs a connection right now. Tap Listen again in a moment.';
    case 'synthesis-failed':
    case 'synthesis-unavailable':
      return 'Speech playback failed on this device — the text is still there to read.';
    default:
      return null;
  }
}

/** Android/Chrome garbage-collects utterances mid-speech unless referenced. */
const speakingUtterances = new Set<object>();

export function holdUtterance(utterance: object): void {
  speakingUtterances.add(utterance);
}

export function releaseUtterance(utterance: object): void {
  speakingUtterances.delete(utterance);
}

/** True when a browser is likely a phone (a 150 MB speech model is a bad offer). */
export function isMobileWeb(userAgent: string | undefined): boolean {
  return /android|iphone|ipad|ipod|mobile|opera mini/i.test(userAgent ?? '');
}

/**
 * What a second tap on the same line should do.
 *
 * One line plays at a time; tapping the playing line stops it, tapping any
 * other line replaces it. Kept pure so the "no overlapping audio" rule has a
 * test even though the player itself needs a device.
 */
export function toggleSpeechTarget(
  current: string | null,
  key: string
): { action: 'speak' | 'stop'; next: string | null } {
  return current === key ? { action: 'stop', next: null } : { action: 'speak', next: key };
}
