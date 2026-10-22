# Babelish 3.0 🌍

**Learn any of 24 languages free — with an open-source tutor you can host yourself.**

Babelish is an AI language tutor that talks to you *only* in your target
language. 3.0 rebuilds the AI layer around open-weight models: Qwen-class chat,
Whisper-class speech, a bundled offline coach, and optional browser or
self-hosted inference. **No paid AI API is required for any core feature** — and
the app never quietly reaches for one.

> 24 languages · 97 chapters · 204 lessons · 1,678 exercises · 528 starter words
> bundled offline. Every lesson playable on the free plan.

## What's new in 3.0

| Area | 3.0 |
|---|---|
| **Open-source AI** | Model adapters for Ollama, any OpenAI-compatible server, a self-hosted gateway and Transformers.js in the browser. No paid API in the default path |
| **Honest availability** | Every runtime is probed before the UI says "live". The badge, model bar and Profile rows name the actual runtime and model |
| **Tutor** | Strict JSON contract, target-script guardrail, one corrective retry, CEFR level chips (Auto/A1/A2/B1/B2), explanations in your native language, scenario role-play |
| **Voice** | Mic permission on demand → record → Whisper (server, LAN or browser) → tutor → TTS with replay and 0.55× slow mode. Word-match feedback is labelled as transcript accuracy, not phonetics |
| **Offline coach** | With no model and no network, a labelled phrase coach keeps conversations possible; lessons, reviews and phrasebook never needed a model |
| **Courses** | Real 4-chapter starter courses for all 23 non-Spanish languages (66 exercises each), tier-labelled honestly; Spanish keeps its 5-chapter authored course |
| **Review** | Rebuilt review screen: due-word flashcards both ways, typed recall, Leitner box movement, real session stats, weakest-skill recommendation |
| **Settings** | New `Settings → AI model`: modes, model catalogue, coverage per language, licences, server URLs, browser toggle, hardware table, reset |
| **Docs** | `docs/AI_ARCHITECTURE.md` — architecture, coverage, setup, hardware, privacy, limitations |

## What works today

| Feature | Status |
|---|---|
| **Professional auth** — sign up / sign in / forgot password | ✅ Real Supabase or Neon auth; friendly errors |
| **Demo mode** — full app without any keys | ✅ Clearly labeled, device-local accounts |
| **24-language atlas** — real dialects, native names, scripts, speaker counts | ✅ `src/data/languages.ts` |
| **Starter courses** — 4 chapters × 8 lessons for 23 languages, all offline | ✅ 1,518 starter exercises + 160 in the Spanish course |
| **Spanish CEFR course** — 5 hand-authored chapters × 4 lessons × 8 exercises | ✅ Culture/grammar notes on every exercise |
| **Lesson player** — choose · type · listen · speak with native TTS | ✅ Accent-lenient grading, XP + completion |
| **Chapter unlocking** — chapter N opens at 70%+ on N−1 | ✅ Per-lesson scores on the language page |
| **Spaced repetition** — missed words enter a Leitner queue (1/2/4/8/15 days) | ✅ Rebuilt review screen + Words tab |
| **AI tutor** — conversation in 24 languages, level-aware | ✅ Ollama · local server · self-hosted gateway · browser · offline coach |
| **Voice input** — record → Whisper → tutor reply | ✅ Server, LAN or in-browser Whisper; typing always available |
| **Native TTS** — hear every reply in a locale voice (`es-ES`, `ar-EG`, `ja-JP`…) | ✅ expo-speech, with replay + slow mode |
| **Scenarios** — café, souk bargaining, konbini, job interview… | ✅ Chips switch context live |
| **Translations** — toggle English under every AI message | ✅ Explanation language follows your native language |
| **Learner profile** — name, job, interests, goals, native language | ✅ Feeds every AI prompt |
| **Model settings** — local/LAN/server/browser/offline, per-language coverage | ✅ `Settings → AI model` |
| **Adaptive difficulty** — per-skill analytics pick the weakest skill | ✅ Tutor level auto-rises A1 → B2 |
| **Daily plan** — “~10 min” card tuned to due reviews + weak spots | ✅ Includes a real streak counter |
| **Review dashboard** — AI drafts need human approval to publish | ✅ `/admin` (deployed) + `npm run review:dashboard` (local) |
| **XP, levels & leagues** — published rules, lifetime tiers that never demote | ✅ Weekly target is a goal, never a threat |
| **All learning free** — no daily lesson cap anywhere in the product | ✅ Premium = optional supporter perks |
| **Offline packs** — every language ships inside the app | ✅ Lessons/reviews/phrasebook/TTS offline |
| **Data rights** — export & delete (GDPR / Play policy) | ✅ JSON export + in-app delete → `DELETE /api/me` |

