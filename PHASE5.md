# Zelvoca — Phase 5 delivery checklist

_shipped 2026-10-18 · retention & scale_

| Piece | Status |
|---|---|
| XP ledger — one published rule set, week rolls over in Mon-local time | ✅ `src/lib/xp.ts` (pure) + analytics state |
| Anti-farm XP: same-day replays earn nothing, fresh-day replays re-earn | ✅ `lessonXp()` tested |
| Leagues — lifetime tiers that **never demote** (no loss-aversion loops) | ✅ `src/lib/league.ts` (pure) |
| Weekly leaderboard on the backend, privacy-first | ✅ `weekly_xp` table + `GET/POST /api/league` |
| Rank shown is only "you + field size" — never another learner's identity | ✅ `rankLabel()`; null when absent (no fake rank) |
| Free tier = 1 **new** scenario/day; replays of today always free | ✅ `src/lib/plans.ts` (pure) + subscription state |
| Premium until billing lands | ✅ `ZELVOCA-BETA` code; upgrade sheet on the locked lesson |
| Referral + family plan | ✅ stable `NV……` code + share sheet; family = 6 seats (doc'd) |
| Daily reminder at the learner's chosen time | ✅ `expo-notifications`, one DAILY trigger, local-only |
| Reminder copy is honest | ✅ streak-free at schedule time (a daily repeat must stay true) |
| Offline packs | ✅ content is bundled → always installed; UI states it |
| Voice input named as online-only (it's cloud Whisper) | ✅ not hidden |
| 49/49 standalone tests · neon:e2e **45/45** (live DB, incl. leaderboard) | ✅ |
| tsc (app + functions) · lint · doctor 20/20 · build (both platforms) | ✅ all green |

**Bytecode:** all Phase 5 markers present. The Android-only channel strings
(`Daily practice reminder`) live in the **android** bundle only — the iOS
bundle correctly strips the `Platform.OS === 'android'` branch. That's platform
stripping working, not a bug.

**Try it:** Profile → pick a reminder time. Home → the LEAGUE card shows tier +
this week's XP bar. Learn → open a second lesson on the free plan to see the
gate; "Start premium (beta)" unlocks it.

Next up: **Phase 6 — Launch** (see [ROADMAP.md](ROADMAP.md)).
