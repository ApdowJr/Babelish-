/**
 * Content review — the Phase 4 human-approval gate.
 *
 * Shared by BOTH consumers so approval logic exists in exactly one place:
 *   - the deployed `api` Function (routes under /admin), and
 *   - the local runner (`scripts/review-dashboard.mjs`), usable today
 *     without deploying anything.
 *
 * Pure module by design: zero imports, no I/O. Callers pass a query
 * function; every string that reaches HTML goes through escapeHtml.
 */

export type QueryResult = { rows: Record<string, unknown>[]; rowCount?: number | null };
export type QueryFn = (text: string, params?: unknown[]) => Promise<QueryResult>;

export const REPORT_KINDS = ['message', 'phrase', 'lesson', 'translation', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/* ── schema ─────────────────────────────────────────────────────────── */

const ID = (prefix: string) =>
  `'${prefix}_' || substr(md5(random()::text || clock_timestamp()::text), 1, 12)`;

export const SCHEMA_SQL = `
create table if not exists public.content_drafts (
  id           text primary key default (${ID('cd')}),
  language_id  text not null,
  title        text not null,
  cefr         text not null default 'A1',
  source       text not null default 'ai' check (source in ('ai', 'human')),
  payload      jsonb not null,
  status       text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  review_note  text,
  reviewed_by  text,
  reviewed_at  timestamptz,
  published_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists content_drafts_status_idx on public.content_drafts (status, created_at desc);

create table if not exists public.content_versions (
  id           text primary key default (${ID('cv')}),
  language_id  text not null,
  chapter_ref  text not null,
  version      integer not null,
  payload      jsonb not null,
  summary      text not null default '',
  reviewed_by  text not null default 'human',
  created_at   timestamptz not null default now()
);
create unique index if not exists content_versions_ref_idx
  on public.content_versions (language_id, chapter_ref, version);

create table if not exists public.learner_reports (
  id              text primary key default (${ID('lr')}),
  user_id         text not null,
  language_id     text not null default '',
  kind            text not null check (kind in ('message', 'phrase', 'lesson', 'translation', 'other')),
  quote           text not null default '',
  reason          text not null default '',
  status          text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  resolution_note text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists learner_reports_status_idx on public.learner_reports (status, created_at desc);
`;

/* ── queries ────────────────────────────────────────────────────────── */

export const SQL = {
  drafts: `
    select id, language_id, title, cefr, source, status, payload,
           review_note, reviewed_by, reviewed_at, created_at
    from public.content_drafts
    order by created_at desc
    limit 50`,
  reports: `
    select id, user_id, language_id, kind, quote, reason, status,
           resolution_note, resolved_at, created_at
    from public.learner_reports
    order by created_at desc
    limit 50`,
  versions: `
    select id, language_id, chapter_ref, version, payload, summary, reviewed_by, created_at
    from public.content_versions
    order by created_at desc
    limit 30`,
  counts: `
    select
      (select count(*) from public.content_drafts where status = 'draft')  as open_drafts,
      (select count(*) from public.learner_reports where status = 'open')  as open_reports`,
  insertReport: `
    insert into public.learner_reports (user_id, language_id, kind, quote, reason)
    values ($1, $2, $3, $4, $5)
    returning id`,
  /** Account deletion (Play "delete account" + GDPR erasure), per user id. */
  deleteAppState: `delete from public.app_state where user_id = $1`,
  deleteWeeklyXp: `delete from public.weekly_xp where user_id = $1`,
  deleteReports: `delete from public.learner_reports where user_id = $1`,
  insertDraft: `
    insert into public.content_drafts (language_id, title, cefr, source, payload)
    values ($1, $2, $3, $4, $5::jsonb)
    returning id`,
  /** Audit BEFORE state change: version row is written first, then status flips. */
  versionInsert: `
    insert into public.content_versions (language_id, chapter_ref, version, payload, summary, reviewed_by)
    select d.language_id, d.id,
           (select coalesce(max(v.version), 0) + 1
              from public.content_versions v
             where v.language_id = d.language_id and v.chapter_ref = d.id),
           d.payload, 'Approved: ' || d.title, $2
      from public.content_drafts d
     where d.id = $1
    returning version`,
  approve: `
    update public.content_drafts
       set status = 'approved', reviewed_at = now(), reviewed_by = $2,
           review_note = coalesce($3, review_note)
     where id = $1
    returning id`,
  reject: `
    update public.content_drafts
       set status = 'rejected', reviewed_at = now(), reviewed_by = $2,
           review_note = coalesce($3, review_note)
     where id = $1
    returning id`,
  resolveReport: `
    update public.learner_reports
       set status = 'resolved', resolved_at = now(), resolution_note = $2
     where id = $1
    returning id`,
} as const;

/* ── operations ─────────────────────────────────────────────────────── */

export async function ensureSchema(q: QueryFn): Promise<void> {
  // Multi-statement simple query — pg allows this only without params.
  await q(SCHEMA_SQL);
}

export type DashboardData = {
  drafts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  versions: Record<string, unknown>[];
  openDrafts: number;
  openReports: number;
};

export async function fetchDashboard(q: QueryFn): Promise<DashboardData> {
  const [drafts, reports, versions, counts] = await Promise.all([
    q(SQL.drafts),
    q(SQL.reports),
    q(SQL.versions),
    q(SQL.counts),
  ]);
  const row = counts.rows[0] ?? {};
  return {
    drafts: drafts.rows,
    reports: reports.rows,
    versions: versions.rows,
    openDrafts: Number(row.open_drafts ?? 0),
    openReports: Number(row.open_reports ?? 0),
  };
}

export type ActionResult = { ok: boolean; error?: string; version?: number };

/** Approve: write the version audit row first, then flip status. */
export async function approveDraft(
  q: QueryFn,
  id: string,
  reviewer: string,
  note?: string
): Promise<ActionResult> {
  const versioned = await q(SQL.versionInsert, [id, reviewer]);
  if (!versioned.rows[0]) return { ok: false, error: 'Draft not found' };
  await q(SQL.approve, [id, reviewer, note ?? null]);
  return { ok: true, version: Number(versioned.rows[0].version) };
}

export async function rejectDraft(
  q: QueryFn,
  id: string,
  reviewer: string,
  note?: string
): Promise<ActionResult> {
  const updated = await q(SQL.reject, [id, reviewer, note ?? null]);
  if (!updated.rows[0]) return { ok: false, error: 'Draft not found' };
  return { ok: true };
}

export async function resolveReport(q: QueryFn, id: string, note: string): Promise<ActionResult> {
  const updated = await q(SQL.resolveReport, [id, note || null]);
  if (!updated.rows[0]) return { ok: false, error: 'Report not found' };
  return { ok: true };
}

export async function insertReport(
  q: QueryFn,
  report: { userId: string; languageId: string; kind: string; quote: string; reason: string }
): Promise<{ id: string }> {
  const { rows } = await q(SQL.insertReport, [
    report.userId,
    report.languageId,
    report.kind,
    report.quote,
    report.reason,
  ]);
  return { id: String(rows[0]?.id ?? '') };
}

export async function insertDraft(
  q: QueryFn,
  draft: { languageId: string; title: string; cefr: string; source: 'ai' | 'human'; payload: unknown }
): Promise<{ id: string }> {
  const { rows } = await q(SQL.insertDraft, [
    draft.languageId,
    draft.title,
    draft.cefr,
    draft.source,
    JSON.stringify(draft.payload),
  ]);
  return { id: String(rows[0]?.id ?? '') };
}

/** Play/GDPR data-deletion: every row keyed to this user id, across tables. */
export async function deleteUserData(
  q: QueryFn,
  userId: string
): Promise<{ state: number; league: number; reports: number }> {
  const state = await q(SQL.deleteAppState, [userId]);
  const league = await q(SQL.deleteWeeklyXp, [userId]);
  const reports = await q(SQL.deleteReports, [userId]);
  return {
    state: state.rowCount ?? 0,
    league: league.rowCount ?? 0,
    reports: reports.rowCount ?? 0,
  };
}

/* ── validation (mirrors scripts/generate-curriculum.mjs) ───────────── */

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateChapterPayload(raw: unknown): ValidationResult {
  const chapter = raw as {
    title?: unknown;
    lessons?: Array<{
      title?: unknown;
      goal?: unknown;
      exercises?: Array<Record<string, unknown>>;
    }>;
  };
  if (!chapter || typeof chapter !== 'object') return { ok: false, error: 'payload must be an object' };
  if (typeof chapter.title !== 'string' || !chapter.title.trim()) {
    return { ok: false, error: 'missing title' };
  }
  if (!Array.isArray(chapter.lessons) || chapter.lessons.length === 0) {
    return { ok: false, error: 'lessons must be a non-empty array' };
  }
  for (const [li, lesson] of chapter.lessons.entries()) {
    if (!lesson || typeof lesson.title !== 'string' || typeof lesson.goal !== 'string') {
      return { ok: false, error: `lesson ${li + 1}: missing title/goal` };
    }
    const exercises = lesson.exercises;
    if (!Array.isArray(exercises) || exercises.length < 4) {
      return { ok: false, error: `lesson ${li + 1}: needs at least 4 exercises` };
    }
    for (const [ei, ex] of exercises.entries()) {
      const at = `lesson ${li + 1} exercise ${ei + 1}`;
      if (!['choose', 'type', 'listen'].includes(String(ex?.type))) {
        return { ok: false, error: `${at}: type must be choose|type|listen` };
      }
      if (
        typeof ex?.prompt !== 'string' ||
        typeof ex?.question !== 'string' ||
        !Array.isArray(ex?.answer) ||
        (ex.answer as unknown[]).length === 0
      ) {
        return { ok: false, error: `${at}: missing prompt/question/answer` };
      }
      if (ex.type === 'choose' || ex.type === 'listen') {
        const options = ex?.options;
        if (!Array.isArray(options) || options.length !== 4) {
          return { ok: false, error: `${at}: needs exactly 4 options` };
        }
        if (!options.includes((ex.answer as unknown[])[0])) {
          return { ok: false, error: `${at}: options do not contain the canonical answer` };
        }
      }
    }
  }
  return { ok: true };
}

export function validateReport(raw: unknown):
  | { ok: true; value: { languageId: string; kind: ReportKind; quote: string; reason: string } }
  | { ok: false; error: string } {
  const body = raw as Record<string, unknown> | null;
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid body' };
  const kind = String(body.kind ?? '');
  if (!REPORT_KINDS.includes(kind as ReportKind)) return { ok: false, error: 'Invalid report kind' };
  const quote = String(body.quote ?? '').slice(0, 600);
  const reason = String(body.reason ?? '').slice(0, 400).trim();
  if (!reason) return { ok: false, error: 'Missing reason' };
  const languageId = String(body.languageId ?? '');
  if (languageId.length > 12 || !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(languageId)) {
    return { ok: false, error: 'Invalid language id' };
  }
  return { ok: true, value: { languageId, kind: kind as ReportKind, quote, reason } };
}

/* ── HTML rendering ─────────────────────────────────────────────────── */

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const when = (v: unknown): string => (v ? str(v).replace('T', ' ').slice(0, 16) : '—');

const STYLES = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #0b1220; color: #e2e8f0;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, sans-serif; }
  .wrap { max-width: 980px; margin: 0 auto; padding: 24px 20px 64px; }
  header { display: flex; align-items: baseline; justify-content: space-between;
    gap: 16px; flex-wrap: wrap; border-bottom: 1px solid #1e293b;
    padding-bottom: 16px; margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0; letter-spacing: .3px; }
  h1 span { color: #38bdf8; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .12em;
    color: #94a3b8; margin: 32px 0 10px; }
  .badge { background: #1d4ed8; color: #fff; border-radius: 999px;
    font-size: 11px; padding: 1px 8px; vertical-align: middle; }
  .badge.warn { background: #b45309; }
  a.refresh { color: #38bdf8; text-decoration: none; font-size: 13px; }
  .flash { background: #14532d; border: 1px solid #16a34a; color: #bbf7d0;
    padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; }
  .err { background: #450a0a; border: 1px solid #dc2626; color: #fecaca;
    padding: 10px 14px; border-radius: 10px; margin-bottom: 16px; }
  section.card { background: #101a2e; border: 1px solid #1e293b;
    border-radius: 14px; padding: 6px 18px 14px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 14px; }
  th { text-align: left; color: #64748b; font-weight: 600; font-size: 12px;
    text-transform: uppercase; letter-spacing: .08em; padding: 12px 8px 6px; }
  td { padding: 10px 8px; border-top: 1px solid #1e293b; vertical-align: top; }
  code { background: #1e293b; border-radius: 6px; padding: 1px 6px; font-size: 12px; }
  .chip { display: inline-block; border-radius: 999px; font-size: 11px;
    padding: 1px 9px; border: 1px solid #334155; color: #cbd5e1; }
  .chip.draft { border-color: #b45309; color: #fbbf24; }
  .chip.approved { border-color: #16a34a; color: #86efac; }
  .chip.rejected { border-color: #dc2626; color: #fca5a5; }
  .chip.open { border-color: #b45309; color: #fbbf24; }
  .chip.resolved { border-color: #16a34a; color: #86efac; }
  input[type=text], textarea, select { background: #0b1220; color: #e2e8f0;
    border: 1px solid #334155; border-radius: 8px; padding: 7px 10px;
    font: inherit; width: 100%; }
  textarea { font-family: ui-monospace, monospace; font-size: 12px; min-height: 140px; }
  button { background: #1d4ed8; color: #fff; border: 0; border-radius: 8px;
    padding: 7px 14px; font: inherit; font-size: 13px; cursor: pointer; }
  button.secondary { background: #334155; }
  button.danger { background: #991b1b; }
  form.inline { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  form.inline input[type=text] { width: 180px; }
  details { margin-top: 8px; }
  summary { cursor: pointer; color: #94a3b8; font-size: 13px; }
  pre { background: #0b1220; border: 1px solid #1e293b; border-radius: 10px;
    padding: 12px; overflow: auto; max-height: 380px; font-size: 12px; }
  .empty { color: #64748b; padding: 14px 8px; font-size: 14px; }
  .quote { color: #94a3b8; font-style: italic; max-width: 320px; }
  details.new-draft { background: #101a2e; border: 1px solid #1e293b;
    border-radius: 14px; padding: 12px 18px; margin: 10px 0; }
  details.new-draft summary { color: #38bdf8; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0; }
  footer { color: #475569; font-size: 12px; margin-top: 36px; text-align: center; }
`;

function statusChip(status: unknown): string {
  const s = str(status) || 'draft';
  return `<span class="chip ${escapeHtml(s)}">${escapeHtml(s)}</span>`;
}

function lessonCount(payload: unknown): number {
  const lessons = (payload as { lessons?: unknown } | null)?.lessons;
  return Array.isArray(lessons) ? lessons.length : 0;
}

export function renderDashboard(
  data: DashboardData,
  opts: { flash?: string; error?: string } = {}
): string {
  const draftRows = data.drafts
    .map((d) => {
      const id = escapeHtml(str(d.id));
      const status = str(d.status);
      const actions =
        status === 'draft'
          ? `<form class="inline" method="post" action="/admin/drafts/${id}">
               <input type="hidden" name="action" value="approve" />
               <input type="text" name="note" placeholder="review note (optional)" maxlength="300" />
               <button type="submit">Approve</button>
             </form>
             <form class="inline" method="post" action="/admin/drafts/${id}" style="margin-top:6px">
               <input type="hidden" name="action" value="reject" />
               <input type="text" name="note" placeholder="why rejected" maxlength="300" />
               <button type="submit" class="danger">Reject</button>
             </form>`
          : `<div class="quote">by ${escapeHtml(str(d.reviewed_by || 'human'))} · ${when(d.reviewed_at)}${
              d.review_note ? ` · ${escapeHtml(str(d.review_note))}` : ''
            }</div>`;
      return `<tr>
        <td>
          <strong>${escapeHtml(str(d.title))}</strong>
          <div class="quote">${lessonCount(d.payload)} lesson(s) · created ${when(d.created_at)}</div>
          <details><summary>Review payload (AI draft — you are the accuracy gate)</summary>
            <pre>${escapeHtml(JSON.stringify(d.payload, null, 2))}</pre>
          </details>
        </td>
        <td><code>${escapeHtml(str(d.language_id))}</code><br/>
            <span class="chip">${escapeHtml(str(d.cefr))}</span>
            <span class="chip">${escapeHtml(str(d.source))}</span></td>
        <td>${statusChip(status)}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');

  const reportRows = data.reports
    .map((r) => {
      const id = escapeHtml(str(r.id));
      const status = str(r.status);
      const actions =
        status !== 'resolved'
          ? `<form class="inline" method="post" action="/admin/reports/${id}">
               <input type="hidden" name="action" value="resolve" />
               <input type="text" name="note" placeholder="what you did" maxlength="300" />
               <button type="submit" class="secondary">Resolve</button>
             </form>`
          : `<div class="quote">${escapeHtml(str(r.resolution_note || ''))} · ${when(r.resolved_at)}</div>`;
      return `<tr>
        <td><span class="chip">${escapeHtml(str(r.kind))}</span>
            <code>${escapeHtml(str(r.language_id))}</code>
            <div class="quote">${escapeHtml(str(r.quote)).slice(0, 220)}</div></td>
        <td>${escapeHtml(str(r.reason))}<div class="quote">${when(r.created_at)}</div></td>
        <td>${statusChip(status)}</td>
        <td>${actions}</td>
      </tr>`;
    })
    .join('');

  const versionRows = data.versions
    .map(
      (v) => `<tr>
        <td><code>${escapeHtml(str(v.chapter_ref))}</code></td>
        <td>v${escapeHtml(str(v.version))}</td>
        <td>${escapeHtml(str(v.summary))}</td>
        <td>${escapeHtml(str(v.reviewed_by))}</td>
        <td>${when(v.created_at)}</td>
      </tr>`
    )
    .join('');

  const flash = opts.flash
    ? `<div class="flash">${escapeHtml(opts.flash)}</div>`
    : '';
  const error = opts.error ? `<div class="err">${escapeHtml(opts.error)}</div>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Babelish · Content review</title>
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Babelish <span>· content review</span></h1>
    <div>
      <span class="badge">${data.openDrafts} draft(s)</span>
      <span class="badge warn">${data.openReports} report(s)</span>
      &nbsp;<a class="refresh" href="/admin">↻ refresh</a>
    </div>
  </header>
  ${flash}
  ${error}
  <details class="new-draft">
    <summary>+ Submit a draft for review (human- or AI-authored JSON)</summary>
    <form method="post" action="/admin/drafts">
      <div class="grid">
        <label>Language id <input type="text" name="language_id" value="es" maxlength="12" required /></label>
        <label>Title <input type="text" name="title" maxlength="160" required /></label>
        <label>CEFR <input type="text" name="cefr" value="A1" maxlength="3" required /></label>
        <label>Source
          <select name="source"><option value="ai">ai</option><option value="human">human</option></select>
        </label>
      </div>
      <label>Chapter payload (JSON)<textarea name="payload" required
        placeholder='{"cefr":"A1","title":"…","description":"…","lessons":[…]}'></textarea></label>
      <p><button type="submit">Submit to queue</button></p>
    </form>
  </details>

  <h2>Drafts awaiting a human <span class="badge">${data.openDrafts} open</span></h2>
  <div class="section card">
    ${draftRows ? `<table>
      <thead><tr><th>Chapter</th><th>Lang · level</th><th>Status</th><th>Review</th></tr></thead>
      <tbody>${draftRows}</tbody></table>` : '<div class="empty">No drafts yet — generate one with <code>scripts/generate-curriculum.mjs</code> or paste JSON above. Nothing reaches learners without this queue.</div>'}
  </div>

  <h2>Learner reports <span class="badge warn">${data.openReports} open</span></h2>
  <div class="section card">
    ${reportRows ? `<table>
      <thead><tr><th>What</th><th>Why</th><th>Status</th><th>Resolution</th></tr></thead>
      <tbody>${reportRows}</tbody></table>` : '<div class="empty">No “this sounds wrong” reports yet.</div>'}
  </div>

  <h2>Version history</h2>
  <div class="section card">
    ${versionRows ? `<table>
      <thead><tr><th>Chapter ref</th><th>Version</th><th>Summary</th><th>Reviewer</th><th>When</th></tr>
      </thead><tbody>${versionRows}</tbody></table>` : '<div class="empty">Every approval writes a version row here first — content changes are never silent.</div>'}
  </div>

  <footer>Human approval gate · approved content only reaches learners</footer>
</div>
</body>
</html>`;
}

export function renderMessage(title: string, detail: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>${escapeHtml(title)}</title>
<style>${STYLES}</style></head>
<body><div class="wrap"><header><h1>${escapeHtml(title)}</h1></header>
<div class="err">${escapeHtml(detail)}</div>
<p><a class="refresh" href="/admin">← back to the dashboard</a></p></div></body></html>`;
}
