# Changelog

All notable changes to Babelish. The format follows Keep a Changelog and the
project uses semantic versioning.

## [3.0.1] — 2026-10-22

### Changed

- **The learner never configures a model.** The `Settings → AI model` screen,
  the "OPEN-SOURCE AI / Models, not middlemen" copy and the Speak model bar are
  gone. The tutor is a server-side concern: the app probes its own backend and
  starts talking.
- Default mode is now `server`; nothing probes `localhost` or offers a download
  on first run. Local/LAN/browser adapters remain in code for self-hosters.
- The tutor server fronts a **fallback chain** (`AI_MODELS`,
  comma-separated). Defaults to OpenRouter's free Qwen3-Next endpoints, which
  document all 24 atlas languages; a retired free model moves to the next
  instead of failing the turn.
- `GET /api/ai/status` also reports `models[]` and `sttEnabled`.
- Guest access: `/api/ai/chat` and `/api/ai/stt` now work without a session
  under a tighter per-IP budget (6 chats + 2 transcriptions per minute), so
  demo mode has a real tutor. Every other `/api/*` route still requires a JWT.

### Fixed

- **"Microphone access is off — enable it in Settings to speak" is gone.** That
  message conflated four different failures and pointed at a screen browsers do
  not have. `src/lib/mic.ts` keeps the real cause and gives actionable advice:
  embedded frame → open in a tab; denied → address-bar lock icon; insecure
  origin → use HTTPS; no device; device busy; native denial → an Open-settings
  button that actually works.
- The mic button no longer disables itself silently when no speech model is
  configured — tapping explains the options, including one-tap browser Whisper.
- Gateway adapters tolerate a missing session (no Authorization header) and
  treat 401/403 as "coach mode" instead of an error mid-conversation.

## [3.0.0] — 2026-10-22

### Added

- **Open-source AI layer** (`src/lib/models/*`): replaceable adapters for Ollama,
  any OpenAI-compatible server, Babelish's self-hosted gateway and
  Transformers.js in the browser, plus a bundled offline coach. No paid API is
  required for any core feature and none is used by default.
- **Model catalogue with honest coverage**: Qwen2.5 (15 documented languages),
  Llama 3.2, Aya Expanse, Whisper large-v3-turbo/base, Kokoro-82M and Piper,
  each with licence, commercial-use flag, size and hardware notes. Unverified
  languages are blocked unless the learner opts in.
- **Settings → AI model**: runtime modes (auto · this device/LAN · app server ·
  in this browser · offline), engine check with real probes, per-language
  coverage card, server URLs and model ids, speech model picker, browser toggle,
  hardware/cost table and reset.
- **Tutor upgrades**: CEFR level chips, explanations and tips in the learner's
  native language, scenario role-play, strict JSON contract, target-script
  guard with one corrective retry.
- **Voice pipeline**: permission on demand → recording → Whisper (gateway, LAN
  or browser) → tutor → TTS with replay and 0.55× slow mode, with actionable
  error states and typing always available.
- **Real starter courses for 23 languages**: 4 chapters · 8 lessons · 66
  exercises each (1,518 exercises) covering choose, type, listen and speak,
  built from verified starter words. Spanish keeps its 5-chapter authored course.
- **Course tier labels** (`src/lib/curriculum/status.ts`) so a starter course is
  never presented as a complete CEFR path.
- **Rebuilt review screen**: due-card queue both ways, typed recall, Leitner box
  movement, real session stats and a weakest-skill recommendation.
- Tests for model config/adapters, the offline coach, course data and review
  maths (14 files, 105 tests), and `docs/AI_ARCHITECTURE.md`.

### Changed

- The gateway (`functions/api`) now defaults to a **self-hosted, keyless**
  OpenAI-compatible endpoint and reports 503 `ai-not-configured` unless the owner
  explicitly opts in. `AI_MODEL` defaults to `qwen2.5:1.5b`,
  `AI_STT_MODEL` to `whisper-large-v3-turbo`.
- Speak, Profile and the status rows name the runtime and model that actually
  answered; "Checking…" is shown until a probe resolves.
- Pronunciation chips are labelled **word match** and explicitly described as
  transcript accuracy, not acoustic scoring.
- App/package version bumped to 3.0.0.

## [2.0.0] — 2026-10-22

### Added

- **24-language atlas** (10 → 24): Italian, Dutch, Swedish, Polish, Ukrainian,
  Greek, Turkish, Hebrew, Persian, Bengali, Korean, Vietnamese, Thai, Indonesian
  join the original ten, each with dialects, script, difficulty and a greeting.
- **Starter packs for every language**: *First words* + *Numbers 1–10*, generated
  from curated word lists (22 words per language, 528 total), all offline.
- **Onboarding** — 3-step welcome with language search, daily goal and native
  language; migrated users skip it.
- **Words tab** — review practice, searchable phrasebook with native audio and
  save-to-review, plus 12 achievements and the XP ledger.
- **Daily goals** (5/10/15/20 min) with a real today-XP progress bar.
- **Multi-language tracking** with per-course progress in Home and Explore.
- **New design system** — warm atlas palette, typography, shadow scale, web
  max-width, floating tab bar and a raised Speak orb.
- **Home rebuild** — continue hero, stat tiles, daily plan, my languages, word of
  the day, weekly rhythm and featured-language rail.
- **Language page rebuild** — gradient hero, course progress, chapters, starter
  phrasebook preview and scenario rail.
- **Profile rebuild** — goal picker, my-languages management, free-plan card,
  supporter code and v2 status.
- **Working lesson speaking cards** with native reference audio.
- New primitives: `Card`, `SectionHeader`, `ProgressBar`, `StatTile`,
  `WeeklyBars`, `SegmentedControl`, `Pill`, `EmptyState`, `AuthHero`.
- Tests for the atlas, starter packs, XP ledger, achievements and language
  counting.
- `docs/RELEASE_2_0.md` and this changelog.

### Changed

- **Every lesson is free** — the free plan's 1-lesson/day limit and its paywall
  screen were removed; premium is now an optional supporter tier.
- Free-tier copy across Home, Explore, the language page and Profile.
- App/package version bumped to 2.0.0.
- The app forces the light "warm atlas" theme (`userInterfaceStyle: light`)
  to match the rendered UI.
- `BABELISH-BETA` now redeems correctly (previously it was rejected).
- Signed-in users now skip the auth stack and land on Home (or onboarding).

### Fixed

- Lesson speaking exercises no longer claim to be "locked until Phase 2".
- Supporter code redemption in Profile no longer fails silently.
- `forgot-password` and footer links use a readable primary colour instead of a
  12 %-opacity fill.
- Loading indicators are visible on the new parchment background.
- Bottom content no longer hides under the floating tab bar.
