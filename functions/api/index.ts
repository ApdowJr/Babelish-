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
import { consumeQuota, ensureUsageSchema, quotaStatus, refundQuota } from './quotaStore';
import { limitsFromEnv, type QuotaKind } from '../../src/lib/quota';
import { buildSystemPrompt, extractTutorReply, parseAiChatRequest } from '../../src/lib/aiCore';
import { getLanguage } from '../../src/data/languages';

/**
 * Babelish API — the mobile app's backend, running on the same branch as the
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
    c.header('WWW-Authenticate', 'Basic realm="babelish-admin", charset="UTF-8"');
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
    c.header('WWW-Authenticate', 'Basic realm="babelish-admin", charset="UTF-8"');
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
 * CORS: reflect only Babelish's own web origins — the custom domain, Vercel
 * previews and localhost/private-network dev — so an unrelated site can't
 * read API responses in a browser. Requests with no Origin header (the native
 * app, curl) aren't browser-CORS-governed and pass through untouched; auth
 * still requires a valid JWT either way.
 */
const TRUSTED_WEB_ORIGIN = /^https:\/\/(?:(?:[a-z0-9-]+\.)*(?:zelvoca|babelish)\.app|(?:babelish-git-main-apdowjr|babelish-git-upgrade-zelvoca-production-hardening-ururka-lp|babelish-[a-z0-9]{8,12}-ururka-lp)\.vercel\.app)$/i;
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
  return c.json({ ok: true, service: 'babelish-api', branch: process.env.NEON_BRANCH, now: rows[0].now });
});

/**
 * Every /api/* route requires a valid Managed Auth JWT — except the tutor,
 * which also serves signed-out learners (demo mode / first run) under a
 * stricter per-IP budget. Anonymous identity is namespaced so it can never
 * collide with a real user id.
 */
const ANON_AI = /^\/api\/ai\/(chat|stt|status)$/;

