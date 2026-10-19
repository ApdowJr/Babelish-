#!/usr/bin/env node
/**
 * Local live smoke of the `api` Function — runs the REAL Hono app straight
 * from TypeScript source (Node type-stripping + an extension-resolving
 * module hook), so auth, CORS, rate limits, the AI proxy and the admin gate
 * are exercised over real HTTP-shaped Request/Response objects WITHOUT a
 * deploy. Deployment still needs a NEON_API_KEY; this is the evidence we can
 * produce in its absence, and it must stay green before any deploy.
 *
 * Three child processes (fresh module state = fresh rate limiters):
 *   Phase 1 — no AI key: health/DB, 401s, honest {chat:false,stt:false}
 *             status, 503 ai-not-configured, the full CORS battery
 *             (origin allowlist + DELETE preflight) and the admin Basic
 *             gate + failure limiter.
 *   Phase 2 — AI key + a local FAKE provider: chat happy/empty/wrong-script/
 *             plain-text/provider-401 scenarios, STT multipart contract,
 *             and both rate-limit budgets (20/min chat, 10/min STT).
 *   Phase 3 — AI key + unreachable provider: honest 502, never fabricated
 *             content.
 *
 * Auth inside the smoke is self-contained: the parent signs a throwaway
 * EdDSA JWT whose issuer matches NEON_AUTH_BASE_URL, and each phase serves
 * the matching JWKS from localhost — so intermittent external connectivity
 * can't turn verification into a false 401. Verification against the REAL
 * Managed Auth JWKS plus the sign-up/sign-in flows are covered by
 * `npm run neon:e2e` (and were verified live against the deployed function
 * in the same audit). The only remaining external dependency here is the
 * database, which these routes genuinely query; phase 1 ends by deleting the
 * synthetic user's rows through the app's own DELETE /api/me.
 *
 * Fixtures only: the fake provider key and admin password are LOCAL test
 * values, never real credentials. Nothing here prints secrets.
 */
import { registerHooks } from 'node:module';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';

// Extension-resolving hook: the app's sources use Metro-style extensionless
// relative imports (./admin, ../../src/lib/aiCore) that plain Node ESM
// rejects. Resolves them to .ts; everything else passes through untouched.
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (err) {
      if (
        (specifier.startsWith('./') || specifier.startsWith('../')) &&
        !/\.[cm]?[jt]s$/.test(specifier)
      ) {
        for (const suffix of ['.ts', '/index.ts', '.js', '.mjs']) {
          try {
            return nextResolve(specifier + suffix, context);
          } catch {
            /* try the next suffix */
          }
        }
      }
      throw err;
    }
  },
});

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

/* ── shared assertion helpers (child phases) ─────────────────────────────── */

let pass = 0;
let fail = 0;
const ok = (label, cond, detail = '') => {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    fail += 1;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
};
const jsonOf = (res) => res.json().catch(() => null);

const FAKE_KEY = 'sk-local-smoke-fixture-key';
const ADMIN_PASS = 'local-smoke-admin';
const basic = (user, passw) => 'Basic ' + Buffer.from(`${user}:${passw}`).toString('base64');

/* ── fake AI provider (phase 2): validates the wire contract, then obeys ─── */

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

