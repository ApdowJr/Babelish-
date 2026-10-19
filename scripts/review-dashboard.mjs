#!/usr/bin/env node
/**
 * Local review dashboard — the Phase 4 human-approval gate, runnable today
 * without deploying anything. Serves the SAME shared logic the `api` Function
 * exposes at /admin (functions/api/admin.ts) straight against DATABASE_URL.
 *
 * Run:   npm run review:dashboard       → http://127.0.0.1:8788/admin
 * Auth:  HTTP Basic — admin / $ADMIN_PASSWORD (default "babelish", localhost only)
 *
 * Reads .env.local (written by `neon deploy`). Never prints secrets.
 */
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import {
  approveDraft,
  ensureSchema,
  fetchDashboard,
  insertDraft,
  rejectDraft,
  renderDashboard,
  renderMessage,
  resolveReport,
  validateChapterPayload,
} from '../functions/api/admin.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
    }
  } catch {
    /* .env.local optional — DATABASE_URL may come from the shell */
  }
  return env;
}

const env = { ...loadEnvLocal(), ...process.env };
const DATABASE = env.DATABASE_URL;
if (!DATABASE) {
  console.error('Missing DATABASE_URL (shell or .env.local) — cannot start the dashboard.');
  process.exit(2);
}

const USER = env.ADMIN_USERNAME ?? 'admin';
const PASS = env.ADMIN_PASSWORD ?? 'babelish';
// Not PORT — this environment may export one for other services.
const PORT = Number(env.DASHBOARD_PORT ?? 8788);

const pool = new Pool({ connectionString: DATABASE, max: 4 });
const q = async (text, params) => pool.query(text, params);

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function readBody(req, limit = 1_000_000) {
  return new Promise((resolvePromise, rejectPromise) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > limit) rejectPromise(new Error('Body too large'));
    });
    req.on('end', () => resolvePromise(data));
    req.on('error', rejectPromise);
  });
}

const redirect = (res, params) => {
  const search = new URLSearchParams(params);
  res.writeHead(303, { Location: `/admin${search.toString() ? `?${search}` : ''}` });
  res.end();
};

const html = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);

    // HTTP Basic gate (same contract as the Function).
    const auth = req.headers.authorization ?? '';
    if (!auth.startsWith('Basic ')) {
      html(res, 401, renderMessage('Auth required', 'Send HTTP Basic credentials to continue.'), {
        'WWW-Authenticate': 'Basic realm="babelish-admin", charset="UTF-8"',
      });
      return;
    }
    const decoded = Buffer.from(auth.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    if (!safeEqual(decoded.slice(0, split), USER) || !safeEqual(decoded.slice(split + 1), PASS)) {
      html(res, 401, renderMessage('Invalid credentials', 'Wrong username or password.'), {
        'WWW-Authenticate': 'Basic realm="babelish-admin", charset="UTF-8"',
      });
      return;
    }

    const path = url.pathname;
    const method = req.method ?? 'GET';

    if ((path === '/' || path === '/admin') && method === 'GET') {
      const data = await fetchDashboard(q);
      html(
        res,
        200,
        renderDashboard(data, {
          flash: url.searchParams.get('flash') ?? undefined,
          error: url.searchParams.get('error') ?? undefined,
        })
      );
      return;
    }

    if (path === '/admin/drafts' && method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      const title = String(form.get('title') ?? '').trim().slice(0, 160);
      const languageId = String(form.get('language_id') ?? '').trim().slice(0, 12);
      const cefr = String(form.get('cefr') ?? 'A1').trim().slice(0, 3);
      const source = form.get('source') === 'human' ? 'human' : 'ai';
      let payload = null;
      try {
        payload = JSON.parse(String(form.get('payload') ?? ''));
      } catch {
        redirect(res, { error: 'payload is not valid JSON' });
        return;
      }
      if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageId) || !title) {
        redirect(res, { error: 'language_id (e.g. es) and title are required' });
        return;
      }
      const valid = validateChapterPayload(payload);
      if (!valid.ok) {
        redirect(res, { error: valid.error });
        return;
      }
      await insertDraft(q, { languageId, title, cefr, source, payload });
      redirect(res, { flash: 'Draft submitted — it stays unpublished until approved.' });
      return;
    }

    const draftMatch = path.match(/^\/admin\/drafts\/(cd_[0-9a-f]{12})$/);
    if (draftMatch && method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      const action = String(form.get('action') ?? '');
      const note = String(form.get('note') ?? '').trim().slice(0, 300) || undefined;
      if (action === 'approve') {
        const result = await approveDraft(q, draftMatch[1], USER, note);
        redirect(
          res,
          result.ok ? { flash: `Approved → version ${result.version} recorded` } : { error: result.error ?? 'Approve failed' }
        );
        return;
      }
      if (action === 'reject') {
        const result = await rejectDraft(q, draftMatch[1], USER, note);
        redirect(res, result.ok ? { flash: 'Draft rejected' } : { error: result.error ?? 'Reject failed' });
        return;
      }
      redirect(res, { error: 'Unknown action' });
      return;
    }

    const reportMatch = path.match(/^\/admin\/reports\/(lr_[0-9a-f]{12})$/);
    if (reportMatch && method === 'POST') {
      const form = new URLSearchParams(await readBody(req));
      const note = String(form.get('note') ?? '').trim().slice(0, 300);
      const result = await resolveReport(q, reportMatch[1], note);
      redirect(res, result.ok ? { flash: 'Report resolved' } : { error: result.error ?? 'Resolve failed' });
      return;
    }

    html(res, 404, renderMessage('Not found', `No route for ${method} ${path}`));
  } catch (err) {
    html(res, 500, renderMessage('Dashboard error', err instanceof Error ? err.message : String(err)));
  }
});

await ensureSchema(q);
server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🔎 Babelish review dashboard → http://127.0.0.1:${PORT}/admin`);
  console.log(`   Basic auth: ${USER} / ${env.ADMIN_PASSWORD ? '$ADMIN_PASSWORD' : 'babelish (default, localhost only)'}`);
  console.log('   Ctrl+C to stop\n');
});
