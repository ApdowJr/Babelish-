# Nativa — Roadmap to the 2027 Language Learning App

> **Vision:** An AI language tutor that speaks *every* language like a native speaker —
> accurate curriculum, real pronunciation, real scenarios, personalized to each learner.

Working name: **Nativa** (rename freely; it's one constant in `app.json`).

---

## 1. Product Pillars (what "real" means)

| Pillar | 2027 standard |
|---|---|
| **Native-level AI speech** | The AI speaks in the target language at all times, with locale-correct TTS voices (accent, gender, region), natural pacing, and slang/formality awareness (tú vs usted, register shifts). |
| **Accurate chapters** | Curriculum per language follows real proficiency frameworks (CEFR A1→C2), not invented content. Every chapter passes a human-review pipeline before shipping. |
| **Real scenarios** | Role-play from real life: airport, job interview, doctor, dating, bargaining in a market — each scenario is scripted *and* free-form, with culturally accurate behavior. |
| **Pronunciation** | Speech-to-text + phoneme-level scoring. The learner speaks; we score accuracy and show exactly which sounds to fix, with reference audio from the native voice. |
| **Personalization** | Examples use the learner's own name, job, hobbies, and past mistakes. The AI adapts difficulty live based on performance. |

---

## 2. Tech Stack (locked)

| Layer | Choice | Why |
|---|---|---|
| App | **Expo (React Native) + expo-router** | One codebase, OTA updates, native audio APIs |
| Language | **TypeScript** everywhere | Safety as the codebase grows |
| Auth/DB | **Supabase** (Auth + Postgres + RLS) | Real email/password + OAuth, row-level security per user |
| AI (chat) | **OpenAI-compatible LLM API** (configurable URL/model) | Swap providers without code changes |
| TTS | **expo-speech** (on-device native voices) + cloud TTS API | Device voices give instant, offline pronunciation; cloud voices give studio quality |
| STT/scoring | Speech-recognition adapter (pluggable) | Score pronunciation per phoneme |
| State | React Context + hooks (Zustand later if needed) | Simple until it isn't |

**Configuration:** all secrets live in `.env` (see `.env.example`). The app runs in
**demo mode** (scripted AI) until you paste real keys — so the UI is always testable.

---

## 3. Phases

### ✅ Phase 0 — Foundations (this build)
- [x] Project scaffold (Expo + TypeScript + expo-router)
- [x] Design system: tokens (color, spacing, typography, radius), core components
- [x] **Real auth**: Sign up / Sign in / Forgot password via Supabase, session persistence
- [x] Auth gate + protected routes
- [x] Tab shell: Home · Learn · Speak · Profile
- [x] AI service layer (chat + TTS adapters) with native-speaker system prompts
- [x] Seed language data (real dialects, native names, speaker counts)

### ✅ Phase 1 — Learning content engine (shipped 2026-10-18)
- [x] Chapter model: units → lessons → exercises (multiple choice, typing, listening; speaking placeholder locked for Phase 2)
- [x] CEFR-aligned curriculum: Spanish A1 hand-authored (5 chapters × 4 lessons), 9 language samplers; AI draft generator (`scripts/generate-curriculum.mjs`, drafts-only + human approval flag in DB — never auto-publishes)
- [x] Language detail screen: chapter list with progress bars, 70%+ unlock chain, lesson scores
- [x] Lesson player: choose · type · listen with native TTS, accent-lenient grading, culture/grammar notes, XP + completion screen
- [x] Spaced-repetition review (Leitner boxes 1/2/4/8/15 days): missed words → daily review screen + Home card + Profile stats
- [x] Storage: Supabase tables + RLS (`supabase/schema.sql`) with bundled-JSON fallback for demo mode

### ✅ Backend on Neon (shipped 2026-10-18)
- [x] Infra as code: `neon.ts` → `neon deploy` provisions Managed Better Auth, Functions, Object Storage (`assets`) on branch `production`
- [x] **Managed Better Auth** wired into `AuthContext` as a third mode (Neon · Supabase · demo): sign-up/sign-in/session restore/password-reset, trusted origin `https://nativa.app`
- [x] **`api` Function** (`functions/api/index.ts`, Hono): health, `GET/PUT /api/state` (JWT-verified against branch JWKS, user id from `sub`), presigned storage URLs — cross-user access denied by construction
- [x] **Lakebase Postgres**: `neon/schema.sql` (`public.app_state`) applied to the branch
- [x] **Object Storage**: private `assets` bucket, presigned PUT/GET under `users/{id}/` prefixes
- [x] **Two-way progress sync** in `LearningProvider`: device ∪ server merge (best score / Leitner box wins), fire-and-forget on every lesson/review; Profile shows sync status
- [x] Proofs: `npm run neon:e2e` (15/15 checks) · `npm run build` · `npx expo lint` · `tsc` (app + functions) · `expo-doctor` 20/20
- [ ] Neon **AI Gateway** — paid-plan feature; app keeps OpenAI-compatible `EXPO_PUBLIC_AI_*` path (re-add `aiGateway: true` to `neon.ts` after upgrade)

### ✅ Phase 2 — Speaking & pronunciation (shipped 2026-10-18)
- [x] Scenario role-play studio on the Speak tab: scenario chips · in-language-only tutor (existing native-speaker prompt) · per-scenario key-phrase phrasebook for all 10 languages (`src/data/practice.ts`)
- [x] **Voice I/O**: record (`expo-audio`, in Expo Go) → STT via OpenAI-compatible `/audio/transcriptions` (`whisper-1` by default, `EXPO_PUBLIC_AI_STT_MODEL`) → AI reply → native TTS playback; 30s cap, mic-permission flow, graceful "type instead" fallback
- [x] **Pronunciation scoring** (`src/lib/pronunciation.ts`): word-level Levenshtein alignment → exact/close/missed per word + extras, accent/tashkeel/punctuation-blind, char-based for 中文/日本語; score card with per-word color chips + "I heard" transcript + TTS reference audio (slow); best score per phrase persisted (`src/lib/speaking.ts`)
- [x] **Conversation controls**: Listen (repeat) · 🐢 Slow (rate 0.55) · per-message Translate on every tutor bubble + global translation toggle
- [x] Works in **demo mode**: typed practice gets the same word-by-word scoring without any AI key; voice needs the same `EXPO_PUBLIC_AI_*` endpoint as chat
- [x] Proofs: 19/19 scoring-engine tests (compiled + node-run) · `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor` 20/20 · `npm run build` (Hermes bundles)
- [ ] On-device pass in Expo Go (mic record → STT round-trip needs a real phone + AI key)

### 🗓 Phase 3 — Personalization
- [x] Learner profile (name, job, interests, native language, goals) — Profile tab editor, stored on device (`src/state/profile.tsx`)
- [x] Context injection: profile + adaptive CEFR level spliced into every tutor prompt (`src/lib/profilePrompt.ts`, `src/lib/adaptive.ts`)
- [x] Adaptive difficulty from per-skill analytics (listening/speaking/reading/writing) — lesson answers + pronunciation scores tallied per skill (`src/lib/analytics.ts`, `src/state/analytics.tsx`); weakest skill drives the plan, `suggestLevel` (A1→B2) drives tutor difficulty
- [x] Daily plan: ~10-minute path tuned to weak spots — due reviews → weakest-skill drill → keep-the-streak, with "why this card" subtitles (`src/lib/dailyPlan.ts`), Home "TODAY'S PLAN" section
- [x] Real streak counter on Home (replaces hardcoded "Day 1"), computed from activity events
- [x] Proofs: 57/57 node tests (analytics · daily plan · adaptive · profile prompt, compiled + run standalone) · `npx tsc --noEmit` · `npx expo lint` · `npx expo-doctor` 20/20 · `npm run build` (Hermes bundles, bytecode-verified) · `npm run neon:e2e` 15/15 regression

### 🗓 Phase 4 — Trust & accuracy (the moat)
- [x] Human review dashboard: every AI-drafted chapter must be approved before publish — `/admin` on the `api` Function **and** runnable locally today via `npm run review:dashboard`; one shared implementation (`functions/api/admin.ts`), HTTP Basic gated (constant-time compare), full-payload review + approve/reject with notes
- [x] Native-speaker contributor program (per language, paid review) — program defined: roster (6 beta languages), per-cycle deliverables, reviewer checklist, rates contract; `docs/CONTENT_REVIEW.md` (onboarding is operational)
- [x] Learner reporting: "this sounds wrong" → review queue — 🚩 flag on every tutor bubble → queue-first on-device (never lost) → `POST /api/reports` (JWT) → dashboard queue → human resolves with a note
- [x] Versioned curriculum: content changes are auditable, never silently rewrite history — `content_versions` is append-only and written **before** the status flip; rejections write no version; publishes ride git; version history rendered on the dashboard
- [x] Proofs: 46/46 standalone tests (XSS escaping · validators · dashboard rendering) · `npm run neon:e2e` **35/35** (20 new content-pipeline checks against the live DB) · live dashboard smoke (submit → approve → v1, reject, report resolve) · `tsc` app + functions · `expo lint` · `expo-doctor` 20/20 · `npm run build`
- [ ] Deploy `api` Function changes (`/admin` + `/api/reports` + `ADMIN_PASSWORD`) — requires a Neon API key (batch with the final git push); the local dashboard + queued reports cover the gap until then

### 🗓 Phase 5 — Retention & scale
- [ ] Streaks, XP, leagues (ethical gamification — no dark patterns)
- [ ] Offline lessons (download packs per language)
- [ ] Notifications: smart reminders based on the learner's own schedule
- [ ] Referral + family plans; free tier = 1 scenario/day, premium = unlimited

### 🗓 Phase 6 — Launch
- [ ] App Store / Play Store compliance (kids' privacy, speech data handling)
- [ ] Analytics events (privacy-first, no third-party ad SDKs)
- [ ] Beta per language (start: Spanish, Arabic, Japanese, French, Hindi, Mandarin)
- [ ] Feedback loop → weekly curriculum updates

---

## 4. AI Architecture (how "native speaker" is engineered)

```
System prompt (per language + dialect + register)
  + learner profile (name, job, level, weak spots)
  + conversation history
  + lesson context (current chapter/scenario)
        │
        ▼
   LLM ──► replies strictly in target language (enforced by prompt + validator)
        │
        ├──► TTS (locale voice: e.g. es-MX female, ar-EG male, ja-JP)
        └──► translation layer (separate call, user-toggleable)
```

Rules baked into every AI call:
1. **In-language-only mode** — the AI never breaks into English (except when the learner taps "explain").
2. **Register control** — formal/informal, regional vocabulary (vosotros vs ustedes, etc.).
3. **Level adaptation** — CEFR band controls sentence complexity and idiom density.
4. **Correction protocol** — mistakes get a gentle recast in-language, then the correction.
5. **Output validation** — responses are checked against the expected script family
   (e.g., Arabic → Arabic script) before display; invalid output is retried.

## 5. Accuracy Pipeline (why our chapters are real)

```
Draft (AI, CEFR-mapped) → Automated checks → Human native review → Published
                                                          │
Learner report ──────────────► Review queue ◄──────────────┘
```

- No chapter ships without a human approval flag in Postgres.
- Every published version is immutable; edits create new versions.
- Contributors are native speakers with linguistic credentials where possible.

## 6. Monetization (aligned with learning, not against it)

- **Free:** 1 full chapter per language + 1 scenario/day + basic AI chat (text).
- **Premium (~$12/mo):** unlimited scenarios, voice conversations, pronunciation scoring, offline packs, all languages.
- **Family / Student tiers** at launch+3 months.

## 7. Success Metrics (North stars)

- **D1 / D7 retention** per language cohort
- **Conversations completed per learner/week** (speaking minutes)
- **Pronunciation score improvement** over 30 days
- **Human-review pass rate** (curriculum quality proxy)
- **Free → Premium conversion**

## 8. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| AI invents inaccurate content | Mandatory human review gate (Phase 4) before any curriculum publishes |
| Bad TTS accents (robotic/wrong region) | Per-locale voice selection + cloud TTS fallback + contributor audio for hero content |
| API costs balloon | Cache lesson content, cap free-tier calls, smaller models for translations |
| Speech privacy concerns | Consent copy, on-device STT where possible, delete-raw-audio default |

---

## How to run what's built so far

```bash
cp .env.example .env      # paste Supabase + AI keys (or leave blank → demo mode)
npm install
npx expo start            # scan QR with Expo Go, or press i / a
```

Roadmap order is deliberate: **auth + shell now → content → voice → personalization → trust.**
The trust phase (human review) is what makes this *real* rather than another AI wrapper.
