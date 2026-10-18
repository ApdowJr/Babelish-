# Nativa — Phase 3 delivery checklist

_shipped 2026-10-18 · personalization_

| Piece | Status |
|---|---|
| Learner profile: name, job, interests, goals, native language | ✅ Profile tab editor, on-device (`src/state/profile.tsx`) |
| Context injection into every AI tutor prompt | ✅ `src/lib/profilePrompt.ts` spliced into the native-speaker system prompt |
| Adaptive difficulty: per-skill analytics (read/listen/write/speak) | ✅ `src/lib/analytics.ts` + `src/state/analytics.tsx`; weakest skill + `suggestLevel` (A1→B2) |
| Daily plan: ~10-min path tuned to weak spots | ✅ `src/lib/dailyPlan.ts` → Home "TODAY'S PLAN" (review → weak-skill drill → streak) |
| Real streak counter (was hardcoded "Day 1") | ✅ computed from activity events, survives timezones via local day keys |
| 57/57 node tests (analytics · daily plan · adaptive · profile prompt) | ✅ compiled standalone, run under node |
| tsc · expo lint · expo-doctor 20/20 · npm run build · neon:e2e 15/15 | ✅ all green, new strings bytecode-verified |

**Try it:** Profile tab → "LEARNING PROFILE" → set job + interests + goals.
Then Home → "TODAY'S PLAN": every row explains *why* it's there, and the Speak
tab's tutor now opens with examples from your world — watch its CEFR level chip
rise (A1 → A2 → B1 → B2) as you complete lessons.

Next up: **Phase 4 — Trust & accuracy** (see [ROADMAP.md](ROADMAP.md)).
