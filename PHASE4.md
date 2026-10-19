# Zelvoca — Phase 4 delivery checklist

_shipped 2026-10-18 · trust & accuracy_

| Piece | Status |
|---|---|
| Human review dashboard — nothing publishes without approval | ✅ `/admin` on the Function + `npm run review:dashboard` locally |
| One shared implementation for both | ✅ `functions/api/admin.ts` (pure: SQL + validation + HTML) |
| Learner "this sounds wrong" → review queue | ✅ 🚩 on tutor bubbles → on-device queue → `POST /api/reports` → dashboard |
| Versioned curriculum (append-only audit) | ✅ `content_versions` written **before** approval; rejects write none |
| Contributor program (paid native reviewers, per language) | ✅ defined in `docs/CONTENT_REVIEW.md` (roster, checklist, rates) |
| XSS-safe dashboard (AI/user strings are untrusted) | ✅ every string through `escapeHtml` |
| 46/46 standalone tests · neon:e2e 35/35 (live DB) | ✅ validators, escaping, rendering, full draft→approve→version flow |
| tsc (app + functions) · lint · doctor 20/20 · build | ✅ all green |
| Deploy Function changes (`/admin`, `/api/reports`) | ✅ deployed 2026-10-18 (live smoke-tested) |

**Try it:** `npm run review:dashboard` → http://127.0.0.1:8788/admin
(admin / `zelvoca` locally). Paste chapter JSON in "+ Submit a draft", open the
payload, Approve → watch **Version history** gain `v1`. In the app: Speak tab →
any tutor bubble → 🚩 → pick a reason.

Next up: **Phase 5 — Retention & scale** (see [ROADMAP.md](ROADMAP.md)).
