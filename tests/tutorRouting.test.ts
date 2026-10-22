/**
 * Tutor routing after the model screen was removed.
 *
 * The learner never configures a model: chat goes to the app's tutor server,
 * a signed-out or unconfigured server is *unavailable* (not an error), and the
 * bundled coach takes over silently. These tests pin that contract.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, chatCandidates, sttCandidates } from '../src/lib/models/config';
import { runChat } from '../src/lib/models/chat';

const gateway = { gatewayBase: 'https://tutor.example.org' };
const settings = DEFAULT_SETTINGS;

test('the default setup points at the tutor server, not localhost', () => {
  assert.equal(settings.mode, 'server');
  assert.deepEqual(chatCandidates(settings, {}), [], 'no server URL → nothing to try');
  assert.deepEqual(chatCandidates(settings, gateway), ['gateway']);
  // Chat never falls back to a browser download in the default setup.
  assert.deepEqual(
    chatCandidates(settings, { ...gateway, browserSupported: true }),
    ['gateway']
  );
});

test('speech may still use an on-device model when the server has no audio', () => {
  assert.deepEqual(sttCandidates(settings, gateway), ['gateway']);
  assert.deepEqual(
    sttCandidates(
      { ...settings, browser: { ...settings.browser, enabled: true } },
      { ...gateway, browserSupported: true }
    ),
    ['gateway', 'browser']
  );
});

type FetchArgs = { url: string; init?: RequestInit };

function stub(handler: (args: FetchArgs) => Response | Promise<Response>) {
  const calls: FetchArgs[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    return handler({ url, init });
  }) as typeof fetch;
  return {
    calls,
    restore() {
      globalThis.fetch = original;
    },
  };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const call = {
  messages: [{ role: 'user' as const, content: 'Hola' }],
  languageId: 'es',
  meta: { languageId: 'es' },
};

test('a signed-out request reaches the server without an Authorization header', async () => {
  const stubber = stub(() => json({ reply: '¡Hola!', translation: 'Hi!' }));
  try {
    const answer = await runChat(settings, call, gateway);
    assert.ok(answer);
    assert.equal(answer.runtime, 'gateway');
    const headers = stubber.calls[0].init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, undefined);
    assert.equal(stubber.calls[0].url, 'https://tutor.example.org/api/ai/chat');
  } finally {
    stubber.restore();
  }
});

test('401 from a protected gateway becomes the coach, not an error dialog', async () => {
  const stubber = stub(() => json({ error: 'Unauthorized' }, 401));
  try {
    const answer = await runChat(settings, call, gateway);
    assert.equal(answer, null);
  } finally {
    stubber.restore();
  }
});

test('an unconfigured tutor server becomes the coach', async () => {
  const stubber = stub(() => json({ error: 'ai-not-configured' }, 503));
  try {
    assert.equal(await runChat(settings, call, gateway), null);
  } finally {
    stubber.restore();
  }
});

test('an offline device tries nothing and shows no model bar', async () => {
  const stubber = stub(() => {
    throw new Error('should not be called');
  });
  try {
    const answer = await runChat({ ...settings, mode: 'offline' }, call, gateway);
    assert.equal(answer, null);
    assert.equal(stubber.calls.length, 0);
  } finally {
    stubber.restore();
  }
});
