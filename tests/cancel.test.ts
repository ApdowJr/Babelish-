/**
 * Cancellation tests.
 *
 * Stop has to be three things at once: immediate (no waiting for a doomed
 * reply), quiet (not an error card), and honest (the turn still counts, because
 * the model was already asked). These pin the adapter half of that contract:
 * a caller abort is its own outcome, is never retried on another runtime, and
 * is never confused with the 60-second timeout, which *is* refunded.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChat } from '../src/lib/models/chat';
import type { ModelSettings } from '../src/lib/models/config';
import {
  EngineFailed,
  RequestCancelled,
  isCancelled,
} from '../src/lib/models/types';

const settings: ModelSettings = {
  mode: 'auto',
  ollamaUrl: '',
  openaiUrl: '',
  browser: { enabled: true },
  allowUnverified: true,
} as ModelSettings;

const call = {
  messages: [{ role: 'user' as const, content: 'Hola' }],
  languageId: 'es',
  meta: { languageId: 'es' },
};

type FetchArgs = { url: string; init?: RequestInit };

function stubFetch(handler: (args: FetchArgs) => Promise<Response>) {
  const calls: FetchArgs[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const args = { url, init };
    calls.push(args);
    return handler(args);
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const abortError = () => Object.assign(new Error('The operation was aborted.'), { name: 'AbortError' });

test('aborting mid-turn raises RequestCancelled, not a timeout', async () => {
  const stub = stubFetch(
    ({ init }) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(abortError()));
      })
  );
  const controller = new AbortController();
  try {
    const pending = runChat(
      { ...settings },
      { ...call, signal: controller.signal },
      { gatewayBase: 'https://api.example.org', jwt: 'jwt', browserSupported: true }
    );
    setTimeout(() => controller.abort(), 5);

    await assert.rejects(pending, (err: unknown) => {
      assert.ok(err instanceof RequestCancelled, `expected RequestCancelled, got ${(err as Error)?.name}`);
      assert.ok(!/timed out/i.test((err as Error).message));
      return true;
    });
    assert.equal(stub.calls.length, 1, 'a cancelled turn is not retried on the next runtime');
  } finally {
    stub.restore();
  }
});

test('the internal 55-second timeout is still a failure (and refundable)', async () => {
  // No caller signal: the adapter's own controller fired, as it does at 60s.
  const stub = stubFetch(async () => {
    throw abortError();
  });
  try {
    await assert.rejects(
      () =>
        runChat({ ...settings, mode: 'server' }, call, {
          gatewayBase: 'https://api.example.org',
        }),
      (err: unknown) => {
        assert.ok(err instanceof EngineFailed);
        assert.ok(!(err instanceof RequestCancelled));
        assert.match((err as Error).message, /timed out/i);
        return true;
      }
    );
  } finally {
    stub.restore();
  }
});

test('a pre-aborted signal never produces a reply', async () => {
  const stub = stubFetch(async () =>
    new Response(JSON.stringify({ reply: 'should not be used', translation: 'x' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
  const controller = new AbortController();
  controller.abort();
  try {
    await assert.rejects(
      () =>
        runChat(
          { ...settings, mode: 'server' },
          { ...call, signal: controller.signal },
          { gatewayBase: 'https://api.example.org' }
        ),
      (err: unknown) => err instanceof RequestCancelled
    );
    assert.equal(stub.calls.length, 0, 'a request the learner already stopped is never opened');
  } finally {
    stub.restore();
  }
});

test('isCancelled recognises the class, the signal and a raw AbortError', () => {
  const live = new AbortController();
  assert.equal(isCancelled(new RequestCancelled('gateway')), true);
  assert.equal(isCancelled(undefined, live.signal), false);
  live.abort();
  assert.equal(isCancelled(new Error('anything'), live.signal), true);
  assert.equal(isCancelled(abortError()), true);
  assert.equal(isCancelled(new EngineFailed('boom')), false, 'real failures stay failures');
});