function startFakeProvider() {
  const server = http.createServer(async (req, res) => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    try {
      if ((req.url ?? '').endsWith('/chat/completions')) {
        if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) return send(401, { error: 'bad key' });
        const body = JSON.parse((await readBody(req)).toString() || '{}');
        const sysMsg = (body.messages ?? []).find((m) => m.role === 'system');
        const last = String(body.messages?.at(-1)?.content ?? '');
        // The function MUST forward a real system prompt built by aiCore —
        // otherwise answer 400, which the app turns into a visible 502.
        if (!body.model || !sysMsg || !/You ALWAYS reply in/.test(String(sysMsg.content))) {
          return send(400, { error: 'fake-provider: model/system-prompt wiring broken' });
        }
        if (last.includes('SCENARIO:provider401')) return send(401, { error: 'simulated key rejection' });
        let content;
        if (last.includes('SCENARIO:wrongscript')) {
          content = JSON.stringify({ reply: 'hello there', translation: 'hi' });
        } else if (last.includes('SCENARIO:empty')) {
          content = JSON.stringify({ reply: '', translation: '' });
        } else if (last.includes('SCENARIO:plain')) {
          content = '¿Cómo estás hoy?';
        } else {
          content = JSON.stringify({
            reply: '¡Hola! ¿Cómo estás?',
            translation: 'Hi! How are you?',
            tip: 'Smile',
          });
        }
        return send(200, { choices: [{ message: { content } }] });
      }
      if ((req.url ?? '').endsWith('/audio/transcriptions')) {
        if (req.headers.authorization !== `Bearer ${FAKE_KEY}`) return send(401, { error: 'bad key' });
        const form = await new Response(await readBody(req), {
          headers: { 'content-type': req.headers['content-type'] ?? '' },
        }).formData();
        const file = form.get('file');
        const contractOk =
          file instanceof Blob &&
          file.size > 0 &&
          form.get('model') === 'whisper-1' &&
          form.get('response_format') === 'json' &&
          form.get('language') === 'es';
        if (!contractOk) return send(400, { error: 'fake-provider: unexpected multipart fields' });
        return send(200, { text: 'hola del proveedor' });
      }
      send(404, { error: 'not found' });
    } catch (err) {
      send(500, { error: String(err && err.message ? err.message : err) });
    }
  });
  return new Promise((res) => {
    server.listen(0, '127.0.0.1', () => {
      res({ server, url: `http://127.0.0.1:${server.address().port}/v1` });
    });
  });
}

async function deadProviderUrl() {
  const probe = http.createServer();
  await new Promise((res) => probe.listen(0, '127.0.0.1', res));
  const port = probe.address().port;
  await new Promise((res) => probe.close(res));
  return `http://127.0.0.1:${port}/v1`;
}

/* ── phase 1: no AI key — auth, honest status, CORS, admin gate ──────────── */

