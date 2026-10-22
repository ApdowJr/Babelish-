# Babelish 3.1 — what to fix next, what to upgrade, what to build

_Written 2026-10-22 against `main` @ `1806ee3` (Babelish 3.0.3)._

This is a working backlog, not a wish list. Every item below was checked against
the current source; the "evidence" column says where the gap is. Anything I
could not verify in this environment is marked **unverified**.

---

## 0. Where the product actually stands

| Area | State |
|---|---|
| Courses | 24 languages · 97 chapters · 204 lessons · 1,678 exercises, all bundled & validated |
| Review | Leitner queue, flashcards + typed recall, real session stats |
| Tutor | Server-hosted, zero setup for the learner, model fallback chain — **but the deployed Function has no key yet, so production is in Coach mode** |
| Voice input | Whisper via server or browser; microphone failures explained per cause |
| Voice output | OS/browser voices only; no neural TTS wired |
| Interface language | **English only** — in a 24-language app |
| Persistence | Lessons/vocab persist; **chat transcripts do not** |

The biggest risk right now is not a missing feature: it is that the tutor is
**not live in production**, and nothing alerts when that happens.

---

## P0 — Fix now (broken, dishonest, or blocking growth)

| # | Item | Why it matters | Evidence | Size |
|---|---|---|---|---|
| 1 | **Deploy the tutor + add a health gate** | Production still says "Coach mode". Add a smoke check that fails CI/deploy when `/api/ai/status` reports `chat:false` on a build that is supposed to be live. | `scripts/deploy-tutor.mjs` exists; no post-deploy assertion | S |
| 2 | **Daily quota + cost guard** | Free OpenRouter tiers are ~20 req/min and 50/day (1,000/day after a one-time $10 credit). One busy day and every learner drops to Coach mode with no explanation. Add a per-user daily budget, a server-side counter, and a "tutor is resting, resumes at HH:MM" state instead of a generic failure. | `functions/api/index.ts` has per-minute limiters only | M |
| 3 | **Cancel / stop generating** | A slow model blocks the composer with no way out; `AbortSignal` is plumbed but the UI never passes one. | `src/app/(tabs)/speak.tsx` has no abort path | S |
| 4 | **Persist the conversation** | Navigating to Words and back wipes the chat (state lives in the component). Store the last N turns per language+scenario, with a "Clear conversation" action. | no chat persistence in `src/state/*` | M |
| 5 | **Ground the tutor in the lesson** | Spec requires answers grounded in the course; currently the tutor gets level + scenario + profile but no lesson. Add "Ask about this" from the lesson player and pass `lessonId`, target vocab and any grammar note. | `src/app/lesson/[id].tsx` has no tutor link; `AiChatRequest` has no lesson field | M |
| 6 | **Stream tokens** | First token today waits for the whole reply (3–10 s). The gateway already uses SSE-capable fetch; parse `stream:true` and render progressively, with a paste-in fallback for providers that do not stream. | `functions/api/index.ts` sends no `stream`; chat.ts uses `stream:false` | M |
| 7 | **Error boundary + crash screen** | One render error is a white screen with no recovery. Add a route-level boundary that offers "Reload" and keeps the offline content reachable. | no `ErrorBoundary` in `src` | S |
| 8 | **Barge-in / echo guard** | Tapping the mic while the tutor speaks records the tutor's own voice. Stop TTS on record start and ignore a transcript that matches the last tutor line. | `speakNative`/recorder are independent | S |
| 9 | **Accessibility pass** | New pickers and chips need labels, focus order and dynamic-type safety; several hit areas are below 44 pt. Verify with a screen reader, not by eye. | spot-check shows partial labels | M |

---

## P1 — Upgrade (quality the learner can feel)

