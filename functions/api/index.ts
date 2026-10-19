import { Hono } from 'hono';
import type { Context } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Pool } from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  approveDraft,
  deleteUserData,
  ensureSchema,
  fetchDashboard,
  insertDraft,
  insertReport,
  rejectDraft,
  renderDashboard,
  renderMessage,
  resolveReport,
  validateChapterPayload,
  validateReport,
  type QueryFn,
} from './admin';
import * as league from './league';
import { createFailureLimiter, createLimiter } from './rateLimit';
import { buildSystemPrompt, extractTutorReply, parseAiChatRequest } from '../../src/lib/aiCore';
import { getLanguage } from '../../src/data/languages';

/**
 * Zelvoca API — the mobile app's backend, running on the same branch as the
 * database. Auth: Managed Better Auth JWTs (EdDSA) verified against the
 * branch's injected JWKS. The user id is always the JWT `sub` claim — never
 * a request-supplied value — so callers can only touch their own rows.
 */

const jwks = createRemoteJWKSet(new URL(process.env.NEON_AUTH_JWKS_URL!));
const issuer = new URL(process.env.NEON_AUTH_BASE_URL!).origin;
const BUCKET = 'assets';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
attachDatabasePool(pool);

// Neon Object Storage is path-style S3; creds/endpoint/region come from the
// injected AWS_* environment variables.
const s3 = new S3Client({ forcePathStyle: true });

type Env = { Variables: { userId: string } };
const app = new Hono<Env>();

/** Structural adapter so admin helpers stay driver-agnostic. */
const q: QueryFn = async (text, params) => pool.query(text, params);

/** Content tables are created on first use (idempotent, guarded). */
let schemaReady: Promise<void> | null = null;
function ensureContentSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = ensureSchema(q).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

/** Same guard pattern for the leaderboard table. */
let leagueReady: Promise<void> | null = null;
function ensureLeagueSchema(): Promise<void> {
  if (!leagueReady) {
    leagueReady = league.ensureSchema(q).catch((err) => {
      leagueReady = null;
      throw err;
    });
  }
  return leagueReady;
}

/** Constant-time string compare for the admin credential. */
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/**
 * HTTP Basic gate for /admin (the review dashboard). Uses ADMIN_USERNAME /
 * ADMIN_PASSWORD from the Function environment — never a client-supplied id.
 * Returns a ready Response to send, or null when access is allowed.
 */
/** Failed-attempt budget for Basic-auth guessing (per client IP when known). */
const adminFailLimiter = createFailureLimiter(10, 10 * 60_000);

async function adminGate(c: Context): Promise<Response | null> {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    return c.html(
      renderMessage(
        'Admin not configured',
        'Set ADMIN_PASSWORD (and optionally ADMIN_USERNAME) in the Function environment, then redeploy.'
      ),
      503
    );
  }
  // Fail-open when the platform exposes no client IP: better to serve the
  // admin than to collapse every operator into one shared bucket.
  const clientIp = (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim();
  if (clientIp && adminFailLimiter.blocked(clientIp)) {
    return c.text('Too many failed attempts — try again in 10 minutes.', 429);
  }
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('basic ')) {
    c.header('WWW-Authenticate', 'Basic realm="zelvoca-admin", charset="UTF-8"');
    return c.text('Auth required', 401);
  }
  let user = '';
  let pass = '';
  try {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const split = decoded.indexOf(':');
    user = decoded.slice(0, split);
    pass = decoded.slice(split + 1);
  } catch {
    /* fall through to 401 */
  }
  const wantUser = process.env.ADMIN_USERNAME ?? 'admin';
  if (!safeEqual(user, wantUser) || !safeEqual(pass, password)) {
    if (clientIp) adminFailLimiter.hit(clientIp);
    c.header('WWW-Authenticate', 'Basic realm="zelvoca-admin", charset="UTF-8"');
    return c.text('Invalid credentials', 401);
  }
  return null;
}

