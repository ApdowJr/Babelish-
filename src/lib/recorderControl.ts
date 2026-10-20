/**
 * Pure start/stop orchestration for the voice recorder.
 *
 * Why this module exists: `expo-audio`'s recorder exposes a **live**
 * `isRecording` property, but its `useAudioRecorderState` hook only refreshes
 * every 500ms. That gap produced two real bugs on both platforms:
 *
 *  - tapping stop inside the poll window read a stale `isRecording: false`,
 *    so the clip was never stopped — on web the mic track stayed live with
 *    the browser's recording indicator on, and the screen got `null` back
 *    (then swallowed it as "nothing captured");
 *  - a recorder that had already stopped itself (the 30s duration cap)
 *    throws if `stop()` is called again on web, which wedged the screen in
 *    its recording UI.
 *
 * A third case: `prepareToRecordAsync()` is async (getUserMedia on web), so
 * a fast second tap can land *while starting*. `stop()` therefore awaits the
 * in-flight start first, then stops using the live property.
 *
 * Everything here is deliberately free of React and of `expo-audio` types:
 * the recorder is a minimal structural interface, so Node unit tests can
 * simulate every timing with a fake and prove the rules — no device, bundle
 * or browser required.
 */

/** The surface of an `expo-audio` recorder this module relies on. */
export type RecorderLike = {
  readonly isRecording: boolean;
  readonly uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  recordForDuration(seconds: number): void;
  stop(): Promise<void>;
};

export type RecorderControl = {
  /** Prepares then starts recording; rejects when the mic cannot be opened. */
  start(maxSeconds: number): Promise<void>;
  /** Stops (if recording) and returns the audio URI, or null if there's none. */
  stop(): Promise<string | null>;
  /** Screen went away: finish a starting prepare, then release the mic. */
  dispose(): Promise<void>;
};

export function createRecorderControl(recorder: RecorderLike): RecorderControl {
  /** The in-flight start(); stop()/dispose() wait for it so a fast tap can't miss it. */
  let starting: Promise<void> | null = null;
  let disposed = false;

  async function start(maxSeconds: number): Promise<void> {
    if (disposed) return;
    const pending = (async () => {
      await recorder.prepareToRecordAsync();
      // Unmount can land mid-prepare; don't open a mic nobody is listening to.
      if (!disposed) recorder.recordForDuration(maxSeconds);
    })();
    starting = pending;
    try {
      await pending;
    } finally {
      if (starting === pending) starting = null;
    }
  }

  async function stop(): Promise<string | null> {
    const pending = starting;
    if (pending) await pending.catch(() => undefined);
    try {
      // Live property, never the polled hook state (see module doc).
      if (recorder.isRecording) await recorder.stop();
    } catch {
      // The recorder already stopped itself (30s cap) and rejects a second
      // stop on web — fall through to whatever URI it already holds.
    }
    return recorder.uri ?? null;
  }

  async function dispose(): Promise<void> {
    disposed = true;
    const pending = starting;
    if (pending) await pending.catch(() => undefined);
    if (recorder.isRecording) await recorder.stop().catch(() => undefined);
  }

  return { start, stop, dispose };
}
