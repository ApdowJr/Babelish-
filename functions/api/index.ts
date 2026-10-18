import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { Pool } from 'pg';
import { attachDatabasePool } from '@neon/functions';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

export default app;