async function phaseNoAi(app, jwt) {
  const bearer = { Authorization: `Bearer ${jwt}` };

  const health = await app.request('/');
  const healthBody = await jsonOf(health);
  ok(
    'health: GET / reaches Postgres',
    health.status === 200 && healthBody?.ok === true && healthBody?.service === 'zelvoca-api',
    `status ${health.status}`
  );

  const noAuth = await app.request('/api/state');
  const noAuthBody = await jsonOf(noAuth);
  ok(
    'auth: /api/* without a bearer token is 401 Unauthorized',
    noAuth.status === 401 && noAuthBody?.error === 'Unauthorized'
  );

  const badJwt = await app.request('/api/state', {
    headers: { Authorization: 'Bearer not.a.jwt' },
  });
  ok('auth: garbage JWT is rejected', badJwt.status === 401);

  const status = await app.request('/api/ai/status', { headers: bearer });
  const statusBody = await jsonOf(status);
  ok(
    'status: with no AI_API_KEY the function reports {chat:false, stt:false}',
    status.status === 200 && statusBody?.chat === false && statusBody?.stt === false,
    JSON.stringify(statusBody)
  );

  const chat503 = await app.request('/api/ai/chat', {
    method: 'POST',
    headers: { ...bearer, 'content-type': 'application/json' },
    body: JSON.stringify({ languageId: 'es', history: [{ role: 'user', text: 'hola' }] }),
  });
  const chat503Body = await jsonOf(chat503);
  ok(
    'chat: without a key → 503 ai-not-configured (no fabricated reply)',
    chat503.status === 503 && chat503Body?.error === 'ai-not-configured'
  );

  const stt503 = await app.request('/api/ai/stt', { method: 'POST', headers: bearer });
  const stt503Body = await jsonOf(stt503);
  ok(
    'stt: without a key → 503 ai-not-configured',
    stt503.status === 503 && stt503Body?.error === 'ai-not-configured'
  );

  /* CORS: origin allowlist + the DELETE preflight that once broke. */
  const preflight = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://zelvoca-kappa.vercel.app',
      'Access-Control-Request-Method': 'DELETE',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  const pAcao = preflight.headers.get('access-control-allow-origin');
  const pMethods = (preflight.headers.get('access-control-allow-methods') ?? '').toUpperCase();
  const pHeaders = (preflight.headers.get('access-control-allow-headers') ?? '').toLowerCase();
  ok(
    'cors: DELETE preflight from a Vercel origin is allowed',
    preflight.status === 204 &&
      pAcao === 'https://zelvoca-kappa.vercel.app' &&
      pMethods.includes('DELETE') &&
      pHeaders.includes('authorization'),
    `status ${preflight.status}, methods [${pMethods}]`
  );

  const productionHostPreflight = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://nativa-kappa.vercel.app',
      'Access-Control-Request-Method': 'DELETE',
    },
  });
  ok(
    'cors: the current Nativa production hostname is trusted',
    productionHostPreflight.headers.get('access-control-allow-origin') ===
      'https://nativa-kappa.vercel.app'
  );

  const babelishPreviewPreflight = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://babelish-git-main-apdowjr.vercel.app',
      'Access-Control-Request-Method': 'DELETE',
    },
  });
  ok(
    'cors: Babelish preview host is trusted',
    babelishPreviewPreflight.headers.get('access-control-allow-origin') ===
      'https://babelish-git-main-apdowjr.vercel.app'
  );

  const unrelatedVercelPreflight = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://attacker-project.vercel.app',
      'Access-Control-Request-Method': 'DELETE',
    },
  });
  ok(
    'cors: unrelated Vercel project is not trusted',
    unrelatedVercelPreflight.headers.get('access-control-allow-origin') === null
  );

  for (const origin of [
    'https://nativa-attacker-project.vercel.app',
    'https://babelish-attacker-project.vercel.app',
    'https://nativa--attacker.vercel.app',
  ]) {
    const response = await app.request('/api/me', {
      method: 'OPTIONS',
      headers: { Origin: origin, 'Access-Control-Request-Method': 'DELETE' },
    });
    ok(`cors: unregistered branded-looking host is rejected (${origin})`,
      response.headers.get('access-control-allow-origin') === null);
  }

  const currentBabelishDeployment = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://babelish-k70kemy23-ururka-lp.vercel.app',
      'Access-Control-Request-Method': 'DELETE',
    },
  });
  ok(
    'cors: current Babelish deployment hostname is trusted',
    currentBabelishDeployment.headers.get('access-control-allow-origin') ===
      'https://babelish-k70kemy23-ururka-lp.vercel.app'
  );

  const evilPreflight = await app.request('/api/me', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'DELETE',
    },
  });
  ok(
    'cors: unknown origin gets NO allow-origin header',
    evilPreflight.headers.get('access-control-allow-origin') === null
  );

  const devPreflight = await app.request('/api/ai/chat', {
    method: 'OPTIONS',
    headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST' },
  });
  ok(
    'cors: localhost dev origin is echoed',
    devPreflight.headers.get('access-control-allow-origin') === 'http://localhost:8081'
  );

  const trustedActual = await app.request('/api/state', {
    headers: { ...bearer, Origin: 'https://zelvoca.app' },
  });
  ok(
    'cors: trusted origin on an actual response is echoed',
    trustedActual.status === 200 &&
      trustedActual.headers.get('access-control-allow-origin') === 'https://zelvoca.app'
  );

  const evilActual = await app.request('/api/state', {
    headers: { ...bearer, Origin: 'https://evil.example' },
  });
  ok(
    'cors: unknown origin on an actual response gets no allow-origin header',
    evilActual.headers.get('access-control-allow-origin') === null,
    `status ${evilActual.status}`
  );

  const evilNoAuth = await app.request('/api/state', { headers: { Origin: 'https://evil.example' } });
  ok(
    'cors+auth: unknown origin without a JWT is 401 with no allow-origin header',
    evilNoAuth.status === 401 && evilNoAuth.headers.get('access-control-allow-origin') === null
  );

  /* Admin gate: challenge, failure limiter, per-IP isolation, pass-through. */
  const challenge = await app.request('/admin');
  ok(
    'admin: no credentials → 401 with a Basic challenge',
    challenge.status === 401 &&
      (challenge.headers.get('www-authenticate') ?? '').includes('zelvoca-admin')
  );

  let badHits = 0;
  for (let i = 0; i < 10; i++) {
    const r = await app.request('/admin', {
      headers: {
        Authorization: basic('admin', 'wrong-password-123'),
        'x-forwarded-for': '203.0.113.9',
      },
    });
    if (r.status === 401) badHits += 1;
  }
  ok('admin: 10 failed Basic attempts are each answered 401', badHits === 10, `${badHits}/10`);

  const blocked = await app.request('/admin', {
    headers: { Authorization: basic('admin', 'wrong-password-123'), 'x-forwarded-for': '203.0.113.9' },
  });
  const blockedText = await blocked.text();
  ok(
    'admin: 11th failed attempt from the same IP is 429',
    blocked.status === 429 && /Too many failed attempts/.test(blockedText)
  );

  const blockedGoodCreds = await app.request('/admin', {
    headers: { Authorization: basic('admin', ADMIN_PASS), 'x-forwarded-for': '203.0.113.9' },
  });
  ok(
    'admin: the failure budget blocks even correct credentials for that IP',
    blockedGoodCreds.status === 429
  );

  const otherIpOk = await app.request('/admin', {
    headers: { Authorization: basic('admin', ADMIN_PASS), 'x-forwarded-for': '203.0.113.10' },
  });
  const otherIpBody = await otherIpOk.text();
  ok(
    'admin: correct credentials from a different IP render the dashboard',
    otherIpOk.status === 200 && /<html|<!doctype/i.test(otherIpBody),
    `status ${otherIpOk.status}`
  );

  /* Cleanup: the synthetic user's rows, via the app's own GDPR route. */
  const del = await app.request('/api/me', { method: 'DELETE', headers: bearer });
  const delBody = await jsonOf(del);
  ok(
    'cleanup: DELETE /api/me answers 200 with per-table removal counts',
    del.status === 200 && delBody && typeof delBody.deleted === 'object',
    `status ${del.status}`
  );
}

