# Zelvoca — Weekly feedback → curriculum loop

The Phase 6 loop that keeps beta languages improving without shipping app
updates. Everything here already exists as tooling; this doc is the runbook.

## The loop (every Monday)

```
learner reports (🚩)  ─┐
                       ├─► triage ─► AI draft ─► human approval ─► publish ─► eas update
operator notes        ─┘            (generate-curriculum.mjs)      (dashboard)   (app content)
```

1. **Triage** — open the review dashboard (`npm run review:dashboard`, or
   `/admin` on the `api` Function once deployed). The two queues:
   - `learner_reports` (open) — real learners flagged something. These are
     the highest-signal input; sort oldest-first.
   - `content_drafts` (draft) — AI-generated items awaiting approval.
2. **Draft** — for patterns that repeat (a phrase that trips learners, a gap
   in a chapter), run `scripts/generate-curriculum.mjs` scoped to that
   language + chapter. AI output lands as **drafts only** — the approval gate
   (`docs/CONTENT_REVIEW.md`) is the same one every piece of content has
   always gone through.
3. **Approve** — on the dashboard: review each draft's payload, approve with
   a note or reject with a reason. Approval writes an append-only
   `content_versions` row **before** the status flips — full audit trail.
4. **Resolve reports** — mark each learner report resolved with a note
   ("fixed in v3", "working as intended — clarified"). The note is shown in
   the queue so the next triage sees the history.
5. **Ship** — `eas update` (OTA). Curriculum is bundled JSON, so an OTA
   update is all a content change needs; no store review for wording fixes.
6. **Log** — add a line to `docs/CONTENT_LOG.md` per shipped change
   (language, chapter, what changed, report ids that motivated it).

## Beta-language focus order

Phase 6 betas (see `BETA_LANGUAGE_IDS`): **ES, AR, JA, FR, HI, ZH** — weekly
cadence, human reviewer per language (`docs/CONTENT_REVIEW.md` roster).

Preview languages (the remaining samplers) get the same loop but **monthly**,
and only once their beta starts.

## Health metrics (all privacy-first)

- Reports per language per week (from the queue itself — no telemetry needed)
- Approval latency: drafts open > 7 days = reviewer follow-up
- Lesson completion scores on-device (learners see them in the skill bars;
  nothing syncs — by design, `docs/PRIVACY.md`)

## Cadence promise (and how we keep it honest)

- Beta languages: content update **every Monday** (may be "no changes this
  week" — logged either way).
- Every AI draft is read by a human before publication. No exceptions, no
  auto-publish threshold — this is the trust story from Phase 4.