| # | Item | Why | Where | Size |
|---|---|---|---|---|
| 1 | **Localise the interface** | Learning Arabic in an English UI is a hard sell. Ship `en`, `ar` (RTL), `es`, `fr`, `sw`; the app already has a 24-language atlas but no i18n layer. | no `src/lib/i18n`; all strings inline | L |
| 2 | **Neural TTS (Kokoro / Piper)** | "No `ja-JP` voice installed" is common on cheap Android. A self-hosted TTS server gives every language a consistent voice, with the device voice as fallback. | `speakNative` only uses `expo-speech` | L |
| 3 | **Grammar notes for the 23 starter languages** | Courses are honest but shallow: vocabulary drills with no grammar. Needs native review, not generation. | `courseStatus().grammarNotes === false` for 23 | L |
| 4 | **Placement test** | `level: 'auto'` infers CEFR from completed lessons only, so a false beginner starts at A1 forever. A 12-question adaptive test sets the initial level. | `suggestLevel(lessonsCompleted)` | M |
| 5 | **Review: listening + speaking cards** | Review only tests recognition and typing; the two skills learners actually fail at are not in the queue. | `src/app/review.tsx` modes | M |
| 6 | **Coach becomes a drill loop** | Coach mode cycles cards with no check. Turn it into "hear it → type it → get it right" using the same exercise engine, so offline practice still teaches. | `offlineTutor.ts` cards only | M |
| 7 | **Prompt/token budget + caching** | System prompt is rebuilt per turn and history is unbounded up to 40 messages; cache the prompt and trim history by token estimate to control cost and latency. | `ai.ts` builds prompt each call | S |
| 8 | **Owner dashboard: usage** | `/admin` shows review queues but not tokens/day, model fallbacks or error rates — the numbers needed to decide whether the free tier holds. | `functions/admin.ts` | M |

---

## P2 — New features (value, in the order I would build them)

| # | Feature | Why it is worth it | Risk / honesty note | Size |
|---|---|---|---|---|
| 1 | **Somali (`so`) course** | You are in Somalia; the atlas skips the most obvious local language. Whisper lists Somali; the hosted Qwen3 model's table does **not** list it in the published family summary, so it would start as *unverified* until tested. | Needs a reviewed starter pack — do **not** machine-generate 22 words and call it a course. | L |
| 2 | **Hands-free voice mode** | Push-to-talk is not conversation. VAD + auto-play + barge-in makes the Speak tab feel like a tutor. | Battery and data; keep it opt-in. | L |
| 3 | **Acoustic pronunciation scoring** | Today's chips are word match, correctly labelled. Real scoring needs a phoneme model (wav2vec2/CTC + forced alignment), on-device for privacy. | Do not ship until it is measured against native audio; keep the word-match mode as fallback. | L |
| 4 | **PWA install + offline shell** | Web users currently cannot install the app or re-open it offline; a manifest + service worker caches the shell and today's lessons. | Must not cache the tutor or stale HTML. | M |
| 5 | **Shareable phrase cards / classroom mode** | A teacher assigns a chapter; a learner shares "today's 10 words" as an image. Organic growth without ads. | Privacy: share only learner-chosen content. | M |
| 6 | **Weekly progress email/report** | Retention hook grounded in real analytics already recorded. | Needs consent + unsubscribe. | M |
| 7 | **Multi-device chat sync** | Model prefs are device-local by design; conversation could sync like progress does. | Server storage of conversations needs a retention policy first. | M |
| 8 | **More authored courses (A2→B1)** | Content is the moat; the model is a commodity now. Pick 3 languages with demand and author them properly. | Authoring is the cost; generation without review breaks the honesty rule. | XL |

---

## What I would do in the next three sprints