/* ── phase 2: AI key + local fake provider — scenarios and budgets ───────── */

async function phaseFakeProvider(app, jwt) {
  const bearer = { Authorization: `Bearer ${jwt}` };
  const chat = (body) =>
    app.request('/api/ai/chat', {
      method: 'POST',
      headers: { ...bearer, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  const happy = (text = 'Hello tutor') => ({ languageId: 'es', history: [{ role: 'user', text }] });
  const sttHappy = () => {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }), 'speech.webm');
    form.append('language', 'es');
    return app.request('/api/ai/stt', { method: 'POST', headers: bearer, body: form });
  };

  const status = await jsonOf(await app.request('/api/ai/status', { headers: bearer }));
  ok(
    'status: with a key the function reports {chat:true, stt:true}',
    status?.chat === true && status?.stt === true,
    JSON.stringify(status)
  );

  const r1 = await chat(happy());
  const b1 = await jsonOf(r1);
  ok(
    'chat: happy path returns the parsed reply + translation + tip',
    r1.status === 200 &&
      b1?.reply === '¡Hola! ¿Cómo estás?' &&
      b1?.translation === 'Hi! How are you?' &&
      b1?.tip === 'Smile',
    `status ${r1.status}`
  );

  const r2 = await chat({ languageId: 'ar', history: [{ role: 'user', text: 'SCENARIO:wrongscript' }] });
  const b2 = await jsonOf(r2);
  ok(
    'chat: Latin reply for an Arabic target → 502 bad-reply (script guard)',
    r2.status === 502 && b2?.error === 'bad-reply' && /wrong script/.test(b2?.message ?? ''),
    `status ${r2.status}`
  );

  const r3 = await chat({ ...happy(), history: [{ role: 'user', text: 'SCENARIO:empty' }] });
  const b3 = await jsonOf(r3);
  ok(
    'chat: empty model reply → 502 bad-reply, never demo substitution',
    r3.status === 502 && b3?.error === 'bad-reply' && /empty reply/.test(b3?.message ?? '')
  );

  const r4 = await chat({ ...happy(), history: [{ role: 'user', text: 'SCENARIO:plain' }] });
  const b4 = await jsonOf(r4);
  ok(
    'chat: non-JSON plain-text reply is passed through',
    r4.status === 200 && b4?.reply === '¿Cómo estás hoy?' && b4?.translation === ''
  );

  const r5 = await chat({ ...happy(), history: [{ role: 'user', text: 'SCENARIO:provider401' }] });
  const b5 = await jsonOf(r5);
  ok(
    'chat: provider 401 → 502 with the honest rejected-key message',
    r5.status === 502 && /rejected its key/.test(b5?.message ?? '')
  );

  const r6 = await chat({ languageId: 'xx', history: [{ role: 'user', text: 'hi' }] });
  const b6 = await jsonOf(r6);
  ok(
    'chat: unknown languageId → 400 invalid-request',
    r6.status === 400 && b6?.error === 'invalid-request' && /supported languages/.test(b6?.message ?? '')
  );

  const s1 = await sttHappy();
  const s1Body = await jsonOf(s1);
  ok(
    'stt: multipart contract (file+model+response_format+language) → 200 transcript',
    s1.status === 200 && s1Body?.text === 'hola del proveedor',
    `status ${s1.status}`
  );

  const noFile = new FormData();
  noFile.append('language', 'es');
  const s2 = await app.request('/api/ai/stt', { method: 'POST', headers: bearer, body: noFile });
  const s2Body = await jsonOf(s2);
  ok(
    'stt: missing file → 400',
    s2.status === 400 && /Missing audio file/.test(s2Body?.message ?? '')
  );

  const emptyForm = new FormData();
  emptyForm.append('file', new Blob([], { type: 'audio/webm' }), 'speech.webm');
  emptyForm.append('language', 'es');
  const s3 = await app.request('/api/ai/stt', { method: 'POST', headers: bearer, body: emptyForm });
  const s3Body = await jsonOf(s3);
  ok('stt: zero-byte recording → 400', s3.status === 400 && /came out empty/.test(s3Body?.message ?? ''));

  const bigForm = new FormData();
  bigForm.append(
    'file',
    new Blob([new Uint8Array(8 * 1024 * 1024 + 1)], { type: 'audio/webm' }),
    'speech.webm'
  );
  bigForm.append('language', 'es');
  const s4 = await app.request('/api/ai/stt', { method: 'POST', headers: bearer, body: bigForm });
  const s4Body = await jsonOf(s4);
  ok('stt: >8MB recording → 413', s4.status === 413 && /Recording too long/.test(s4Body?.message ?? ''));

  /* Budgets: chat took 6 (5 scenarios + 1 invalid), STT took 4. */
  let chatOk = 0;
  for (let i = 0; i < 14; i++) {
    const r = await chat(happy(`budget loop ${i}`));
    if (r.status === 200) chatOk += 1;
  }
  ok('chat: messages 7..20 of the 20/min budget succeed', chatOk === 14, `${chatOk}/14`);

  const chat21 = await chat(happy('should be limited'));
  const chat21Body = await jsonOf(chat21);
  ok(
    'chat: the 21st message in the window is 429 rate-limited',
    chat21.status === 429 && chat21Body?.error === 'rate-limited',
    `status ${chat21.status}`
  );
  const chat22 = await chat(happy('still limited'));
  ok('chat: the limiter keeps refusing for the rest of the window', chat22.status === 429);

  let sttOk = 0;
  for (let i = 0; i < 6; i++) {
    const r = await sttHappy();
    if (r.status === 200) sttOk += 1;
  }
  ok('stt: transcriptions 5..10 of the 10/min budget succeed', sttOk === 6, `${sttOk}/6`);

  const stt11 = await sttHappy();
  const stt11Body = await jsonOf(stt11);
  ok(
    'stt: the 11th transcription in the window is 429 rate-limited',
    stt11.status === 429 && stt11Body?.error === 'rate-limited'
  );
}

