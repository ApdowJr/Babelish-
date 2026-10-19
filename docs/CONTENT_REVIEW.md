# Babelish — content review & contributor program

_Phase 4 (Trust & accuracy). Every AI-drafted chapter passes a human before it
reaches a single learner. AI never approves its own output._

## The approval pipeline

```
scripts/generate-curriculum.mjs        paste JSON on the dashboard
            │                                    │
            ▼                                    ▼
   drafts/*.ts  ──submit──►  content_drafts (status = 'draft')   ← never published
                                    │
                       human review │  (dashboard: read the full payload,
                                    ▼    check accuracy + naturalness)
                       status = 'approved'  ──►  content_versions row FIRST
                                    │            (audit: payload, reviewer, time)
                                    ▼
                       publish to src/data/curriculum/<lang>/  (committed to git)
                                    │
                                    ▼
                       learners see it (bundled / Supabase-approved only)
```

- **Rejections** flip `status = 'rejected'` with a note and write **no** version
  row — nothing was published, nothing changes.
- **Approvals** always write a `content_versions` row *before* the status flip,
  so content history is append-only: every past version can be reconstructed,
  and no change is ever silent.
- The bundled curriculum itself is versioned by git (each publish is a commit
  with the review note in the message).

## Running the review dashboard

**Local (works today, no deploy):**

```bash
npm run review:dashboard     # → http://127.0.0.1:8788/admin
```

HTTP Basic: `admin` / `$ADMIN_PASSWORD` (default `zelvoca`, localhost only).

**Deployed (same UI, same shared code):** the `api` Function serves `/admin`.
Set `ADMIN_PASSWORD` (and optionally `ADMIN_USERNAME`) in the Function
environment, then `neon deploy`. Until it's deployed, the local runner covers
the workflow with the same database.

What's on the dashboard:

| Section | What a reviewer does |
|---|---|
| **Drafts awaiting a human** | Expand "Review payload", read every exercise, Approve (optional note) or Reject |
| **Learner reports** | The “this sounds wrong” queue from the app — investigate, then Resolve with a note |
| **Version history** | Append-only audit: chapter ref, version, summary, reviewer, timestamp |
| **+ Submit a draft** | Paste human- or AI-authored chapter JSON into the same gated queue |

## Contributor program (per language, paid review)

**Scope.** Native speakers of each shipped language review (a) AI-drafted
chapters before approval, and (b) learner reports about their language.

**Roster.** Start with the six beta languages: **Spanish, Arabic, Japanese,
French, Hindi, Mandarin** — one trusted reviewer each, two for Spanish (volume).

**Engagement.** Contracted per review cycle, paid per accepted review (rate set
by the owner at onboarding). Deliverable per cycle:

1. Every queued draft for their language: approve/reject with a note.
2. Every open learner report for their language: resolve with a finding
   ("learner error", "content error — fixed in v-next", "not actionable").
3. A short monthly summary of recurring learner confusions → feeds the next
   AI-draft prompt iteration.

**Reviewer checklist** (per chapter):

- [ ] Every answer is correct **and** natural for native speakers
- [ ] All `type` exercises state translation direction; accepted variants include
      unaccented spellings
- [ ] `choose`/`listen` options: exactly 4, distinct, canonical answer present
- [ ] Notes are accurate (grammar + culture) and written neutrally
- [ ] At least half the exercises carry a `vocab` entry (feeds spaced repetition)
- [ ] Content matches the declared CEFR band

**How to join:** open an issue titled `Content reviewer — <language>` with two
sample corrections of AI-drafted exercises. Reviews are paid once the
engagement terms are agreed.

## Learner reporting (in-app)

Every AI tutor bubble has a 🚩 flag button → “Sounds wrong” / “Wrong
translation”. Reports are:

1. Written to an **on-device queue first** (never lost — offline-safe),
2. flushed to `POST /api/reports` (JWT-authenticated) when possible,
3. shown in the dashboard's **Learner reports** queue,
4. resolved by a human with a note (which is itself auditable).

## Guarantees (the moat)

- AI output is a **draft**, never a publish: the app cannot load unapproved
  content (Supabase RLS serves `status = 'approved'` only; the bundle only
  contains committed, reviewed files).
- Every approval has a **reviewer, timestamp, and version number**.
- Rejected drafts are retained (with reason) for prompt iteration.
- Learner feedback closes the loop: reports → review → versioned fixes →
  weekly content updates.
