# Babelish 2.0 🌍

**Speak like a native — and learn any of 24 languages for free.**

An AI language tutor that talks to you *only* in your target language, with real
dialects, real scenarios and native pronunciation. Babelish 2.0 rebuilds the
experience around one promise: **the whole atlas is free.** No locked chapters,
no trial timer, no card.

> 24 languages · 51 chapters · 66 lessons · 666 exercises · 528 starter words
> bundled offline. Every lesson playable on the free plan.

## What's new in 2.0

| Area | 2.0 |
|---|---|
| **Atlas** | 10 → **24 languages**, each with a real starter pack (`First words` + `Numbers 1–10`) |
| **Free** | Removed the 1-lesson/day gate — every language, lesson, retake and phrase is unlimited and free |
| **Onboarding** | New 3-step welcome: pick a language, set a daily goal, choose your native language |
| **Design** | New "warm atlas" design system, floating tab bar, rebuilt Home, Explore, Language, You |
| **Words tab** | Review queue · searchable phrasebook with native audio · achievements & XP ledger |
| **Daily goal** | 5/10/15/20-minute goals with a real today-XP progress bar |
| **Multi-language** | "My languages" — track progress across several languages at once |
| **Home** | Continue hero, streak/XP/vocab tiles, daily plan, word of the day, weekly rhythm, language rail |
| **Speaking exercises** | Lesson speaking cards now play the native reference voice instead of showing a "locked" placeholder |
| **Docs** | `docs/RELEASE_2_0.md`, new tests for the atlas, XP and achievements |

## What works today

| Feature | Status |
|---|---|
| **Professional auth** — sign up / sign in / forgot password | ✅ Real Supabase or Neon auth; friendly errors |
| **Demo mode** — full app without any keys | ✅ Clearly labeled, device-local accounts |
| **24-language atlas** — real dialects, native names, scripts, speaker counts | ✅ `src/data/languages.ts` |
| **Free starter packs** — 2 chapters for every language, all offline | ✅ 46 generated lessons + audio |
| **Spanish CEFR course** — 5 hand-authored chapters × 4 lessons × 8 exercises | ✅ Culture/grammar notes on every exercise |
| **Lesson player** — choose · type · listen · speak with native TTS | ✅ Accent-lenient grading, XP + completion |
| **Chapter unlocking** — chapter N opens at 70%+ on N−1 | ✅ Per-lesson scores on the language page |
| **Spaced repetition** — missed words enter a Leitner queue (1/2/4/8/15 days) | ✅ Review screen + Words tab |
| **Phrasebook** — 528 starter words + curriculum vocabulary, searchable, with audio | ✅ Save any phrase to review |
| **Achievements** — 12 badges with honest, visible progress | ✅ Never expire, never demote |
| **Daily goal** — 5/10/15/20 min, real today-XP bar | ✅ Changeable in You |
| **Multi-language tracking** — my languages with per-course progress | ✅ Home rail + Explore |
| **AI Speak tab** — live conversation in 24 languages | ✅ Any OpenAI-compatible API |
| **Native TTS** — hear every reply in a locale voice (`es-ES`, `ar-EG`, `ja-JP`…) | ✅ expo-speech |
| **Scenarios** — café, souk bargaining, konbini, job interview… | ✅ Chips switch context live |
| **Translations** — toggle English under every AI message | ✅ |
| **Voice input** — speak your replies (record → Whisper STT → AI reply) | ✅ Any OpenAI-compatible endpoint |
| **Pronunciation scoring** — per-word green/amber/red chips + reference audio | ✅ Works typed in demo mode |
| **Learner profile** — name, job, interests, goals, native language | ✅ Feeds every AI prompt |
| **Adaptive difficulty** — per-skill analytics pick the weakest skill | ✅ Tutor level auto-rises A1 → B2 |
| **Daily plan** — “~10 min” card tuned to due reviews + weak spots | ✅ Includes a real streak counter |
| **Review dashboard** — AI drafts need human approval to publish | ✅ `/admin` (deployed) + `npm run review:dashboard` (local) |
| **Report 🚩** — “this sounds wrong” on any tutor message | ✅ Offline-first queue → human review |
| **Versioned curriculum** — append-only audit of every approval | ✅ Version row written before status flips |
| **XP, levels & leagues** — published rules, lifetime tiers that never demote | ✅ Weekly target is a goal, never a threat |
| **All learning free** — no daily lesson cap anywhere in the product | ✅ Premium = optional supporter perks |
| **Daily reminders** — one local notification at a learner-chosen time | ✅ Local-only, no push servers |
| **Offline packs** — every language ships inside the app | ✅ Lessons/reviews/phrasebook/TTS offline |
| **Referral + family** — shareable code, up to 6 seats | ✅ Share sheet; billing completes it at launch |
| **Data rights** — export & delete (GDPR / Play policy) | ✅ JSON export + in-app delete → `DELETE /api/me` |
| **Store compliance** — kids' privacy, speech data, permissions | ✅ `docs/STORE_COMPLIANCE.md` + `docs/PRIVACY.md` |
| **Feedback loop** — learner reports → drafts → humans → OTA | ✅ weekly runbook in `docs/FEEDBACK_LOOP.md` |

**Languages in the atlas:** Spanish, French, German, Italian, Portuguese, Dutch,
Swedish, Polish, Russian, Ukrainian, Greek, Turkish, Arabic, Hebrew, Persian,
Hindi, Bengali, Mandarin Chinese, Japanese, Korean, Vietnamese, Thai,
Indonesian, Swahili.