/* ── phase 3: AI key but unreachable provider — honest 502 ───────────────── */

async function phaseDeadProvider(app, jwt) {
  const bearer = { Authorization: `Bearer ${jwt}` };

  const status = await jsonOf(await app.request('/api/ai/status', { headers: bearer }));
  ok('status: configured-but-unreachable still reports ready', status?.chat === true);

  const r1 = await app.request('/api/ai/chat', {
    method: 'POST',
    headers: { ...bearer, 'content-type': 'application/json' },
    body: JSON.stringify({ languageId: 'es', history: [{ role: 'user', text: 'hola' }] }),
  });
  const b1 = await jsonOf(r1);
  ok(
    'chat: dead provider → 502 upstream-failed with a user-facing message',
    r1.status === 502 && b1?.error === 'upstream-failed' && /hit a problem/.test(b1?.message ?? ''),
    `status ${r1.status}`
  );

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array([1])], { type: 'audio/webm' }), 'speech.webm');
  form.append('language', 'es');
  const r2 = await app.request('/api/ai/stt', { method: 'POST', headers: bearer, body: form });
  const b2 = await jsonOf(r2);
  ok('stt: dead provider → 502 upstream-failed', r2.status === 502 && b2?.error === 'upstream-failed');
}


/* ── phase 4: custom chat provider without STT capability ─────────────────── */