**Sprint 1 — make the tutor trustworthy (≈1 week)**
1. Deploy + status gate (#P0-1), daily quota (#P0-2), cancel (#P0-3), error boundary (#P0-7).
2. Acceptance: a deploy without a working model fails the release check; a learner who hits the daily cap sees a dated "resumes at" message; a stuck reply can be cancelled; a forced render error shows a recovery screen.

**Sprint 2 — make conversation feel real (≈1–2 weeks)**
1. Streaming (#P0-6), persisted history (#P0-4), lesson grounding (#P0-5), barge-in (#P0-8).
2. Acceptance: first token < 1.5 s on a normal connection; leaving and returning keeps the thread; "Ask about this" opens the tutor with the lesson's vocabulary; recording stops TTS.

**Sprint 3 — reach more learners (≈2 weeks)**
1. Interface i18n with `ar` RTL + `sw` (#P1-1), placement test (#P1-4), review listening/speaking cards (#P1-5).
2. Acceptance: switching the interface language flips layout direction, persists, and passes a text-fit check; a new learner is placed at A2 after the test and sees A2-level tutor replies.

---

## Explicitly not doing (and why)

- **No "free forever" promise on hosted inference.** Free endpoints rotate and are
  rate-limited; the roadmap treats them as a bridge, and the quota work makes
  that visible instead of surprising.
- **No generated courses passed off as authored.** 23 languages carry the
  `Starter course` label until a human reviews them.
- **No pronunciation percentage** until real acoustic scoring exists.
- **No Somali launch** without a reviewed word list and a tested model path.
- **No interface translation by machine** for `ar`/`sw` — RTL and pluralisation
  need a human pass before shipping.

---

## Verification habits to keep

Every sprint ends with the same gates that produced 3.0.3:

```
npx tsc --noEmit
npm run check:functions
npx expo lint
npm test
npx expo export --platform web
```

plus one **live** check that cannot be faked: a real tutor reply from the
deployed Function, and a screenshot of it in the app.

---

## Progress — 2026-10-22 (branch `arena/ebb1335f-babelish`)

| P0 | Status | Where |
|---|---|---|
| 1 · Deploy gate | **Done** (code) — live deploy still unverified | `scripts/check-tutor.mjs`, `npm run deploy:tutor` |
| 2 · Daily quota | **Done** — atomic claims, dated refusal, refunds only for provider-free failures | `src/lib/quota.ts`, `functions/api/quotaStore.ts` |
| 3 · Cancel | **Done** — Stop button, AbortSignal end to end, upstream abort without refund | `RequestCancelled`, `speak.tsx` |
| 4 · Persist conversations | **Done** — per-owner books, capped, expiring, offline-safe | `src/lib/conversations.ts` |
| 5 · Lesson grounding | **Done** — lesson id → server-side lookup → prompt section | `findBundledLesson`, `lessonGrounding` |
| 6 · Stream tokens | **Not doing in 3.1** — see below | — |
| 7 · Error boundary | **Done** — in-tree + router-level crash screen | `src/components/ErrorBoundary.tsx` |
| 8 · Barge-in | **Done** — mic stops playback; one audio channel | `toggleSpeechTarget` |
| 9 · Accessibility pass | **Done (static)** — device screen-reader verification still open | `docs/A11Y_3_1.md` |

### Why streaming is not in 3.1

The tutor's contract is a single validated JSON object per turn: the server parses
`{reply, translation, tip}`, rejects an empty or wrong-script reply, and only then
answers the client. Streaming tokens would either expose partial JSON
(`{"reply":"Ho…`) or bypass that guardrail, and it would need SSE through the Neon
Function, a second client parse path, and different quota accounting for
abandoned streams. That is a real feature, not a flag — it belongs in its own
change with the guardrail redesigned (e.g. plain-text reply plus a separate
translation call), not smuggled in at the end of a hardening pass.

### Follow-ups from the 5-risk review (2026-10-22)

| Risk | Status | What changed |
|---|---|---|
| Guest key spoofable (`X-Forwarded-For`) | **Reduced** | `src/lib/clientIp.ts` normalises the header (first hop, no port, IPv4/IPv6 validated, ≤45 chars) and falls back to `unknown`; admin throttle uses it too. A spoofed address can still buy another *guest* allowance (6/day), never more — `AI_DAILY_BUDGET` caps total spend. Only a trusted proxy hop or a platform-provided client IP can close it fully. |
| Restore is per-device, no clear action | **Done (by design)** | Trash button in the Speak header clears one language/scenario chat after confirmation. No cloud sync: the privacy rules forbid server-side conversation storage, so transcripts stay in AsyncStorage and are capped (40 messages / 12 slots / 45 days). |
| Wrong-script retry costs two slots | **Fixed** | The server retries once inside the same request (`correctiveUsed`), keeping a single quota claim; the client no longer re-asks in gateway mode. A failed retry returns `bad-reply` and refunds. |
| Live tutor unproven | **Open — environment** | Requires `AI_API_KEY` and egress to OpenRouter/Neon from a networked machine: `AI_API_KEY=... npm run deploy:tutor` (or fill `.env.tutor`, gitignored, and run the same command). The gate then proves a real reply. Not verifiable in this sandbox. |
| Device verification (screen readers, 200 % text, RTL focus) | **Open — hardware** | `docs/A11Y_3_1.md` lists the script; `/dev-crash` now exercises the crash screen on-device. |
