/**
 * Builds the multipart `file` part for a speech-to-text request.
 *
 * Why this module exists: react-native's `FormData.append(name, { uri, name,
 * type })` is a native-only convention. On web, the browser's WHATWG FormData
 * stringifies that plain object to "[object Object]" and the transcription
 * service receives garbage — which is exactly why voice input could never
 * work in the deployed web app even with a key configured.
 *
 * - web: the recorder yields a `blob:` URL (MediaRecorder, typically
 *   audio/webm) — fetch it into a real `Blob` and send it with a filename
 *   that matches its actual MIME type;
 * - native: expo-audio writes an .m4a file — keep the classic { uri } part.
 *
 * Pure by design (no react-native import): `platform` is a parameter, so the
 * logic is unit-testable in Node.
 */

export type AudioPart = Blob | { uri: string; name: string; type: string };

export type PreparedAudio = {
  part: AudioPart;
  /** Multipart filename — must agree with the bytes' real container format. */
  filename: string;
  sizeBytes?: number;
};

const EXT_BY_MIME: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
};

function extensionFor(mime: string): string {
  return EXT_BY_MIME[mime] ?? 'webm';
}

/**
 * Releases a web `blob:` URL once its bytes have been read. Every MediaRecorder
 * take creates one of these object URLs, and nothing else ever revokes it, so a
 * long speak session leaked one URL (and its audio buffer) per recording.
 * Only `blob:` URLs are touched — a native file URI is the recorder's output,
 * and revoking anything here would be wrong on platforms where the default is
 * a no-op anyway.
 */
export function defaultRevokeBlobUrl(url: string): void {
  if (url.startsWith('blob:') && typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
    URL.revokeObjectURL(url);
  }
}

/**
 * Prepares a recorded audio URI for upload.
 * Throws user-visible errors for the two silent-failure cases: an unreadable
 * URI and an empty recording (0 bytes) — the transcription API would reject
 * both with an opaque 400 otherwise.
 */
export async function prepareAudioPart(
  audioUri: string,
  platform: 'web' | 'native' | string,
  fetcher: typeof fetch = fetch,
  revoke: (url: string) => void = defaultRevokeBlobUrl
): Promise<PreparedAudio> {
  if (platform === 'web') {
    let res: Response;
    try {
      res = await fetcher(audioUri);
    } catch {
      throw new Error('Could not read the recording — try recording again.');
    }
    if (!res.ok) {
      throw new Error('Could not read the recording — try recording again.');
    }
    const blob = await res.blob();
    // The bytes are in hand now; the object URL is no longer needed.
    revoke(audioUri);
    if (!blob || blob.size === 0) {
      throw new Error('The recording came out empty — check your microphone and try again.');
    }
    const mime = (blob.type || 'audio/webm').split(';')[0];
    return { part: blob, filename: `speech.${extensionFor(mime)}`, sizeBytes: blob.size };
  }

  if (!audioUri) {
    throw new Error('No recording was captured — try recording again.');
  }
  return { part: { uri: audioUri, name: 'speech.m4a', type: 'audio/m4a' }, filename: 'speech.m4a' };
}

/** Appends the audio part + common Whisper options to a FormData body. */
export function appendTranscriptionFields(
  form: FormData,
  audio: PreparedAudio,
  opts: { model: string; languageId?: string }
): void {
  // React Native accepts the { uri } object; the web FormData needs a real
  // Blob (or string). Both are handled by the exact value passed here.
  form.append('file', audio.part as Blob, audio.filename);
  form.append('model', opts.model);
  if (opts.languageId) form.append('language', opts.languageId);
  form.append('response_format', 'json');
}
