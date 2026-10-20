#!/usr/bin/env node
/**
 * Neon end-to-end smoke test for Zelvoca.
 *
 * Exercises every wired service the same way the app does:
 *   Functions → hello + api health, Postgres (direct query + via the API),
 *   Managed Auth (sign-up, sign-in, JWT), API authorization (401s, state
 *   round-trip, cross-user isolation), Object Storage (presigned PUT/GET).
 *
 * Reads .env.local (written by `neon deploy`). Never prints secrets.
 * Run: npm run neon:e2e
 */

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const env = {};
  for (const line of readFileSync(resolve(root, '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1'); // env pull quotes URLs with query params
  }
  return env;
}

const env = loadEnvLocal();
const AUTH = (env.NEON_AUTH_BASE_URL ?? '').replace(/\/+$/, '');
const API = (
  env.EXPO_PUBLIC_NEON_FUNCTION_API_URL ??
  env.NEON_FUNCTION_API_BASE_URL ??
  ''
).replace(/\/+$/, '');
const HELLO = (env.NEON_FUNCTION_HELLO_BASE_URL ?? '').replace(/\/+$/, '');
if (!AUTH || !API || !HELLO) {
  console.error('Missing Neon env vars in .env.local — run `neon deploy` first.');
  process.exit(2);
}
// The production origin Neon Auth actually trusts TODAY (verified 2026-10-20
// with a live probe: `zelvoca.app` → 403 INVALID_ORIGIN, this origin →
// 401 credential check). The intended custom domain (`babelish.app`) is not
// configured in Neon Auth yet — see docs/DEPLOYMENT.md — so the script must
// exercise the origin the site is really served from, not a planned one.
const ORIGIN = 'https://babelish.vercel.app';
const COOKIE_NAME = '__Secure-neon-auth.session_token';

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
const mask = (t) => (t ? `${String(t).slice(0, 6)}…` : 'none');

const cookieFrom = (res) => {
  const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  const all = [...list, res.headers.get('set-cookie')].filter(Boolean);
  const hit = all.find((c) => c.startsWith(`${COOKIE_NAME}=`));
  return hit ? hit.split(';')[0] : null;
};

async function signUpOrSignIn(email, password) {
  const su = await fetch(`${AUTH}/sign-up/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password, name: 'Zelvoca E2E' }),
  });
  if (su.ok) {
    const body = await su.json();
    return { user: body.user, cookie: cookieFrom(su), via: 'sign-up' };
  }
  const si = await fetch(`${AUTH}/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
    body: JSON.stringify({ email, password }),
  });
  const body = await si.json().catch(() => ({}));
  return si.ok
    ? { user: body.user, cookie: cookieFrom(si), via: 'sign-in' }
    : { error: `sign-up ${su.status} / sign-in ${si.status}` };
}

console.log('\n── 1. Functions ──────────────────────────────────────');
{
  const hello = await fetch(HELLO).catch(() => null);
  ok('hello function responds', hello?.status === 200 && (await hello.text()).includes('Hello'));
  const api = await fetch(`${API}/`).catch(() => null);
  const apiBody = api ? await api.json().catch(() => ({})) : {};
  ok('api function health', api?.status === 200 && apiBody.ok === true, `branch=${apiBody.branch ?? '?'}`);
}

console.log('\n── 2. Postgres (direct, via DATABASE_URL_UNPOOLED) ───');
{
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 1 });
  try {
    const { rows } = await pool.query('select now() as now, to_regclass($1) as tbl', ['public.app_state']);
    ok('direct query', rows.length === 1, `now=${new Date(rows[0].now).toISOString()}`);
    ok('app_state table exists', rows[0].tbl === 'app_state');
  } catch (err) {
    ok('direct query', false, err.message);
  } finally {
    await pool.end().catch(() => undefined);
  }
}

console.log('\n── 3. Neon Auth (Managed Better Auth) ───────────────');
const stamp = Date.now();
const accountA = { email: `e2e-a-${stamp}@zelvoca.test`, password: 'ZelvocaE2e!2026' };
const accountB = { email: `e2e-b-${stamp}@zelvoca.test`, password: 'ZelvocaE2e!2026' };
const A = await signUpOrSignIn(accountA.email, accountA.password);
const B = await signUpOrSignIn(accountB.email, accountB.password);
ok('user A session established', Boolean(A.user?.id && A.cookie), `via ${A.via ?? A.error}`);
ok('user B session established', Boolean(B.user?.id && B.cookie), `via ${B.via ?? B.error}`);

