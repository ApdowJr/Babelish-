/**
 * Audio byte helpers for on-device speech models.
 *
 * Kept free of react-native/expo imports so the browser path and its tests
 * share one implementation.
 */
import { EngineFailed } from './types';

/** Reads a recording's bytes for on-device inference (web only). */
export async function readAudioBytes(
  audioUri: string,
  fetcher: typeof fetch = fetch
): Promise<ArrayBuffer> {
  let res: Response;
  try {
    res = await fetcher(audioUri);
  } catch {
    throw new EngineFailed('Could not read the recording — try again.', 'browser');
  }
  if (!res.ok) throw new EngineFailed('Could not read the recording — try again.', 'browser');
  const buffer = await res.arrayBuffer();
  if (buffer.byteLength === 0) {
    throw new EngineFailed(
      'The recording came out empty — check your microphone and try again.',
      'browser'
    );
  }
  return buffer;
}
