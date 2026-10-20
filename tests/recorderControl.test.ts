/**
 * Recorder race tests — the timing rules behind "the microphone works".
 *
 * These simulate, with a fake recorder, every path that used to break voice
 * input on web and native: a stop that lands while `prepareToRecordAsync()`
 * is still opening the mic, a stop that must key off the LIVE `isRecording`
 * property instead of the 500ms-polled hook state, a recorder that already
 * auto-stopped at the 30s cap and rejects a second stop on web, a denied
 * permission on start, and an unmount mid-start. No device or browser needed:
 * `createRecorderControl` is pure, so Node runs the real orchestration code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRecorderControl } from '../src/lib/recorderControl';

/** Mutable structural twin of RecorderLike — tests flip state by hand. */
type FakeRecorder = {
  isRecording: boolean;
  uri: string | null;
  prepareToRecordAsync(): Promise<void>;
  recordForDuration(seconds: number): void;
  stop(): Promise<void>;
};

type Fake = {
  recorder: FakeRecorder;
  calls: string[];
};

function fakeRecorder(): Fake {
  const calls: string[] = [];
  const recorder = {
    isRecording: false,
    uri: null as string | null,
    async prepareToRecordAsync() {
      calls.push('prepare');
    },
    recordForDuration(seconds: number) {
      calls.push(`record:${seconds}`);
      recorder.isRecording = true;
    },
    async stop() {
      calls.push('stop');
      recorder.isRecording = false;
      recorder.uri = 'file:///speech.m4a';
    },
  };
  return { recorder, calls };
}

/** A promise that the test opens by hand — stands in for getUserMedia. */
function gate(): { open: () => void; waiting: Promise<void> } {
  let open!: () => void;
  const waiting = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { open, waiting };
}

test('normal start → stop uses the live property and returns the clip URI', async () => {
  const { recorder, calls } = fakeRecorder();
  const control = createRecorderControl(recorder);

  await control.start(30);
  const uri = await control.stop();

  assert.deepEqual(calls, ['prepare', 'record:30', 'stop']);
  assert.equal(uri, 'file:///speech.m4a');
  assert.equal(recorder.isRecording, false, 'mic must be released');
});

test('stop during prepare waits for the in-flight start, then stops that clip', async () => {
  const { recorder, calls } = fakeRecorder();
  const g = gate();
  recorder.prepareToRecordAsync = async () => {
    await g.waiting;
    calls.push('prepare');
  };
  const control = createRecorderControl(recorder);

  // Tap "record" and, before getUserMedia resolves, tap "stop" — the old
  // code saw isRecording=false, skipped the stop entirely, returned null,
  // and left the web mic running.
  const starting = control.start(30);
  const stopping = control.stop();
  g.open();
  await starting;
  const uri = await stopping;

  assert.deepEqual(calls, ['prepare', 'record:30', 'stop'], 'stop must run after prepare');
  assert.equal(uri, 'file:///speech.m4a', 'the clip started by that tap is the one returned');
  assert.equal(recorder.isRecording, false);
});

test('stop keys off the recorder itself, not any caller-side idle state', async () => {
  const { recorder, calls } = fakeRecorder();
  // The screen's polled state says "not recording", but the recorder is.
  recorder.isRecording = true;
  const control = createRecorderControl(recorder);

  const uri = await control.stop();

  assert.deepEqual(calls, ['stop'], 'a live recording must always be stopped');
  assert.equal(uri, 'file:///speech.m4a');
});

test('a recorder that already hit the 30s cap: stop returns its URI without a second stop', async () => {
  const { recorder, calls } = fakeRecorder();
  recorder.uri = 'file:///speech.m4a'; // auto-stop at the cap already stored it
  const control = createRecorderControl(recorder);

  const uri = await control.stop(); // isRecording === false

  assert.equal(uri, 'file:///speech.m4a');
  assert.deepEqual(calls, [], 'no second stop() — on web that call throws');
});

test('a second stop that throws on web still yields the URI, never an exception', async () => {
  const { recorder, calls } = fakeRecorder();
  recorder.isRecording = true;
  recorder.uri = 'file:///speech.m4a';
  recorder.stop = async () => {
    calls.push('stop');
    throw new Error('Cannot start an audio recording without initializing a MediaRecorder');
  };
  const control = createRecorderControl(recorder);

  const uri = await control.stop();

  assert.equal(uri, 'file:///speech.m4a', 'fall through to the URI the recorder holds');
  assert.deepEqual(calls, ['stop']);
});

test('a denied mic on start rejects start() and a later stop is safe and honest', async () => {
  const { recorder, calls } = fakeRecorder();
  recorder.prepareToRecordAsync = async () => {
    calls.push('prepare');
    throw new Error('NotAllowedError: Permission denied');
  };
  const control = createRecorderControl(recorder);

  await assert.rejects(control.start(30), /Permission denied/);
  const uri = await control.stop();

  assert.equal(uri, null, 'no clip exists — caller reports "nothing was captured"');
  assert.deepEqual(calls, ['prepare'], 'recordForDuration must never run without a mic');
});

test('unmount during prepare: no recording starts, no mic left open', async () => {
  const { recorder, calls } = fakeRecorder();
  const g = gate();
  recorder.prepareToRecordAsync = async () => {
    await g.waiting;
    calls.push('prepare');
  };
  const control = createRecorderControl(recorder);

  const starting = control.start(30).catch(() => undefined);
  const disposing = control.dispose(); // screen unmounts mid-start
  g.open();
  await starting;
  await disposing;

  assert.deepEqual(calls, ['prepare'], 'never record after dispose; never leak the mic');
  assert.equal(recorder.isRecording, false);
});

test('unmount while recording stops the clip and releases the mic', async () => {
  const { recorder, calls } = fakeRecorder();
  const control = createRecorderControl(recorder);
  await control.start(30);
  assert.equal(recorder.isRecording, true);

  await control.dispose();

  assert.deepEqual(calls, ['prepare', 'record:30', 'stop']);
  assert.equal(recorder.isRecording, false);
});

test('start after dispose is a no-op (stale screen can never open the mic)', async () => {
  const { recorder, calls } = fakeRecorder();
  const control = createRecorderControl(recorder);
  await control.dispose();

  await control.start(30);

  assert.deepEqual(calls, []);
  assert.equal(recorder.isRecording, false);
});
