/**
 * Browser speech recognition — a real, key-free voice path for web.
 *
 * Why this exists: transcription normally goes through an OpenAI-compatible
 * endpoint (the backend proxy with a server-side key, or EXPO_PUBLIC_AI_*).
 * A deployment with neither — a fresh clone, a preview branch, offline dev —
 * could record audio but had nothing to transcribe it, so the mic was dead and
 * the learner was told to type. That is honest but needlessly limited: modern
 * browsers ship a genuine speech recogniser (the Web Speech API), so on web we
 * can transcribe for real with no provider key at all.
 *
 * Honesty rules this module obeys:
 *  - It is REAL transcription, never simulated. If the browser has no
 *    recogniser, `isWebSpeechSupported()` is false and callers keep the
 *    typed-input fallback and the "not configured" message.
 *  - Audio goes to the BROWSER's own speech service, not to Babelish. Callers
 *    say so in the UI, and docs/PRIVACY.md documents it.
 *  - Permission denial surfaces as a readable error, not a silent dead tap.
 *
 * Native (iOS/Android) has no equivalent built-in, so native keeps the
 * server/direct transport only.
 *
 * Module-level code touches nothing platform-specific, so it imports cleanly
 * under plain node (tests/webSpeech.test.ts).
 */

/* Minimal structural types for the Web Speech API (not in RN's lib dom). */
type WebSpeechAlternative = { transcript: string; confidence: number };
type WebSpeechResult = {
  isFinal: boolean;
  0: WebSpeechAlternative;
  length: number;
};
type WebSpeechResultEvent = { resultIndex: number; results: { length: number; [i: number]: WebSpeechResult } };
type WebSpeechErrorEvent = { error: string };
type WebSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: WebSpeechResultEvent) => void) | null;
  onerror: ((e: WebSpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type WebSpeechRecognitionCtor = new () => WebSpeechRecognition;

function recognitionCtor(): WebSpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: WebSpeechRecognitionCtor;
    webkitSpeechRecognition?: WebSpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** True only when this runtime actually exposes a speech recogniser. */
export function isWebSpeechSupported(): boolean {
  return recognitionCtor() !== null;
}

export type WebSpeechSession = {
  /** Stops listening and resolves the final transcript ('' if nothing caught). */
  stop: () => Promise<string>;
  /** Abandons the session; the pending stop() resolves ''. */
  cancel: () => void;
};

/**
 * Starts recognising `locale` (BCP-47, e.g. the language's ttsLocale).
 * Returns null when unsupported. Rejects stop() with a readable Error on
 * permission/service failure so callers can show it instead of failing silent.
 */
export function startWebSpeech(
  locale: string,
  onPartial?: (text: string) => void
): WebSpeechSession | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = locale;
  recognition.continuous = true; // keep listening until the learner taps stop
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let finalText = '';
  let interimText = '';
  let settle: ((t: string) => void) | null = null;
  let reject: ((e: Error) => void) | null = null;
  let failed: Error | null = null;

  recognition.onresult = (event) => {
    interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const text = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += text;
      else interimText += text;
    }
    onPartial?.((finalText + interimText).trim());
  };

  recognition.onerror = (event) => {
    // 'no-speech' and 'aborted' are ordinary endings, not failures.
    if (event.error === 'no-speech' || event.error === 'aborted') return;
    failed =
      event.error === 'not-allowed' || event.error === 'service-not-allowed'
        ? new Error('Microphone access is off — enable it in your browser settings to speak.')
        : new Error(`Browser speech recognition failed (${event.error}) — type your reply instead.`);
  };

  recognition.onend = () => {
    if (failed) reject?.(failed);
    else settle?.(finalText.trim());
  };

  recognition.start();

  return {
    stop: () =>
      new Promise<string>((resolve, promiseReject) => {
        settle = resolve;
        reject = promiseReject;
        recognition.stop();
      }),
    cancel: () => {
      settle = (t) => void t; // swallow the trailing onend
      reject = () => {};
      recognition.abort();
    },
  };
}