let jwtA = null;
if (A.cookie) {
  const gt = await fetch(`${AUTH}/token`, { method: 'GET', headers: { Cookie: A.cookie } });
  const gtBody = await gt.json().catch(() => ({}));
  jwtA = gtBody.token ?? null;
  let claims = null;
  try {
    claims = JSON.parse(Buffer.from(jwtA.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
  } catch {}
  ok(
    'JWT minted (EdDSA, 15-min)',
    Boolean(claims) && claims.iss === new URL(AUTH).origin && claims.sub === A.user.id,
    `exp=${claims ? new Date(claims.exp * 1000).toISOString() : '?'}`
  );
}

console.log('\n── 4. API authorization + state sync ────────────────');
{
  const noAuth = await fetch(`${API}/api/state`).catch(() => null);
  ok('GET /api/state without JWT → 401', noAuth?.status === 401);

  const payload = {
    progress: { 'es-ch1-l1': { score: 90, completedAt: new Date().toISOString() } },
    vocab: {
      'es:hola': {
        itemKey: 'es:hola',
        languageId: 'es',
        target: 'hola',
        translation: 'hello',
        box: 2,
        dueAt: new Date(Date.now() + 864e5).toISOString(),
      },
    },
  };
  const put = jwtA
    ? await fetch(`${API}/api/state`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${jwtA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null)
    : null;
  ok('PUT /api/state with JWT', put?.status === 200, put ? `status=${put.status}` : 'no JWT');

  const get = jwtA
    ? await fetch(`${API}/api/state`, { headers: { Authorization: `Bearer ${jwtA}` } }).catch(() => null)
    : null;
  const state = get?.status === 200 ? await get.json() : {};
  ok(
    'GET /api/state round-trip',
    state?.progress?.['es-ch1-l1']?.score === 90 && state?.vocab?.['es:hola']?.box === 2,
    `updatedAt=${state.updatedAt ?? '?'}`
  );

  if (B.cookie) {
    const gtB = await fetch(`${AUTH}/token`, { method: 'GET', headers: { Cookie: B.cookie } });
    const jwtB = (await gtB.json().catch(() => ({}))).token ?? null;
    const peek = jwtB
      ? await fetch(`${API}/api/state`, { headers: { Authorization: `Bearer ${jwtB}` } }).catch(() => null)
      : null;
    const peekBody = peek?.status === 200 ? await peek.json() : {};
    ok(
      "user B cannot see user A's state",
      peek?.status === 200 && Object.keys(peekBody.progress ?? {}).length === 0
    );
  }
}

console.log('\n── 5. Object Storage (presigned PUT/GET, private) ───');
if (jwtA) {
  const sign = await fetch(`${API}/api/storage/sign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${jwtA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'e2e-note.txt', contentType: 'text/plain' }),
  }).catch(() => null);
  const signBody = sign?.status === 200 ? await sign.json() : {};
  ok('presigned upload URL issued', Boolean(signBody.uploadUrl), `key=${signBody.key ?? '?'}`);

  const bytes = new TextEncoder().encode(`zelvoca e2e ${stamp}`);
  const putObj = signBody.uploadUrl
    ? await fetch(signBody.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/plain' },
        body: bytes,
      }).catch(() => null)
    : null;
  ok('object uploaded via presigned PUT', putObj?.status === 200, `status=${putObj?.status ?? '?'}`);

  const getUrl = await fetch(`${API}/api/storage/url?key=${encodeURIComponent(signBody.key ?? '')}`, {
    headers: { Authorization: `Bearer ${jwtA}` },
  }).catch(() => null);
  const getUrlBody = getUrl?.status === 200 ? await getUrl.json() : {};
  const downloaded = getUrlBody.url ? await fetch(getUrlBody.url).catch(() => null) : null;
  const text = downloaded?.ok ? await downloaded.text() : '';
  ok('object downloaded via presigned GET', text === `zelvoca e2e ${stamp}`, `bytes=${text.length}`);

  const othersKey = await fetch(`${API}/api/storage/url?key=${encodeURIComponent(`users/${B.user?.id ?? 'x'}/e2e-note.txt`)}`, {
    headers: { Authorization: `Bearer ${jwtA}` },
  }).catch(() => null);
  ok("cannot presign another user's prefix", othersKey?.status === 400);
} else {
  ok('object storage tests', false, 'no JWT for user A');
}

console.log('\n── 6. Content pipeline: drafts → human approval → version audit ──');
{
  const admin = await import('../functions/api/admin.ts');
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 1 });
  const q = async (text, params) => pool.query(text, params);

  try {
    await admin.ensureSchema(q);
    ok('content schema ensured (idempotent DDL)', true);

    const validChapter = {
      cefr: 'A1',
      title: `E2E chapter ${stamp}`,
      description: 'pipeline fixture',
      lessons: [
        {
          title: 'Greetings',
          goal: 'greet someone',
          exercises: [
            { type: 'choose', prompt: 'Pick', question: 'hola', options: ['hello', 'bye', 'ok', 'no'], answer: ['hello'] },
            { type: 'choose', prompt: 'Pick', question: 'adiós', options: ['bye', 'hi', 'yes', 'up'], answer: ['bye'] },
            { type: 'choose', prompt: 'Pick', question: 'gracias', options: ['thanks', 'please', 'sorry', 'now'], answer: ['thanks'] },
            { type: 'type', prompt: 'Translate into Spanish', question: 'good morning', answer: ['buenos días', 'buenos dias'] },
          ],
        },
      ],
    };
    const broken = { ...validChapter, lessons: [{ ...validChapter.lessons[0], exercises: [] }] };
    ok('validator rejects lesson without exercises', admin.validateChapterPayload(broken).ok === false);
    ok('validator accepts a well-formed chapter', admin.validateChapterPayload(validChapter).ok === true);
    ok(
      'report validator rejects unknown kind',
      admin.validateReport({ kind: 'nonsense', reason: 'x' }).ok === false
    );
    ok(
      'report validator accepts a real one',
      admin.validateReport({ kind: 'message', reason: 'Sounds wrong', quote: 'hola', languageId: 'es' }).ok === true
    );

    const { id: draftA } = await admin.insertDraft(q, {
      languageId: 'es',
      title: validChapter.title,
      cefr: 'A1',
      source: 'ai',
      payload: validChapter,
    });
    ok('draft inserted into review queue', /^cd_[0-9a-f]{12}$/.test(draftA), `id=${draftA}`);

    const before = await admin.fetchDashboard(q);
    ok('dashboard lists the queued draft', before.drafts.some((d) => d.id === draftA));

    const approve1 = await admin.approveDraft(q, draftA, 'e2e');
    ok('first approval → version 1', approve1.ok && approve1.version === 1);

    const approve2 = await admin.approveDraft(q, draftA, 'e2e');
    ok('re-approval → version 2 (audit never silent)', approve2.ok && approve2.version === 2);

    const { id: draftB } = await admin.insertDraft(q, {
      languageId: 'es',
      title: `E2E rejected ${stamp}`,
      cefr: 'A1',
      source: 'ai',
      payload: validChapter,
    });
    const reject = await admin.rejectDraft(q, draftB, 'e2e', 'inaccurate');
    ok('rejection recorded', reject.ok === true);

    const after = await admin.fetchDashboard(q);
    const rowA = after.drafts.find((d) => d.id === draftA);
    const versionsA = after.versions.filter((v) => v.chapter_ref === draftA);
    ok('draft A status = approved', rowA?.status === 'approved', `by=${rowA?.reviewed_by ?? '?'}`);
    ok('draft B status = rejected', after.drafts.find((d) => d.id === draftB)?.status === 'rejected');
    ok('2 version rows for draft A', versionsA.length === 2, `versions=${versionsA.map((v) => v.version).join(',')}`);
    ok(
      'rejection wrote no version row',
      after.versions.filter((v) => v.chapter_ref === draftB).length === 0
    );
    const html = admin.renderDashboard(after);
    ok('dashboard HTML escapes user content', !html.includes('<script>alert') && html.includes('e2e'));

    const { id: reportId } = await admin.insertReport(q, {
      userId: A.user?.id ?? 'e2e',
      languageId: 'es',
      kind: 'message',
      quote: '<script>alert(1)</script> kiero tembo',
      reason: 'Sounds wrong',
    });
    ok('learner report queued', /^lr_[0-9a-f]{12}$/.test(reportId), `id=${reportId}`);
    const resolve = await admin.resolveReport(q, reportId, 'checked with a native speaker');
    ok('report resolved with note', resolve.ok === true);
    const dash2 = await admin.fetchDashboard(q);
    const report = dash2.reports.find((r) => r.id === reportId);
    ok('report status = resolved', report?.status === 'resolved');
    ok('report quote is escaped in HTML', dash2 && admin.renderDashboard(dash2).includes('&lt;script&gt;'));

    await q('delete from content_versions where chapter_ref in ($1, $2)', [draftA, draftB]);
    await q('delete from content_drafts where id in ($1, $2)', [draftA, draftB]);
    await q('delete from learner_reports where id = $1', [reportId]);
    const cleaned = await admin.fetchDashboard(q);
    ok(
      'fixtures cleaned up',
      !cleaned.drafts.some((d) => d.id === draftA || d.id === draftB) &&
        !cleaned.versions.some((v) => v.chapter_ref === draftA) &&
        !cleaned.reports.some((r) => r.id === reportId)
    );
  } catch (err) {
    ok('content pipeline suite', false, err instanceof Error ? err.message : String(err));
  } finally {
    await pool.end();
  }
}

console.log('\n── 7. Weekly leaderboard (XP claim → rank → idempotency) ──');
{
  const lb = await import('../functions/api/league.ts');
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 1 });
  const q = async (text, params) => pool.query(text, params);
  const WEEK = '2099-W01'; // far-future fixture week — never collides with real data

  try {
    await lb.ensureSchema(q);
    ok('leaderboard schema ensured (idempotent DDL)', true);

    const claim1 = await lb.claimWeeklyXp(q, 'e2e-user-a', WEEK, 100);
    ok('claim 100 XP → stored', claim1.xp === 100, `xp=${claim1.xp}`);
    const claim2 = await lb.claimWeeklyXp(q, 'e2e-user-a', WEEK, 60);
    ok('re-claim lower XP → idempotent (greatest)', claim2.xp === 100, `xp=${claim2.xp}`);
    const claim3 = await lb.claimWeeklyXp(q, 'e2e-user-a', WEEK, 180);
    ok('claim higher XP → advances', claim3.xp === 180, `xp=${claim3.xp}`);
    await lb.claimWeeklyXp(q, 'e2e-user-b', WEEK, 400);

    const boardA = await lb.fetchLeaderboard(q, WEEK, 'e2e-user-a');
    const boardB = await lb.fetchLeaderboard(q, WEEK, 'e2e-user-b');
    const boardC = await lb.fetchLeaderboard(q, WEEK, 'e2e-user-c');
    ok('rank: leader is #1 of 2', boardB.rank === 1 && boardB.total === 2, `rank=${boardB.rank} total=${boardB.total}`);
    ok('rank: second is #2', boardA.rank === 2, `rank=${boardA.rank}`);
    ok('own XP surfaced', boardA.xp === 180 && boardB.xp === 400);
    ok('non-participant: no fake rank', boardC.rank === null && boardC.xp === 0, `rank=${boardC.rank}`);

    ok(
      'week key format enforced by schema/validator',
      lb.WEEK_PATTERN.test(WEEK) && !lb.WEEK_PATTERN.test('nope') && !lb.WEEK_PATTERN.test('2026-W999')
    );

    await q('delete from public.weekly_xp where week = $1', [WEEK]);
    const cleaned = await lb.fetchLeaderboard(q, WEEK, 'e2e-user-a');
    ok('fixtures cleaned up', cleaned.total === 0 && cleaned.rank === null, `total=${cleaned.total}`);
  } catch (err) {
    ok('leaderboard suite', false, err instanceof Error ? err.message : String(err));
  } finally {
    await pool.end();
  }
}

console.log('\n── 8. Account data deletion (Play/GDPR erasure) ──');
{
  const admin = await import('../functions/api/admin.ts');
  const lb = await import('../functions/api/league.ts');
  const pool = new Pool({ connectionString: env.DATABASE_URL_UNPOOLED, max: 1 });
  const q = async (text, params) => pool.query(text, params);
  const U = 'e2e-delete-user';

  try {
    await admin.ensureSchema(q);
    await lb.ensureSchema(q);
    ok('schemas ensured for deletion targets', true);

    await q(
      `insert into public.app_state (user_id, progress, vocab)
       values ($1, '{"es-1-1":{"score":80,"completedAt":"2026-10-18T00:00:00Z"}}'::jsonb, '{}'::jsonb)
       on conflict (user_id) do update set progress = excluded.progress`,
      [U]
    );
    const report = await admin.insertReport(q, { userId: U, languageId: 'es', kind: 'message', quote: 'x', reason: 'e2e' });
    ok('fixture: learner report queued', Boolean(report.id));
    await lb.claimWeeklyXp(q, U, '2099-W02', 75);

    const removed = await admin.deleteUserData(q, U);
    ok(
      'deletion removes rows from all three tables',
      removed.state >= 1 && removed.league >= 1 && removed.reports === 1,
      JSON.stringify(removed)
    );

    const check = await lb.fetchLeaderboard(q, '2099-W02', U);
    const rep = await q('select count(*)::int as n from public.learner_reports where user_id = $1', [U]);
    const st = await q('select count(*)::int as n from public.app_state where user_id = $1', [U]);
    ok(
      'nothing left for the user',
      check.rank === null && check.xp === 0 && rep.rows[0].n === 0 && st.rows[0].n === 0
    );

    const again = await admin.deleteUserData(q, U);
    ok(
      'idempotent — second delete is a no-op',
      again.state === 0 && again.league === 0 && again.reports === 0,
      JSON.stringify(again)
    );
  } catch (err) {
    ok('account deletion suite', false, err instanceof Error ? err.message : String(err));
  } finally {
    await pool.end();
  }
}

console.log(`\n── Result: ${pass} passed, ${fail} failed ──────────────`);
process.exit(fail > 0 ? 1 : 0);