/** 303 back to the dashboard with a flash or error message (HTML-escaped on render). */
function backTo(c: Context, params: Record<string, string>): Response {
  const search = new URLSearchParams(params);
  return c.redirect(`/admin${search.toString() ? `?${search}` : ''}`, 303);
}

/**
 * CORS: reflect only Zelvoca's own web origins — the custom domain, Vercel
 * previews and localhost/private-network dev — so an unrelated site can't
 * read API responses in a browser. Requests with no Origin header (the native
 * app, curl) aren't browser-CORS-governed and pass through untouched; auth
 * still requires a valid JWT either way.
 */
const TRUSTED_WEB_ORIGIN = /^https:\/\/(?:(?:[a-z0-9-]+\.)*(?:zelvoca|babelish)\.app|(?:nativa-kappa|nativa-ururka-lp|nativa-git-main-ururka-lp|zelvoca-kappa|babelish-git-main-apdowjr|babelish-[a-z0-9]{8,12}-ururka-lp)\.vercel\.app)$/i;
const DEV_WEB_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/i;

app.use(
  '*',
  cors({
    origin: (origin) => {
      if (!origin) return null;
      return TRUSTED_WEB_ORIGIN.test(origin) || DEV_WEB_ORIGIN.test(origin) ? origin : null;
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
  })
);

/** Health check: proves the function is up AND can reach Postgres. */
app.get('/', async (c) => {
  const { rows } = await pool.query('select now() as now');
  return c.json({ ok: true, service: 'zelvoca-api', branch: process.env.NEON_BRANCH, now: rows[0].now });
});

/** Every /api/* route requires a valid Managed Auth JWT. */
app.use('/api/*', async (c, next) => {
  const auth = c.req.header('authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const { payload } = await jwtVerify(auth.slice(7), jwks, { issuer });
    if (!payload.sub) throw new Error('missing sub');
    c.set('userId', payload.sub);
  } catch {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

/** Load the signed-in learner's synced progress + vocabulary. */
app.get('/api/state', async (c) => {
  const { rows } = await pool.query(
    'select progress, vocab, updated_at from app_state where user_id = $1',
    [c.get('userId')]
  );
  if (!rows[0]) return c.json({ progress: {}, vocab: {}, updatedAt: null });
  return c.json({
    progress: rows[0].progress,
    vocab: rows[0].vocab,
    updatedAt: rows[0].updated_at,
  });
});

/** Save (upsert) the learner's state. */
app.put('/api/state', async (c) => {
  const body = await c.req.json().catch(() => null);
  const progress =
    body?.progress && typeof body.progress === 'object' && !Array.isArray(body.progress)
      ? body.progress
      : {};
  const vocab =
    body?.vocab && typeof body.vocab === 'object' && !Array.isArray(body.vocab) ? body.vocab : {};
  const { rows } = await pool.query(
    `insert into app_state (user_id, progress, vocab, updated_at)
     values ($1, $2::jsonb, $3::jsonb, now())
     on conflict (user_id)
     do update set progress = $2::jsonb, vocab = $3::jsonb, updated_at = now()
     returning updated_at`,
    [c.get('userId'), JSON.stringify(progress), JSON.stringify(vocab)]
  );
  return c.json({ updatedAt: rows[0].updated_at });
});

/**
 * Learner reporting: "this sounds wrong" from any content surface. Queues a
 * review item for the human-approval process (see /admin dashboard).
 */
app.post('/api/reports', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = validateReport(body);
  if (!parsed.ok) return c.json({ error: parsed.error }, 400);
  await ensureContentSchema();
  const { id } = await insertReport(q, { userId: c.get('userId'), ...parsed.value });
  return c.json({ id, status: 'open' }, 201);
});

/**
 * Weekly leaderboard — privacy-first: the caller gets their own rank and the
 * field size, never another learner's identity. `week` is 'YYYY-Www'.
 */
app.get('/api/league', async (c) => {
  const week = c.req.query('week') ?? '';
  if (!league.WEEK_PATTERN.test(week)) return c.json({ error: 'Invalid week key' }, 400);
  await ensureLeagueSchema();
  const data = await league.fetchLeaderboard(q, week, c.get('userId'));
  return c.json({ week, ...data });
});

/** Reports the learner's absolute weekly XP (idempotent via greatest()). */
app.post('/api/league/xp', async (c) => {
  const body = await c.req.json<{ week?: string; xp?: number }>().catch(() => null);
  const week = body?.week ?? '';
  const xp = body?.xp;
  if (!league.WEEK_PATTERN.test(week)) return c.json({ error: 'Invalid week key' }, 400);
  if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0 || xp > 100000) {
    return c.json({ error: 'Invalid xp' }, 400);
  }
  await ensureLeagueSchema();
  const result = await league.claimWeeklyXp(q, c.get('userId'), week, Math.floor(xp));
  return c.json({ week, xp: result.xp });
});

/**
 * Account deletion, part 2 — erase the auth user itself through the Neon Auth
 * (Better Auth) admin API: sign in a dedicated ops admin, then
 * POST /admin/remove-user. Auth is the admin's session COOKIE (the sign-in
 * body token is a different value and is not accepted on /admin routes).
 * Env-gated by NEON_AUTH_ADMIN_EMAIL / NEON_AUTH_ADMIN_PASSWORD; when unset
 * (demo mode) the step is skipped and reported honestly as "not-configured".
 * Admin sessions are cached in memory for just under the JWT lifetime and
 * refreshed once on a 401.
 */
const SESSION_COOKIE = '__Secure-neon-auth.session_token';
let adminSession: { cookie: string; expiresAt: number } | null = null;

function authAdminConfigured(): boolean {
  return Boolean(
    process.env.NEON_AUTH_BASE_URL &&
      process.env.NEON_AUTH_ADMIN_EMAIL &&
      process.env.NEON_AUTH_ADMIN_PASSWORD
  );
}

async function signInAdmin(): Promise<string | null> {
  const base = process.env.NEON_AUTH_BASE_URL;
  const email = process.env.NEON_AUTH_ADMIN_EMAIL;
  const password = process.env.NEON_AUTH_ADMIN_PASSWORD;
  if (!base || !email || !password) return null;
  const res = await fetch(new URL(`${base}/sign-in/email`), {
    method: 'POST',
    // Better Auth requires an Origin header when callbackURL is absent.
    headers: { 'content-type': 'application/json', origin: base },
    body: JSON.stringify({ email, password, rememberMe: true }),
  });
  if (!res.ok) return null;
  const setCookies =
    typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const raw = setCookies.find((c) => c.includes('session_token=')) ?? '';
  const match = raw.match(/session_token=([^;]+)/);
  if (!match) return null;
  adminSession = { cookie: `${SESSION_COOKIE}=${match[1]}`, expiresAt: Date.now() + 13 * 60_000 };
  return adminSession.cookie;
}

async function adminSessionCookie(): Promise<string | null> {
  if (adminSession && adminSession.expiresAt > Date.now()) return adminSession.cookie;
  return signInAdmin();
}

export type AuthRemoval = 'removed' | 'already-gone' | 'not-configured' | 'failed';

/** Why the auth-user step failed — surfaced so operators can diagnose. */
let lastAuthRemovalDetail: string | null = null;

async function removeAuthUser(userId: string): Promise<AuthRemoval> {
  const base = process.env.NEON_AUTH_BASE_URL;
  if (!base || !authAdminConfigured()) return 'not-configured';
  for (let attempt = 0; attempt < 2; attempt++) {
    const cookie = await adminSessionCookie();
    if (!cookie) {
      lastAuthRemovalDetail = 'admin sign-in failed (credentials, origin header, or cookie parse)';
      return 'failed';
    }
    const res = await fetch(new URL(`${base}/admin/remove-user`), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        // remove-user is a state-changing route: it rejects requests without
        // an Origin header (MISSING_OR_NULL_ORIGIN), cookie auth or not.
        origin: base,
        cookie,
      },
      body: JSON.stringify({ userId }),
    });
    if (res.status === 401 && attempt === 0) {
      adminSession = null; // stale cached session — sign in once more
      continue;
    }
    if (res.ok) {
      lastAuthRemovalDetail = null;
      return 'removed';
    }
    if (res.status === 404) {
      lastAuthRemovalDetail = null;
      return 'already-gone'; // idempotent: user is gone
    }
    lastAuthRemovalDetail = `remove-user responded ${res.status}: ${(await res.text()).slice(0, 200)}`;
    return 'failed';
  }
  return 'failed';
}

