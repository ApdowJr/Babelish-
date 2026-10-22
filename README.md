# Babelish 3.0 🌍

**Learn any of 25 languages free — with an open-source tutor you can host yourself.**

Babelish is an AI language tutor that talks to you *only* in your target
language. **You do not configure a model, download weights or paste a key** —
open Speak and the tutor answers.

Behind it, the app calls its own tutor server, which fronts open-weight models
(Qwen3-Next 80B on free endpoints by default). Voice input can run Whisper in
the browser for free, and a labelled coach keeps every screen usable when the
server is unreachable. Courses, review, the phrasebook and device audio never
needed a model at all.

> 25 languages · 101 chapters · 212 lessons · 1,744 exercises · 550 starter words
> bundled offline. Every lesson playable on the free plan.

## What's new in 3.4

| Area | 3.4 |
|---|---|
| **Dark mode** | System / Light / Dark in Settings → Appearance. A full night palette, every screen, status bar and tab bar included |
| **Progress** | `/progress` — six-week streak calendar, level progress and an honest per-skill breakdown |
| **Contrast** | Both palettes are tested against WCAG AA pair by pair; the daylight palette was darkened where it used to fail |
| **Theming** | `useTheme()` / `useThemedStyles()`; the static `colors` export is gone so a screen cannot silently stay light |

## What's new in 3.3

| Area | 3.3 |
|---|---|
| **Your profile** | A real editor — emoji avatar with six colour themes, bio, job, interests and goals, with a live preview of what the tutor sees |
| **Terms** | `/terms`, linked from Settings and from a consent line in onboarding |
| **Store readiness** | Bundle ids, version codes, permissions, iOS plist keys, `eas.json`, Play icon + feature graphic, notification icon |
| **Release gate** | `npm run check:release` blocks the mistakes that cost a build cycle |
| **First-run profile** | Name, avatar and goal asked during onboarding, before the first lesson |
| **Start over** | Settings → Reset progress clears learning data but keeps the account |

## What's new in 3.2

| Area | 3.2 |
|---|---|
| **Brand** | A new mark — a parchment bubble with a written line, answered by a tangerine bubble — replaces the template icon. Generated from `scripts/brand/generate-icons.py`, rebuilt from views in `BrandMark` |
| **Splash** | The native splash hands off to an animated overlay (mark settles, wordmark rises, hairline progress) and fades onto the ready app. Honours "Reduce motion" |
| **Settings** | A real settings screen: searchable groups (account, learning, languages, tutor, accessibility, data, about, danger) with switches, segmented choices and a language sheet |
| **Preferences** | Show translations, voice speed (slow / normal / fast), read replies aloud, reduce motion — validated once and applied everywhere |

## What's new in 3.0

| Area | 3.0 |
|---|---|
| **Zero-setup tutor** | No model screen, no downloads, no keys. The app probes its tutor server and starts talking |
| **Open-weight models** | The server runs Qwen3-Next 80B on free endpoints by default, with a fallback chain when a free model is retired; any OpenAI-compatible server (Ollama, llama.cpp, vLLM) also works |
| **Honest availability** | A real probe decides between "Tutor server" and "Coach mode" — the UI never claims a live model it did not reach |
| **Tutor** | Strict JSON contract, target-script guardrail, one corrective retry, CEFR level chips (Auto/A1/A2/B1/B2), explanations in your native language, scenario role-play |
| **Voice** | Mic permission on demand → record → Whisper (server or browser) → tutor → TTS with replay and 0.55× slow mode. Failures say what to fix (permission, iframe, no device, HTTPS) |
| **Offline coach** | With no server and no network, a labelled phrase coach keeps conversations possible; lessons, reviews and phrasebook never needed a model |
| **Courses** | Real 4-chapter starter courses for all 23 non-Spanish languages (66 exercises each), tier-labelled honestly; Spanish keeps its 5-chapter authored course |
| **Review** | Rebuilt review screen: due-word flashcards both ways, typed recall, Leitner box movement, real session stats, weakest-skill recommendation |
| **Docs** | `docs/AI_ARCHITECTURE.md` — architecture, coverage, setup, hardware, privacy, limitations |

## What works today