async function phaseChatOnlyProvider(app, jwt) {
  const bearer = { Authorization: `Bearer ${jwt}` };
  const statusResponse = await app.request('/api/ai/status', { headers: bearer });
  const status = await jsonOf(statusResponse);
  ok(
    'status: custom provider without STT opt-in reports {chat:true, stt:false}',
    statusResponse.status === 200 && status?.chat === true && status?.stt === false,
    JSON.stringify(status)
  );

  const stt = await app.request('/api/ai/stt', { method: 'POST', headers: bearer });
  const body = await jsonOf(stt);
  ok(
    'stt: custom provider without STT opt-in returns 503 ai-stt-not-configured',
    stt.status === 503 && body?.error === 'ai-stt-not-configured'
  );
}

/* ── child dispatcher ────────────────────────────────────────────────────── */

async function runPhase(phase) {
  const env = loadEnvLocal();
  for (const [k, v] of Object.entries(env)) process.env[k] = v;

  let fake = null;
  if (phase === 1) {
    delete process.env.AI_API_KEY;
    delete process.env.AI_API_URL;
    delete process.env.AI_STT_ENABLED;
    process.env.ADMIN_PASSWORD = ADMIN_PASS;
    process.env.ADMIN_USERNAME = 'admin';
  } else if (phase === 2) {
    fake = await startFakeProvider();
    process.env.AI_API_KEY = FAKE_KEY;
    process.env.AI_API_URL = fake.url;
    process.env.AI_STT_ENABLED = 'true';
  } else if (phase === 3) {
    process.env.AI_API_KEY = FAKE_KEY;
    process.env.AI_API_URL = await deadProviderUrl();
    process.env.AI_STT_ENABLED = 'true';
  } else if (phase === 4) {
    fake = await startFakeProvider();
    process.env.AI_API_KEY = FAKE_KEY;
    process.env.AI_API_URL = fake.url;
    delete process.env.AI_STT_ENABLED;
  }

  // Local JWKS for the parent's locally minted JWT (a public key — never a
  // secret). Overrides the real URL from .env.local before the app loads.
  if (process.env.SMOKE_JWK) {
    const jwk = JSON.parse(process.env.SMOKE_JWK);
    const jwksServer = http.createServer((req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ keys: [jwk] }));
    });
    await new Promise((res) => jwksServer.listen(0, '127.0.0.1', res));
    process.env.NEON_AUTH_JWKS_URL = `http://127.0.0.1:${jwksServer.address().port}/jwks.json`;
  }

  const { default: app } = await import('../functions/api/index.ts');
  const jwt = process.env.SMOKE_JWT;
  if (!jwt) throw new Error('SMOKE_JWT missing');

  const titles = {
    1: 'Phase 1 — no AI key: auth, honest status, CORS, admin gate',
    2: 'Phase 2 — fake provider: scenarios, multipart contract, rate budgets',
    3: 'Phase 3 — dead provider: honest upstream failures',
    4: 'Phase 4 — chat-only provider: STT stays unavailable',
  };
  console.log(`\n── ${titles[phase]} ${'─'.repeat(Math.max(0, 60 - titles[phase].length))}`);
  try {
    if (phase === 1) await phaseNoAi(app, jwt);
    else if (phase === 2) await phaseFakeProvider(app, jwt);
    else if (phase === 3) await phaseDeadProvider(app, jwt);
    else if (phase === 4) await phaseChatOnlyProvider(app, jwt);
  } finally {
    if (fake) fake.server.close();
  }
  console.log(
    `  ${fail === 0 ? `✅ phase ${phase}: ${pass}/${pass} checks passed` : `❌ phase ${phase}: ${fail} failed, ${pass} passed`}`
  );
  process.exit(fail === 0 ? 0 : 1);
}