app.use('/api/*', async (c, next) => {
  const auth = c.req.header('authorization');
  const anonymous = () => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      'unknown';
    c.set('userId', `anon:${ip}`);
  };

  if (!auth?.toLowerCase().startsWith('bearer ')) {
    if (ANON_AI.test(c.req.path)) {
      anonymous();
      return next();
    }
    return c.json({ error: 'Unauthorized' }, 401);
  }
  try {
    const { payload } = await jwtVerify(auth.slice(7), jwks, { issuer });
    if (!payload.sub) throw new Error('missing sub');
    c.set('userId', payload.sub);
  } catch {
    if (ANON_AI.test(c.req.path)) {
      anonymous();
      return next();
    }
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
 * This Function is an *optional* adapter to an OpenAI-compatible endpoint the
 * app owner hosts. Nothing here requires a paid provider: point AI_API_URL at
 * an Ollama / llama.cpp / LM Studio / vLLM server (or a self-hosted Whisper
 * server) and it works with no key at all.
 *
 * Configuration lives ONLY in this Function's environment — never in a client
 * bundle. The gateway counts as configured only when the owner opts in
 * explicitly (AI_API_URL, AI_API_KEY or AI_MODEL set). Otherwise it answers
 * 503 ai-not-configured and the client uses its local/browser/offline paths.
 * JWT-gated by the /api/* middleware and rate-limited per user.
 */
const AI_URL = (process.env.AI_API_URL ?? 'http://127.0.0.1:11434/v1').replace(/\/+$/, '');
const AI_KEY = process.env.AI_API_KEY ?? '';
const IS_OPENROUTER = /openrouter\.ai/i.test(AI_URL);
/**
 * Chat models are a *list*: free endpoints rotate, and a model that vanished
 * overnight must degrade to the next one instead of failing the learner.
 * `AI_MODELS=a,b` (or the single `AI_MODEL`) overrides the defaults.
 */
const CONFIGURED_MODELS = (process.env.AI_MODELS ?? process.env.AI_MODEL ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const CHAT_MODELS = CONFIGURED_MODELS.length
  ? CONFIGURED_MODELS
  : IS_OPENROUTER
    ? [
        // Qwen3 covers all 24 Babelish languages (119-language table).
        'qwen/qwen3-next-80b-a3b-instruct:free',
        'qwen/qwen3-next-80b-a3b-instruct',
        'openai/gpt-oss-120b:free',
      ]
    : ['qwen2.5:1.5b'];
const AI_MODEL = CHAT_MODELS[0];
const AI_STT_MODEL =
  process.env.AI_STT_MODEL ?? (IS_OPENROUTER ? 'openai/whisper-large-v3-turbo' : 'whisper-large-v3-turbo');
// Attribution headers OpenRouter asks for; ignored by every other server.
const AI_APP_URL = process.env.AI_APP_URL ?? 'https://babelish.app';
const AI_APP_NAME = process.env.AI_APP_NAME ?? 'Babelish';
const upstreamHeaders = (): Record<string, string> => ({
  ...(AI_KEY ? { authorization: `Bearer ${AI_KEY}` } : {}),
  'HTTP-Referer': AI_APP_URL,
  'X-Title': AI_APP_NAME,
});
// Local OpenAI-compatible servers often ship chat only; owners can turn audio
// off explicitly, or leave it on and expect /audio/transcriptions to exist.
const AI_CONFIGURED = Boolean(
  process.env.AI_API_URL || process.env.AI_API_KEY || process.env.AI_MODEL || process.env.AI_MODELS
);
const AI_STT_ENABLED = AI_CONFIGURED && process.env.AI_STT_ENABLED !== 'false';

const chatLimiter = createLimiter(20, 60_000); // messages per user / minute
const sttLimiter = createLimiter(10, 60_000); // transcriptions per user / minute
const anonChatLimiter = createLimiter(6, 60_000); // signed-out, per IP
const anonSttLimiter = createLimiter(2, 60_000); // signed-out, per IP

/* Daily budget: the per-minute limiters protect one burst, these protect the
 * provider's day. Both are needed — 20/min is 28,800/day. */
const QUOTA = limitsFromEnv(process.env);

/** Counts one turn; returns a ready-to-send 429 when the day is spent. */
async function takeDailyQuota(
  c: Context<Env>,
  kind: QuotaKind
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const userId = c.get('userId');
  const tier = userId.startsWith('anon:') ? 'guest' : 'learner';
  const outcome = await consumeQuota(q, { userId, tier, kind, limits: QUOTA });
  if (outcome.allowed) return { ok: true };
  c.header('Retry-After', String(outcome.retryAfterSeconds ?? 60));
  c.header('X-Quota-Source', outcome.source);
  return {
    ok: false,
    response: c.json(
      {
        error: outcome.reason === 'budget' ? 'daily-budget' : 'daily-limit',
        message: outcome.message,
        resetsAt: outcome.resetsAt,
        used: outcome.used,
        limit: outcome.limit,
        tier,
        source: outcome.source,
      },
      429
    ),
  };
}

/** Our fault, not the learner's: hand the message back. */
async function refundDailyQuota(userId: string, kind: QuotaKind): Promise<void> {
  await refundQuota(q, { userId, kind }).catch(() => undefined);
}

/** Capability report for the client's status rows — booleans only, no secrets. */
app.get('/api/ai/status', (c) =>
  c.json({
    chat: AI_CONFIGURED,
    stt: AI_STT_ENABLED,
    // The client shows this as "App server · <model>" — a name, never a key.
    model: AI_CONFIGURED ? AI_MODEL : null,
    models: AI_CONFIGURED ? CHAT_MODELS : [],
    /** True when the endpoint needs no credential (a local server). */
    keyless: AI_CONFIGURED && !AI_KEY,
    /** Audio transcription availability, decided by the owner's config. */
    sttEnabled: AI_STT_ENABLED,
    /** Daily budgets so the app can explain a 429 without guessing. */
    quota: quotaStatus(QUOTA),
  })
);

app.post('/api/ai/chat', async (c) => {
  if (!AI_CONFIGURED) return c.json({ error: 'ai-not-configured' }, 503);
  const userId = c.get('userId');
  const limiter = userId.startsWith('anon:') ? anonChatLimiter : chatLimiter;
  if (!limiter.take(userId)) {
    return c.json(
      {
        error: 'rate-limited',
        message: userId.startsWith('anon:')
          ? 'You are chatting as a guest — sign in for a longer session.'
          : 'The tutor is busy — wait a minute and try again.',
      },
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

  const allowance = await takeDailyQuota(c, 'chat');
  if (!allowance.ok) return allowance.response;

  const sys = buildSystemPrompt({
    language,
    level: parsed.request.level ?? 'A2',
    scenarioTitle: parsed.request.scenarioTitle,
    learnerName: parsed.request.learnerName,
    explanationLanguage: parsed.request.explanationLanguage,
    profile: parsed.request.profile,
  });

  // Try the configured chain in order: a free endpoint that disappeared
  // overnight must not break the tutor. Only "this model is gone" moves on —
  // a bad key, a rate limit or a timeout is reported as itself.
  const messages = [
    { role: 'system', content: sys },
    ...parsed.request.history.map((m) => ({ role: m.role, content: m.text })),
  ];
  // The learner can tap Stop at any time; the browser then drops the request
  // and `c.req.raw.signal` fires. Abort the upstream call too — it costs the
  // owner money and nobody will read the answer. The daily slot is NOT
  // refunded: the model was already asked, and refunding cancellations would
  // be a free-inference loop (start, cancel after billing, repeat).
  const clientAbort = new AbortController();
  const onClientGone = () => clientAbort.abort();
  c.req.raw.signal?.addEventListener('abort', onClientGone);

  let lastDetail = '';
  for (const model of CHAT_MODELS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    const forwardCancel = () => controller.abort();
    clientAbort.signal.addEventListener('abort', forwardCancel);
    try {
      const upstream = await fetch(`${AI_URL}/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...upstreamHeaders() },
        signal: controller.signal,
        body: JSON.stringify({
          model,
          temperature: 0.8,
          messages,
          ...(IS_OPENROUTER ? { max_tokens: 600 } : {}),
        }),
      });
      if (!upstream.ok) {
        const bodyText = await upstream.text().catch(() => '');
        const modelGone =
          upstream.status === 404 ||
          /model|endpoint|provider/i.test(bodyText) &&
            /not found|no endpoints|unavailable|does not exist/i.test(bodyText);
        if (modelGone) {
          lastDetail = `model ${model} is unavailable`;
          continue; // try the next model in the chain
        }
        const detail =
          upstream.status === 401 || upstream.status === 403
            ? 'The tutor key was rejected — check AI_API_KEY on the server.'
            : upstream.status === 429
              ? 'The model is rate-limited right now — try again in a minute.'
              : `The tutor provider returned HTTP ${upstream.status}.`;
        await refundDailyQuota(userId, 'chat');
        return c.json({ error: 'upstream-failed', message: detail }, 502);
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
      return c.json({
        reply: reply.text,
        translation: reply.translation,
        tip: reply.tip,
        model,
      });
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        if (clientAbort.signal.aborted) {
          // Cancelled by the learner: no refund (see above), no error copy.
          // 204 — there is no response to describe, the caller is gone.
          return c.body(null, 204);
        }
        await refundDailyQuota(userId, 'chat');
        return c.json(
          { error: 'upstream-timeout', message: 'The tutor took too long — try again.' },
          504
        );
      }
      lastDetail = err instanceof Error ? err.message : 'network error';
    } finally {
      clearTimeout(timer);
      clientAbort.signal.removeEventListener('abort', forwardCancel);
    }
  }

  c.req.raw.signal?.removeEventListener('abort', onClientGone);
  await refundDailyQuota(userId, 'chat');
  return c.json(
    {
      error: 'upstream-failed',
      message: `No configured tutor model answered (${lastDetail}). Try again shortly.`,
    },
    502
  );
});

app.post('/api/ai/stt', async (c) => {
  if (!AI_CONFIGURED) return c.json({ error: 'ai-not-configured' }, 503);
  if (!AI_STT_ENABLED) return c.json({ error: 'ai-stt-not-configured' }, 503);
  const userId = c.get('userId');
  if (!(userId.startsWith('anon:') ? anonSttLimiter : sttLimiter).take(userId)) {
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

  const allowance = await takeDailyQuota(c, 'stt');
  if (!allowance.ok) return allowance.response;

  const outbound = new FormData();
  outbound.append('file', file, filename);
  outbound.append('model', AI_STT_MODEL);
  outbound.append('response_format', 'json');
  if (typeof languageId === 'string' && languageId) outbound.append('language', languageId);

  // Stopping a transcription aborts the upload/provider call for the same
  // reason as chat: save the spend, keep the slot spent.
  const clientAbort = new AbortController();
  const onClientGone = () => clientAbort.abort();
  c.req.raw.signal?.addEventListener('abort', onClientGone);
  const controller = new AbortController();
  const forwardCancel = () => controller.abort();
  clientAbort.signal.addEventListener('abort', forwardCancel);
  const timer = setTimeout(() => controller.abort(), 45_000);
  try {
    const upstream = await fetch(`${AI_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: upstreamHeaders(),
      body: outbound,
      signal: controller.signal,
    });
    if (!upstream.ok) {
      const detail =
        upstream.status === 401
          ? 'The AI provider rejected its key.'
          : `The AI provider returned HTTP ${upstream.status}.`;
      await refundDailyQuota(userId, 'stt');
      return c.json({ error: 'upstream-failed', message: `${detail} Try again later.` }, 502);
    }
    const data = (await upstream.json().catch(() => null)) as { text?: string } | null;
    const text = String(data?.text ?? '').trim();
    if (!text) {
      // The provider still transcribed (and billed) the silence. Refunding it
      // would make repeated silent uploads free provider spend, so the slot
      // stays spent; the message invites a retry with better audio.
      return c.json(
        { error: 'empty-transcript', message: "I couldn't catch that — try again or type instead." },
        422
      );
    }
    return c.json({ text });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (clientAbort.signal.aborted) {
        // No refund: the provider was already asked (see the chat route).
        return c.body(null, 204);
      }
      await refundDailyQuota(userId, 'stt');
      return c.json(
        { error: 'upstream-timeout', message: 'Transcription took too long — try again.' },
        504
      );
    }
    await refundDailyQuota(userId, 'stt');
    return c.json(
      { error: 'upstream-failed', message: 'Voice service hit a problem — try again.' },
      502
    );
  } finally {
    clearTimeout(timer);
    clientAbort.signal.removeEventListener('abort', forwardCancel);
    c.req.raw.signal?.removeEventListener('abort', onClientGone);
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