/* ── AI proxy: chat + speech-to-text ─────────────────────────────────────
 * The provider key lives ONLY in this Function's environment (AI_API_KEY,
 * AI_API_URL, AI_MODEL, AI_STT_MODEL) — never in a client bundle. JWT-gated
 * by the /api/* middleware and rate-limited per user, because these routes
 * are the ones a provider bills. With no key configured they answer
 * 503 ai-not-configured so the client can fall back to an explicitly-labeled
 * demo mode instead of faking a live model.
 */
const AI_URL = (process.env.AI_API_URL ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
const AI_KEY = process.env.AI_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini';
const AI_STT_MODEL = process.env.AI_STT_MODEL ?? 'whisper-1';
// Custom OpenAI-compatible endpoints are not assumed to implement audio transcription.
// Explicitly opt in only when the configured provider supports /audio/transcriptions.
const AI_STT_ENABLED = process.env.AI_STT_ENABLED === 'true' || (!process.env.AI_API_URL && Boolean(AI_KEY));

const chatLimiter = createLimiter(20, 60_000); // messages per user / minute
const sttLimiter = createLimiter(10, 60_000); // transcriptions per user / minute

/** Capability report for the client's status rows — booleans only, no secrets. */
app.get('/api/ai/status', (c) =>
  c.json({ chat: Boolean(AI_KEY), stt: Boolean(AI_KEY && AI_STT_ENABLED) })
);

app.post('/api/ai/chat', async (c) => {
  if (!AI_KEY) return c.json({ error: 'ai-not-configured' }, 503);
  const userId = c.get('userId');
  if (!chatLimiter.take(userId)) {
    return c.json(
      { error: 'rate-limited', message: 'The tutor is busy — wait a minute and try again.' },
      429
    );
  }

  const body = await c.req.json().catch(() => null);
  const parsed = parseAiChatRequest(body);
  if (!parsed.ok) {
    return c.json({ error: 'invalid-request', message: parsed.error }, 400);
  }
  const language = getLanguage(parsed.request.languageId);
  if (!language) {
    return c.json({ error: 'invalid-request', message: 'Unknown language.' }, 400);
  }

  const sys = buildSystemPrompt({
    language,
    level: parsed.request.level ?? 'A2',
    scenarioTitle: parsed.request.scenarioTitle,
    learnerName: parsed.request.learnerName,
    profile: parsed.request.profile,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55_000);
  try {
    const upstream = await fetch(`${AI_URL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${AI_KEY}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: AI_MODEL,
        temperature: 0.8,
        messages: [
          { role: 'system', content: sys },
          ...parsed.request.history.map((m) => ({ role: m.role, content: m.text })),
        ],
      }),
    });
    if (!upstream.ok) {
      const detail =
        upstream.status === 401
          ? 'The AI provider rejected its key.'
          : `The AI provider returned HTTP ${upstream.status}.`;
      return c.json({ error: 'upstream-failed', message: `${detail} Try again later.` }, 502);
    }
    const data = (await upstream.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
    } | null;
    const raw = data?.choices?.[0]?.message?.content ?? '';

    // Strict validation: an empty reply or one in the wrong script is an
    // ERROR here — never replaced with scripted demo content in real mode.
    let reply: { text: string; translation: string; tip?: string };
    try {
      reply = extractTutorReply(raw, language);
    } catch (err) {
      return c.json(
        {
          error: 'bad-reply',
          message: err instanceof Error ? err.message : 'The tutor returned an invalid reply.',
        },
        502
      );
    }
    return c.json({ reply: reply.text, translation: reply.translation, tip: reply.tip });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return c.json(
        { error: 'upstream-timeout', message: 'The tutor took too long — try again.' },
        504
      );
    }
    return c.json(
      { error: 'upstream-failed', message: 'The tutor service hit a problem — try again.' },
      502
    );
  } finally {
    clearTimeout(timer);
  }
});

app.post('/api/ai/stt', async (c) => {
  if (!AI_KEY) return c.json({ error: 'ai-not-configured' }, 503);
  if (!AI_STT_ENABLED) return c.json({ error: 'ai-stt-not-configured' }, 503);
  const userId = c.get('userId');
  if (!sttLimiter.take(userId)) {
    return c.json(
      { error: 'rate-limited', message: 'Voice service is rate-limited — try again in a moment.' },
      429
    );
  }

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    return c.json(
      { error: 'invalid-request', message: 'Expected multipart/form-data audio.' },
      400
    );
  }

  const file = form.get('file');
  if (!file || typeof file === 'string' || !(file instanceof Blob)) {
    return c.json({ error: 'invalid-request', message: 'Missing audio file.' }, 400);
  }
  if (file.size === 0) {
    return c.json(
      { error: 'invalid-request', message: 'The recording came out empty — try again.' },
      400
    );
  }
  if (file.size > 8 * 1024 * 1024) {
    return c.json({ error: 'invalid-request', message: 'Recording too long.' }, 413);
  }
  const languageId = form.get('language');
  const filename =
    typeof (file as File).name === 'string' && (file as File).name
      ? (file as File).name
      : 'speech.webm';

  const outbound = new FormData();
  outbound.append('file', file, filename);
  outbound.append('model', AI_STT_MODEL);
  outbound.append('response_format', 'json');
  if (typeof languageId === 'string' && languageId) outbound.append('language', languageId);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch(`${AI_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${AI_KEY}` },
      body: outbound,
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const detail =
        upstream.status === 401
          ? 'The AI provider rejected its key.'
          : `The AI provider returned HTTP ${upstream.status}.`;
      return c.json({ error: 'upstream-failed', message: `${detail} Try again later.` }, 502);
    }
    const data = (await upstream.json().catch(() => null)) as { text?: string } | null;
    const text = String(data?.text ?? '').trim();
    if (!text) {
      return c.json(
        { error: 'empty-transcript', message: "I couldn't catch that — try again or type instead." },
        422
      );
    }
    return c.json({ text });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return c.json(
        { error: 'upstream-timeout', message: 'Transcription took too long — try again.' },
        504
      );
    }
    return c.json(
      { error: 'upstream-failed', message: 'Voice service hit a problem — try again.' },
      502
    );
  } finally {
    clearTimeout(timer);
  }
});

/**
 * Data deletion (Play "Delete account" policy + GDPR erasure): every row
 * keyed to the JWT's user id, across state, leaderboard and reports —
 * then the auth user itself (so the account can no longer sign in).
 * Returns the per-table removal counts and the auth-user outcome.
 */
app.delete('/api/me', async (c) => {
  await Promise.all([ensureContentSchema(), ensureLeagueSchema()]);
  const userId = c.get('userId');
  const removed = await deleteUserData(q, userId);
  const authUser = await removeAuthUser(userId);
  return c.json({ deleted: removed, authUser, authUserDetail: lastAuthRemovalDetail });
});

/** Presigned upload URL for a private object under the caller's own prefix. */
app.post('/api/storage/sign', async (c) => {
  const body = await c.req.json().catch(() => null);
  const name = body?.name;
  const contentType =
    typeof body?.contentType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(body.contentType)
      ? body.contentType
      : 'application/octet-stream';
  if (typeof name !== 'string' || !/^[\w.-]{1,120}$/.test(name)) {
    return c.json({ error: 'Invalid object name' }, 400);
  }
  const key = `users/${c.get('userId')}/${Date.now()}-${name}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 }
  );
  return c.json({ uploadUrl, key, contentType, expiresIn: 900 });
});

/** Presigned download URL — only for objects under the caller's prefix. */
app.get('/api/storage/url', async (c) => {
  const key = c.req.query('key');
  if (!key || !key.startsWith(`users/${c.get('userId')}/`)) {
    return c.json({ error: 'Invalid object key' }, 400);
  }
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: 3600,
  });
  return c.json({ url, expiresIn: 3600 });
});

/* ── Review dashboard (HTTP Basic, outside the JWT /api/* scope) ────── */

app.get('/admin', async (c) => {
  const gate = await adminGate(c);
  if (gate) return gate;
  await ensureContentSchema();
  const data = await fetchDashboard(q);
  const url = new URL(c.req.url);
  return c.html(
    renderDashboard(data, {
      flash: url.searchParams.get('flash') ?? undefined,
      error: url.searchParams.get('error') ?? undefined,
    })
  );
});

/** Submit a draft (paste-JSON form) → enters the approval queue, never publishes. */
app.post('/admin/drafts', async (c) => {
  const gate = await adminGate(c);
  if (gate) return gate;
  await ensureContentSchema();
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const title = String(form.title ?? '').trim().slice(0, 160);
  const languageId = String(form.language_id ?? '').trim().slice(0, 12);
  const cefr = String(form.cefr ?? 'A1').trim().slice(0, 3);
  const source = form.source === 'human' ? ('human' as const) : ('ai' as const);
  let payload: unknown = null;
  try {
    payload = JSON.parse(String(form.payload ?? ''));
  } catch {
    return backTo(c, { error: 'payload is not valid JSON' });
  }
  if (!/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageId) || !title) {
    return backTo(c, { error: 'language_id (e.g. es) and title are required' });
  }
  const valid = validateChapterPayload(payload);
  if (!valid.ok) return backTo(c, { error: valid.error });
  await insertDraft(q, { languageId, title, cefr, source, payload });
  return backTo(c, { flash: 'Draft submitted — it stays unpublished until approved.' });
});