/* ── parent: sign a throwaway local JWT, run the three phases ────────────── */

async function parent() {
  const env = loadEnvLocal();
  const auth = (env.NEON_AUTH_BASE_URL ?? '').replace(/\/+$/, '');
  if (!auth) {
    console.error('Missing NEON_AUTH_BASE_URL in .env.local');
    process.exit(2);
  }

  // Self-contained auth: an EdDSA keypair whose JWKS each child serves on
  // localhost. The issuer string still comes from the real config, so the
  // function's issuer check runs against exactly what production uses.
  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { extractable: true });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'zelvoca-smoke-key', alg: 'EdDSA', use: 'sig' };
  const jwt = await new SignJWT({ sub: `smoke-${Date.now()}-${Math.floor(Math.random() * 1e6)}` })
    .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid })
    .setIssuer(new URL(auth).origin)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(privateKey);

  console.log('── Local api Function smoke (source import, local JWT, no deploy) ──');

  const flags = ['--experimental-strip-types', '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'];
  const script = fileURLToPath(import.meta.url);
  const results = [];
  for (const phase of [1, 2, 3, 4]) {
    const run = spawnSync(process.execPath, [...flags, script], {
      env: {
        ...process.env,
        SMOKE_PHASE: String(phase),
        SMOKE_JWT: jwt,
        SMOKE_JWK: JSON.stringify(jwk),
      },
      stdio: 'inherit',
    });
    results.push({ phase, status: run.status ?? 1 });
  }

  const failed = results.filter((r) => r.status !== 0);
  if (failed.length === 0) {
    console.log('\n✔ local smoke: all 4 phases passed');
    process.exit(0);
  }
  console.error(`\n✘ local smoke FAILED: ${failed.map((r) => `phase ${r.phase}`).join(', ')}`);
  process.exit(1);
}

if (process.env.SMOKE_PHASE) {
  await runPhase(Number(process.env.SMOKE_PHASE));
} else {
  await parent();
}