## Run it

```bash
npm install
cp .env.example .env    # optional — public Neon endpoints are baked in as defaults
npx expo start          # scan the QR with Expo Go (SDK 58)
npx expo start --web    # or run it in the browser
```

Want a fully local preview? `EXPO_PUBLIC_NEON_DISABLED=1 npx expo start --web`
runs the whole app in device-local demo mode (any email + 8-character password
creates an account).

## Connect real services (recommended)

1. **Backend (Neon)** — the app is wired to a Neon branch: **Managed Better Auth**
   (real accounts + password reset), the **`api` Function** (JWT-verified progress
   sync + presigned Object Storage), **Lakebase Postgres** (`neon/schema.sql`) and
   the **`assets`** bucket. `neon deploy` provisions everything and pulls the branch
   endpoints into `.env.local`; `npm run neon:e2e` proves each service end to end.
   (Neon's AI Gateway needs a paid plan — until then use any OpenAI-compatible key below.)
2. **Accounts (Supabase, legacy)** — create a free [Supabase](https://supabase.com)
   project and put its URL and anon key in `.env`. Used only when Neon isn't configured.
3. **AI tutor** — the app calls its **own backend proxy** first
   (`POST /api/ai/chat`, `/api/ai/stt` on the `api` Function), where the provider
   key lives server-side (`AI_API_KEY`). For local development you can instead
   point `EXPO_PUBLIC_AI_*` at any OpenAI-compatible endpoint — but anything in
   `EXPO_PUBLIC_*` ships in the app, so never put a privileged key there in
   production.

With no AI key anywhere, the tutor degrades to **clearly-labeled demo lines** and
voice practice still works by typing. Accounts, progress sync and storage stay
live against Neon regardless — "demo mode" applies only to the AI — and the
Profile tab shows exactly what's connected.

## Project structure

```
src/
  app/                  # expo-router screens
    onboarding.tsx      # 3-step welcome (language · goal · native language)
    (auth)/             # login · signup · forgot-password   (protected: signed-out)
    (tabs)/             # home · explore · speak · words · you (protected: signed-in)
    language/[id].tsx   # language detail (hero · progress · chapters · phrasebook)
    lesson/[id].tsx     # lesson player (choose · type · listen · speak + native TTS)
    review.tsx          # daily Leitner review of missed words
  components/           # Button · TextField · Chip · Logo · Screen · Card-style primitives
                        # SectionHeader · ProgressBar · StatTile · WeeklyBars
                        # SegmentedControl · Pill · EmptyState · AuthHero · AlertProvider
  context/              # AuthContext (Neon Auth · Supabase · demo mode)
  lib/
    neon auth & api clients · supabase · shared AI core (app + Function)
    voice/STT upload · pronunciation scoring · cross-platform alerts · config validation
    catalog.ts          # course stats & per-language progress (bundled, offline)
    phrasebook.ts       # merged starter + curriculum phrases, search, word of the day
    achievements.ts     # 12 badges, pure & testable
    xp.ts               # published XP rules + lifetime/weekly/daily ledgers
  state/                # preferences (goals · my languages) · learning · profile · analytics
  data/
    languages.ts        # 24-language atlas: dialects, scripts, difficulty, greetings
    starters.ts         # curated 22-word starter packs for every language
    practice.ts         # per-scenario key phrases (+ starter fallback for all 24)
    curriculum/
      es/               # hand-authored CEFR Spanish course (5 chapters)
      samplers.ts       # deterministic starter-pack lesson builder
  theme/tokens.ts       # "warm atlas" design tokens (colors · type · shadows · layout)
functions/
  api/index.ts          # Neon Function: JWT-verified state sync · AI proxy · storage · review
neon/schema.sql         # Lakebase Postgres schema (app_state) — applied via the Neon CLI
neon.ts                 # Neon infrastructure-as-code (auth · functions · buckets)
supabase/schema.sql     # legacy tables + RLS — run once in the Supabase SQL editor
scripts/                # curriculum drafts · neon e2e · zero-dep tests · local API smoke
docs/RELEASE_2_0.md     # what shipped in 2.0 and how to verify it
docs/DEPLOYMENT.md      # how to deploy the backend, web and mobile builds
docs/AUTH_AUDIT.md      # auth & API security audit
docs/DEVICE_TEST_PLAN.md # on-device checklist (mic · TTS · permissions · live AI)
```

## Curriculum pipeline

Content ships **bundled** (works offline & in demo mode). When the legacy
Supabase backend is configured, **approved** chapters from that database
override the bundle. Languages without a hand-authored course use the
deterministic starter-pack builder (`src/data/curriculum/samplers.ts`), so every
flag in the atlas opens real lessons.

`node scripts/generate-curriculum.mjs es "En el restaurante"` drafts new
chapters with your AI key into `src/data/curriculum/drafts/` — review them,
insert with `status='draft'`, and flip to `approved` yourself. Publishing is
never automatic.

## Quality gates

```bash
npm test                 # ✅ 69 unit tests (atlas · free plan · XP · achievements · AI · uploads)
npm run smoke:local      # ✅ the real Function from source
npm run neon:e2e         # ✅ 50 checks against the live deployed backend
npx tsc --noEmit         # ✅ typecheck (app)
npm run check:functions  # ✅ typecheck (functions)
npx expo lint            # ✅ lint
npx expo-doctor          # ✅ project health
```