| Feature | Status |
|---|---|
| **Professional auth** — sign up / sign in / forgot password | ✅ Real Supabase or Neon auth; friendly errors |
| **Demo mode** — full app without any keys | ✅ Clearly labeled, device-local accounts |
| **25-language atlas** — real dialects, native names, scripts, speaker counts | ✅ `src/data/languages.ts` |
| **Starter courses** — 4 chapters × 8 lessons for 23 languages, all offline | ✅ 1,518 starter exercises + 160 in the Spanish course |
| **Spanish CEFR course** — 5 hand-authored chapters × 4 lessons × 8 exercises | ✅ Culture/grammar notes on every exercise |
| **Lesson player** — choose · type · listen · speak with native TTS | ✅ Accent-lenient grading, XP + completion |
| **Chapter unlocking** — chapter N opens at 70%+ on N−1 | ✅ Per-lesson scores on the language page |
| **Spaced repetition** — missed words enter a Leitner queue (1/2/4/8/15 days) | ✅ Rebuilt review screen + Words tab |
| **AI tutor** — level-aware conversation; verified model coverage varies by language | ✅ Hosted tutor server (zero setup) · coach fallback |
| **Voice input** — record → Whisper → tutor reply | ✅ Server or in-browser Whisper; typing always available; failures explain themselves |
| **Native TTS** — hear every reply in a locale voice (`es-ES`, `ar-EG`, `ja-JP`…) | ✅ expo-speech, with replay + slow mode |
| **Scenarios** — café, souk bargaining, konbini, job interview… | ✅ Chips switch context live |
| **Translations** — toggle English under every AI message | ✅ Explanation language follows your native language |
| **Learner profile** — name, job, interests, goals, native language | ✅ Feeds every AI prompt |
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
Indonesian, Swahili and Somali (Soomaali). Somali has a starter course; AI and speech-model coverage remains unverified until confirmed.

## Run it

```bash
npm install
cp .env.example .env    # optional — public Neon endpoints are baked in as defaults
npx expo start          # scan the QR with Expo Go (SDK 58)
npx expo start --web    # or run it in the browser
```

The app is usable with **no model at all**: lessons, reviews, phrasebook and
device audio work offline and the tutor shows the labelled coach. To give every
learner a live tutor, configure the **server** once — no app rebuild, nothing
for the learner to install:

```bash
AI_API_KEY=sk-or-... npm run deploy:tutor
```

That one command deploys the `api` Function with the model chain in its
environment — the key stays on the server, the app is untouched.

Free Qwen3 endpoints document 24 of 25 atlas languages; Somali is available as a starter course but remains unverified for this model. Prefer your own hardware?
Point `AI_API_URL` at Ollama/llama.cpp/vLLM instead — see
[`docs/AI_ARCHITECTURE.md`](docs/AI_ARCHITECTURE.md) §7.

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
3. **Tutor server** — the `api` Function proxies chat and speech to the model
   endpoint you configure (`AI_API_URL`, `AI_KEY`, `AI_MODELS`). The key stays in
   the Function's environment; the app only holds the public backend URL. Free
   hosted endpoints cost nothing per token but are rate-limited and rotate;
   self-hosting costs electricity. Either way the learner sees "Tutor server" or
   "Coach mode" — never a claim we cannot verify.

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
  components/           # Button · TextField · Chip · Logo · Screen · SectionHeader
                        # ProgressBar · StatTile · WeeklyBars · SegmentedControl · Pill
  context/              # AuthContext (Neon Auth · Supabase · demo mode)
  lib/
    ai.ts               # app-facing tutor/voice API (tutorReply · transcribeSpeech · TTS)
    mic.ts              # microphone failure → actionable message (iframe/permission/device)
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
    languages.ts        # 25-language atlas: dialects, scripts, difficulty, greetings
    starters.ts         # curated 22-word starter packs for every language
    practice.ts         # per-scenario key phrases (+ starter fallback for all 25)
    curriculum/
      es/               # hand-authored CEFR Spanish course (5 chapters)
      samplers.ts       # deterministic 4-chapter starter courses for the other 23
  theme/
    palette.ts          # day + night palettes, mode resolution, contrast rules
    tokens.ts           # "warm atlas" spacing, type, radii, shadows
    theme.tsx           # ThemeProvider · useTheme · useThemedStyles
functions/
  api/index.ts          # Neon Function: state sync · tutor server (model chain) · storage · review
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
