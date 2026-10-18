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

/**
 * Nativa API — the mobile app's backend, running on the same branch as the
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
  const header = c.req.header('authorization') ?? '';
  if (!header.toLowerCase().startsWith('basic ')) {
    c.header('WWW-Authenticate', 'Basic realm="nativa-admin", charset="UTF-8"');
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
    c.header('WWW-Authenticate', 'Basic realm="nativa-admin", charset="UTF-8"');
    return c.text('Invalid credentials', 401);
  }
  return null;
}

/** 303 back to the dashboard with a flash or error message (HTML-escaped on render). */
function backTo(c: Context, params: Record<string, string>): Response {
  const search = new URLSearchParams(params);
  return c.redirect(`/admin${search.toString() ? `?${search}` : ''}`, 303);
}

app.use(
  '*',
  cors({
    origin: '*',
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'PUT', 'POST', 'OPTIONS'],
  })
);

/** Health check: proves the function is up AND can reach Postgres. */
app.get('/', async (c) => {
  const { rows } = await pool.query('select now() as now');
  return c.json({ ok: true, service: 'nativa-api', branch: process.env.NEON_BRANCH, now: rows[0].now });
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