**Languages in the atlas:** Spanish, French, German, Italian, Portuguese, Dutch,
Swedish, Polish, Russian, Ukrainian, Greek, Turkish, Arabic, Hebrew, Persian,
Hindi, Bengali, Mandarin Chinese, Japanese, Korean, Vietnamese, Thai,
Indonesian, Swahili. (Somali is not included — see
[`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) §3 for why we did not fake it.)

## Run it

```bash
npm install
cp .env.example .env    # optional — public Neon endpoints are baked in as defaults
npx expo start          # scan the QR with Expo Go (SDK 58)
npx expo start --web    # or run it in the browser
```

The app is fully usable with **no model at all**: lessons, reviews, phrasebook
and device audio work offline, and the tutor answers through the labelled
offline coach. Want a real tutor? Point it at a local model — no key needed:

```bash
ollama pull qwen2.5:1.5b
OLLAMA_ORIGINS='*' ollama serve     # dev only; restrict the origin in production
```

Then open **Settings → AI model → Check**. For a phone on the same Wi-Fi, use
the computer's LAN address (`http://192.168.x.x:11434`) in the Ollama URL field.
Any OpenAI-compatible server (LM Studio, llama.cpp, vLLM, LocalAI) works too.

Want a fully local preview with no backend? `EXPO_PUBLIC_NEON_DISABLED=1 npx
expo start --web` runs the whole app in device-local demo mode.

## Connect real services (optional)

1. **Backend (Neon)** — the app is wired to a Neon branch: **Managed Better Auth**
   (real accounts + password reset), the **`api` Function** (JWT-verified progress
   sync + presigned Object Storage), **Lakebase Postgres** (`neon/schema.sql`) and
   the **`assets`** bucket. `neon deploy` provisions everything and pulls the branch
   endpoints into `.env.local`; `npm run neon:e2e` proves each service end to end.
2. **Accounts (Supabase, legacy)** — create a free [Supabase](https://supabase.com)
   project and put its URL and anon key in `.env`. Used only when Neon isn't configured.
3. **Self-hosted inference gateway (optional)** — deploy the `api` Function and set
   `AI_API_URL` to an OpenAI-compatible server you host (plus `AI_MODEL`, and
   `AI_STT_MODEL` if it serves `/audio/transcriptions`). A server key stays in the
   Function's environment; the app only holds its public URL. If you point it at a
   paid provider, that is your choice and your bill — nothing defaults to one.

The full matrix — local, self-hosted and external — is in
[`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md).

## Project structure

```
src/
  app/                  # expo-router screens
    onboarding.tsx      # 3-step welcome (language · goal · native language)
    (auth)/             # login · signup · forgot-password   (protected: signed-out)
    (tabs)/             # home · explore · speak · words · you (protected: signed-in)
    language/[id].tsx   # language detail (hero · progress · chapters · phrasebook)
    lesson/[id].tsx     # lesson player (choose · type · listen · speak + native TTS)
    review.tsx          # daily Leitner review with real session stats
    settings/ai.tsx     # AI model settings (modes · coverage · servers · hardware)
  components/           # Button · TextField · Chip · Logo · Screen · SectionHeader
                        # ProgressBar · StatTile · WeeklyBars · SegmentedControl · Pill
  context/              # AuthContext (Neon Auth · Supabase · demo mode)
  lib/
    ai.ts               # app-facing tutor/voice API (tutorReply · transcribeSpeech · TTS)
    aiCore.ts           # prompt + strict JSON contract + script guard (shared w/ Function)
    models/
      catalog.ts        # model catalogue, language tables, licences
      config.ts         # defaults, URL sanitising, runtime planning, coverage gate
      chat.ts           # Ollama · OpenAI-compatible · gateway · browser adapters
      stt.ts            # gateway · local Whisper · browser Whisper
      browser.ts        # Transformers.js loader, chat, audio decode/resample
      offlineTutor.ts   # bundled coach (clearly labelled)
      settings.ts       # on-device settings store
      status.ts         # probe → honest AiStatus
    curriculum/         # types · store · status (authored vs starter tiers)
    voice/STT upload · word-match scoring · alerts · config validation
    catalog.ts          # course stats & per-language progress (bundled, offline)
    phrasebook.ts       # merged starter + curriculum phrases, search, word of the day
    achievements.ts     # 12 badges, pure & testable
    xp.ts               # published XP rules + lifetime/weekly/daily ledgers
  state/                # preferences · learning · profile · analytics
  data/
    languages.ts        # 24-language atlas: dialects, scripts, difficulty, greetings
    starters.ts         # curated 22-word starter packs for every language
    practice.ts         # per-scenario key phrases (+ starter fallback for all 24)
    curriculum/
      es/               # hand-authored CEFR Spanish course (5 chapters)
      samplers.ts       # deterministic 4-chapter starter courses for the other 23
  theme/tokens.ts       # "warm atlas" design tokens
functions/
  api/index.ts          # Neon Function: state sync · optional AI gateway · storage · review
neon/schema.sql         # Lakebase Postgres schema (app_state)
supabase/schema.sql     # legacy tables + RLS
scripts/                # curriculum drafts · neon e2e · zero-dep tests · local API smoke
docs/AI_ARCHITECTURE.md # models, coverage, setup, hardware, privacy, limits
docs/DEPLOYMENT.md      # how to deploy the backend, web and mobile builds
docs/RELEASE_2_0.md     # the 2.0 release notes (atlas + free plan)
```

## Curriculum pipeline

Content ships **bundled** (works offline & in demo mode). When the legacy
Supabase backend is configured, **approved** chapters from that database
override the bundle. Every language in the atlas has a course: Spanish is
hand-authored, the other 23 are built by the deterministic starter-pack builder
(`src/data/curriculum/samplers.ts`).

`node scripts/generate-curriculum.mjs es "En el restaurante"` drafts new
chapters with your AI key into `src/data/curriculum/drafts/` — review them,
insert with `status='draft'`, and flip to `approved` yourself. Publishing is
never automatic.

## Quality gates

```bash
npm test                 # ✅ 105 unit tests / 14 files (atlas · models · courses · review · XP · AI · uploads)
npm run smoke:local      # ✅ the real Function from source
npm run neon:e2e         # ✅ 50 checks against the live deployed backend
npx tsc --noEmit         # ✅ typecheck (app)
npm run check:functions  # ✅ typecheck (functions)
npx expo lint            # ✅ lint
npx expo export --platform web   # ✅ production web build
```
