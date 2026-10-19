# Zelvoca — Phase 6 delivery checklist

_shipped 2026-10-18 · launch readiness_

| Piece | Status |
|---|---|
| Store compliance — kids' privacy, speech data, permissions | ✅ `docs/STORE_COMPLIANCE.md` |
| Plain-language privacy policy + subprocessor list | ✅ `docs/PRIVACY.md` |
| Data portability (GDPR / both stores require it) | ✅ *Export my data* → JSON via share sheet (`src/lib/privacy.ts`) |
| Data deletion (Play "delete account" policy) | ✅ Profile → *Delete account* → local wipe + `DELETE /api/me` |
| Server erasure covers every user-keyed row | ✅ `app_state` + `weekly_xp` + `learner_reports`, parameterized, idempotent |
| Privacy-first analytics — on-device, no ad SDKs | ✅ events never sync; the policy says so and the code proves it |
| Beta per language: ES · AR · JA · FR · HI · ZH | ✅ `BETA_LANGUAGE_IDS` + BETA badges (learn list + language page) |
| Preview languages labeled honestly | ✅ "PREVIEW — sampler chapter" chip |
| Feedback loop → weekly curriculum updates | ✅ runbook in `docs/FEEDBACK_LOOP.md` (reports → drafts → humans → OTA) |
| 13/13 standalone tests · neon:e2e **50/50** (live DB, incl. deletion suite) | ✅ |
| tsc (app + functions) · lint · doctor 20/20 · dual-platform build | ✅ all green |

**Try it:** Profile → PRIVACY → *Export my data* (share sheet, real JSON) and
*Delete account* (destructive confirm). Learn tab → BETA chips on the six
launch languages; language page says BETA vs PREVIEW.

**Launch checklist (remaining):** fill store privacy forms from
`docs/STORE_COMPLIANCE.md`, verify mic permission in EAS binaries.
_Done since: auth-user deletion at deploy (Neon Auth admin API, deployment 5
— `DELETE /api/me` removes the auth user too, verified live);
`ADMIN_PASSWORD` set on the deployed Function (deployment 2, 2026-10-18)._

All six phases are now checked in [ROADMAP.md](ROADMAP.md).