/** Approve / reject a queued draft. Approval writes the version audit first. */
app.post('/admin/drafts/:id', async (c) => {
  const gate = await adminGate(c);
  if (gate) return gate;
  await ensureContentSchema();
  const id = c.req.param('id');
  if (!/^cd_[0-9a-f]{12}$/.test(id)) return backTo(c, { error: 'Invalid draft id' });
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const action = String(form.action ?? '');
  const note = String(form.note ?? '').trim().slice(0, 300) || undefined;
  const reviewer = process.env.ADMIN_USERNAME ?? 'admin';
  if (action === 'approve') {
    const result = await approveDraft(q, id, reviewer, note);
    return result.ok
      ? backTo(c, { flash: `Approved → version ${result.version} recorded` })
      : backTo(c, { error: result.error ?? 'Approve failed' });
  }
  if (action === 'reject') {
    const result = await rejectDraft(q, id, reviewer, note);
    return result.ok
      ? backTo(c, { flash: 'Draft rejected' })
      : backTo(c, { error: result.error ?? 'Reject failed' });
  }
  return backTo(c, { error: 'Unknown action' });
});

/** Resolve a learner report with a note. */
app.post('/admin/reports/:id', async (c) => {
  const gate = await adminGate(c);
  if (gate) return gate;
  await ensureContentSchema();
  const id = c.req.param('id');
  if (!/^lr_[0-9a-f]{12}$/.test(id)) return backTo(c, { error: 'Invalid report id' });
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const note = String(form.note ?? '').trim().slice(0, 300);
  const result = await resolveReport(q, id, note);
  return result.ok
    ? backTo(c, { flash: 'Report resolved' })
    : backTo(c, { error: result.error ?? 'Resolve failed' });
});

export default app;
