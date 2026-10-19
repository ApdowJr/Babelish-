/**
 * Upload-path tests for voice input — the module whose web/FormData bug made
 * the deployed site's microphone silently useless (the "[object Object]"
 * multipart body). Runs under plain Node: `platform` is a parameter and the
 * fetcher is injectable precisely so this needs no device or bundle.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendTranscriptionFields,
  prepareAudioPart,
  type PreparedAudio,
} from '../src/lib/sttUpload';

const blobUrl = 'blob:http://localhost/8f3c-abc123';

test('web: fetches the blob: URI and derives filename/size from real bytes', async () => {
  const blob = new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'audio/webm;codecs=opus' });
  const res = await prepareAudioPart(blobUrl, 'web', async (input) => {
    assert.equal(String(input), blobUrl, 'must fetch the recorder blob URL');
    return new Response(blob);
  });
  assert.ok(res.part instanceof Blob, 'web upload part must be a real Blob');
  assert.equal(res.filename, 'speech.webm', 'MediaRecorder webm/opus → .webm');
  assert.equal(res.sizeBytes, 4);
});

test('web: iOS/Safari audio/mp4 recordings map to .m4a, unknown mime falls back', async () => {
  const mp4 = await prepareAudioPart(blobUrl, 'web', async () =>
    new Response(new Blob([new Uint8Array(2)], { type: 'audio/mp4' }))
  );
  assert.equal(mp4.filename, 'speech.m4a');

  const odd = await prepareAudioPart(blobUrl, 'web', async () =>
    new Response(new Blob([new Uint8Array(2)], { type: 'audio/x-mystery' }))
  );
  assert.equal(odd.filename, 'speech.webm', 'unknown mime keeps a valid extension');
});

test('web: an unreadable or throwing blob fetch fails with the user-facing message', async () => {
  await assert.rejects(
    prepareAudioPart(blobUrl, 'web', async () => new Response(null, { status: 404 })),
    /Could not read the recording/
  );
  await assert.rejects(
    prepareAudioPart(blobUrl, 'web', async () => {
      throw new TypeError('Failed to fetch');
    }),
    /Could not read the recording/
  );
});

test('web: a zero-byte recording is rejected before it can hit the API', async () => {
  const empty = new Blob([], { type: 'audio/webm' });
  await assert.rejects(
    prepareAudioPart(blobUrl, 'web', async () => new Response(empty)),
    /came out empty/
  );
});

test('native: returns the classic { uri } part React Native FormData uploads', async () => {
  const uri = 'file:///data/user/0/dev.zelvoca/cache/speech.m4a';
  const res = await prepareAudioPart(uri, 'android');
  assert.deepEqual(res.part, { uri, name: 'speech.m4a', type: 'audio/m4a' });
  assert.equal(res.filename, 'speech.m4a');

  const ios = await prepareAudioPart(uri, 'ios');
  assert.deepEqual(ios.part, { uri, name: 'speech.m4a', type: 'audio/m4a' });

  await assert.rejects(prepareAudioPart('', 'android'), /No recording was captured/);
});

test('appendTranscriptionFields: multipart fields match the Whisper contract', async () => {
  const blob = new Blob([new Uint8Array(3)], { type: 'audio/webm' });
  const audio: PreparedAudio = { part: blob, filename: 'speech.webm', sizeBytes: 3 };
  const form = new FormData();
  appendTranscriptionFields(form, audio, { model: 'whisper-1', languageId: 'es' });

  const file = form.get('file');
  assert.ok(file instanceof Blob, 'file part must be the Blob itself, not a stringified object');
  assert.equal((file as File).name, 'speech.webm', 'filename must match the real container');
  assert.equal(form.get('model'), 'whisper-1');
  assert.equal(form.get('language'), 'es');
  assert.equal(form.get('response_format'), 'json');
});
