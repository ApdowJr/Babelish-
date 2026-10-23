/**
 * Adapter behaviour without a model server: stubbed fetch, real code paths.
 * Proves the two failure classes stay distinct — "not available" (skip to the
 * next engine) versus "ran and failed" (surface to the learner).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChat, probeEngines } from '../src/lib/models/chat';
import { readAudioBytes } from '../src/lib/models/audio';
import { runTranscribe } from '../src/lib/models/stt';
import { DEFAULT_SETTINGS, type ModelSettings } from '../src/lib/models/config';
import { EngineFailed, QuotaExceeded } from '../src/lib/models/types';

const base: ModelSettings = {
  ...DEFAULT_SETTINGS,
  mode: 'local',
  ollamaUrl: 'http://localhost:11434',
  openaiUrl: '',
  allowUnverified: false,
};

const call = {
  messages: [
    { role: 'system' as const, content: 'You are a tutor.' },
    { role: 'user' as const, content: 'Hola' },
  ],
  languageId: 'es',
  meta: { languageId: 'es' },
};

type FetchArgs = { url: string; init?: RequestInit };

function stubFetch(handler: (args: FetchArgs) => Response | Promise<Response>) {
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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

test('Ollama adapter sends the conversation and parses message.content', async () => {
  const stub = stubFetch(() => json({ message: { content: '¡Hola! ¿Qué tal?' } }));
  try {
    const answer = await runChat(base, call, {});
    assert.ok(answer);
    assert.equal(answer.runtime, 'ollama');
    assert.equal(answer.text, '¡Hola! ¿Qué tal?');
    assert.equal(stub.calls[0].url, 'http://localhost:11434/api/chat');
    const body = JSON.parse(String(stub.calls[0].init?.body));
    assert.equal(body.model, 'qwen2.5:1.5b');
    assert.equal(body.stream, false);
    assert.equal(body.messages.length, 2);
  } finally {
    stub.restore();
  }
});

test('a missing Ollama model is surfaced, not silently swapped for demo text', async () => {
  const stub = stubFetch(() =>
    json({ error: 'model "qwen2.5:1.5b" not found, try pulling it first' }, 404)
  );
  try {
    await assert.rejects(
      () => runChat(base, call, {}),
      (err: unknown) =>
        err instanceof EngineFailed && /ollama pull qwen2\.5:1\.5b/.test((err as Error).message)
    );
  } finally {
    stub.restore();
  }
});

test('an unreachable Ollama falls through to the next engine', async () => {
  const stub = stubFetch((args) => {
    if (args.url.includes('localhost:11434')) throw new TypeError('fetch failed');
    return json({ reply: 'Hola, ¿cómo estás?', translation: 'Hi, how are you?' });
  });
  try {
    const auto: ModelSettings = { ...base, mode: 'auto' };
    const answer = await runChat(auto, call, {
      gatewayBase: 'https://api.example.org',
      jwt: 'jwt-token',
    });
    assert.ok(answer);
    assert.equal(answer.runtime, 'gateway');
    const gatewayBody = JSON.parse(String(stub.calls.at(-1)?.init?.body));
    assert.deepEqual(gatewayBody.history, [{ role: 'user', text: 'Hola' }]);
    assert.equal(
      (stub.calls.at(-1)?.init?.headers as Record<string, string>).Authorization,
      'Bearer jwt-token'
    );
    // The gateway answer is re-shaped as tutor JSON for the shared parser.
    const parsed = JSON.parse(answer.text);
    assert.equal(parsed.reply, 'Hola, ¿cómo estás?');
  } finally {
    stub.restore();
  }
});

test('with no engine at all the caller gets null (offline coach path)', async () => {
  const stub = stubFetch(() => {
    throw new TypeError('fetch failed');
  });
  try {
    const answer = await runChat({ ...base, mode: 'auto' }, call, {});
    assert.equal(answer, null);
  } finally {
    stub.restore();
  }
});

test('unverified languages are skipped before any request is made', async () => {
  const stub = stubFetch(() => json({ message: { content: 'should not be called' } }));
  try {
    const answer = await runChat(
      { ...base, mode: 'local' },
      { ...call, languageId: 'bn', meta: { languageId: 'bn' } },
      {}
    );
    assert.equal(answer, null);
    assert.equal(stub.calls.length, 0);

    // Opting in allows the request.
    const allowed = await runChat(
      { ...base, mode: 'local', allowUnverified: true },
      { ...call, languageId: 'bn', meta: { languageId: 'bn' } },
      {}
    );
    assert.ok(allowed);
    assert.equal(stub.calls.length, 1);
  } finally {
    stub.restore();
  }
});

test('the local OpenAI-compatible adapter uses /chat/completions', async () => {
  const stub = stubFetch(() =>
    json({ choices: [{ message: { content: 'Bonjour !' } }] })
  );
  try {
    const settings: ModelSettings = {
      ...base,
      ollamaUrl: '',
      openaiUrl: 'http://192.168.1.9:1234/v1',
      openaiModel: 'qwen2.5:7b',
      mode: 'local',
    };
    const answer = await runChat(settings, { ...call, languageId: 'fr' }, {});
    assert.ok(answer);
    assert.equal(answer.runtime, 'openai');
    assert.equal(stub.calls[0].url, 'http://192.168.1.9:1234/v1/chat/completions');
  } finally {
    stub.restore();
  }
});

test('a spent daily budget is its own error, with the server’s dated message', async () => {
  const message =
    'You’ve used today’s tutor messages for learners. It resets at 00:00 UTC — lessons, review and the phrasebook keep working.';
  const stub = stubFetch(() =>
    json({ error: 'daily-limit', message, resetsAt: '2026-10-23T00:00:00.000Z' }, 429)
  );
  try {
    await assert.rejects(
      () =>
        runChat(
          { ...base, mode: 'server', ollamaUrl: '', browser: { ...base.browser, enabled: true } },
          call,
          { gatewayBase: 'https://api.example.org', jwt: 'jwt-token', browserSupported: true }
        ),
      (err: unknown) => {
        assert.ok(err instanceof QuotaExceeded, 'must not be a generic EngineFailed');
        const quota = err as QuotaExceeded;
        assert.equal(quota.resetsAt, '2026-10-23T00:00:00.000Z');
        assert.match(quota.message, /00:00 UTC/);
        return true;
      }
    );
    assert.equal(stub.calls.length, 1, 'a spent budget is not retried on another runtime');
  } finally {
    stub.restore();
  }
});

test('the per-minute rate limit stays a plain failure (it is not a daily cap)', async () => {
  const stub = stubFetch(() => json({ error: 'rate-limited', message: 'Try again shortly.' }, 429));
  try {
    await assert.rejects(
      () =>
        runChat({ ...base, mode: 'server', ollamaUrl: '' }, call, {
          gatewayBase: 'https://api.example.org',
        }),
      (err: unknown) => err instanceof EngineFailed && !(err instanceof QuotaExceeded)
    );
  } finally {
    stub.restore();
  }
});

test('gateway 503 "not configured" is treated as unavailable, not an error', async () => {
  const stub = stubFetch(() => json({ error: 'ai-not-configured' }, 503));
  try {
    const answer = await runChat(
      { ...base, mode: 'server', ollamaUrl: '' },
      call,
      { gatewayBase: 'https://api.example.org', jwt: 'jwt' }
    );
    assert.equal(answer, null);
  } finally {
    stub.restore();
  }
});

test('probeEngines reports Ollama only when the daemon answers', async () => {
  const up = stubFetch((args) =>
    args.url.endsWith('/api/tags')
      ? json({ models: [{ name: 'qwen2.5:1.5b' }] })
      : json({})
  );
  try {
    const probe = await probeEngines({ ...base, mode: 'local' }, {});
    assert.equal(probe.chatRuntime, 'ollama');
    assert.deepEqual(probe.ollamaModels, ['qwen2.5:1.5b']);
    assert.match(probe.detail, /Ollama ready/);
  } finally {
    up.restore();
  }

  const down = stubFetch(() => {
    throw new TypeError('fetch failed');
  });
  try {
    const probe = await probeEngines({ ...base, mode: 'local' }, {});
    assert.equal(probe.chatRuntime, null);
    assert.equal(probe.offline, true);
    assert.match(probe.detail, /unreachable/i);
  } finally {
    down.restore();
  }
});

test('readAudioBytes rejects an empty take and returns real bytes', async () => {
  const empty = stubFetch(() => new Response(new Uint8Array(0)));
  try {
    await assert.rejects(() => readAudioBytes('blob:empty'), /came out empty/);
  } finally {
    empty.restore();
  }

  const bytes = new Uint8Array([1, 2, 3, 4]);
  const ok = stubFetch(() => new Response(bytes));
  try {
    const buffer = await readAudioBytes('blob:ok');
    assert.equal(buffer.byteLength, 4);
  } finally {
    ok.restore();
  }
});

test('gateway chat sends both Authorization and Supabase apikey headers', async () => {
  const stub = stubFetch(() =>
    json({ reply: '¡Hola!', translation: 'Hello!', tip: 'Friendly greeting.', model: 'gpt-test' })
  );
  try {
    const out = await runChat(
      { ...base, mode: 'server', ollamaUrl: '' },
      call,
      {
        gatewayBase: 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1/babelish-ai',
        jwt: 'session-jwt',
        apiKey: 'sb_publishable_key',
      }
    );
    assert.equal(out?.text.includes('¡Hola!'), true);
    const headers = stub.calls[0]?.init?.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer session-jwt');
    assert.equal(headers.apikey, 'sb_publishable_key');
  } finally {
    stub.restore();
  }
});

test('gateway STT treats 503 ai-not-configured as unavailable rather than crashing before fallback', async () => {
  const audioBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const stub = stubFetch((args) => {
    if (args.url === 'blob:voice') return new Response(audioBytes);
    return json({ error: 'ai-not-configured', message: 'Voice transcription is not configured.' }, 503);
  });
  try {
    const out = await runTranscribe(
      { ...base, mode: 'server', sttModel: 'whisper-base' },
      'blob:voice',
      'so',
      {
        gatewayBase: 'https://dvgluivslmdrqsvlscmj.supabase.co/functions/v1/babelish-ai',
        jwt: 'session-jwt',
        apiKey: 'sb_publishable_key',
      }
    );
    // Notice sttModel='whisper-base' does not document 'so' locally,
    // yet gateway STT still attempted the server call and cleanly returned null on 503!
    assert.equal(out, null);
    assert.equal(stub.calls.length, 2);
  } finally {
    stub.restore();
  }
});

test('gateway STT surfaces 422 empty-transcript as a user-facing EngineFailed error', async () => {
  const audioBytes = new Uint8Array([82, 73, 70, 70, 1, 2, 3, 4]);
  const stub = stubFetch((args) => {
    if (args.url === 'blob:voice') return new Response(audioBytes);
    return json({ error: 'empty-transcript', message: 'No words were detected.' }, 422);
  });
  try {
    await assert.rejects(
      () =>
        runTranscribe(
          { ...base, mode: 'server' },
          'blob:voice',
          'es',
          { gatewayBase: 'https://api.example.org', jwt: 'jwt' }
        ),
      (err: unknown) => err instanceof EngineFailed && /No words were detected/.test(err.message)
    );
  } finally {
    stub.restore();
  }
});

