# Nativa 🌍

**Speak like a native.** An AI language tutor that talks to you *only* in your target
language — with real dialects, real scenarios, and native pronunciation.

> 📱 2027 vision · Phase 1 build (see [ROADMAP.md](ROADMAP.md) for the full plan)

## What works today

| Feature | Status |
|---|---|
| **Professional auth** — sign up / sign in / forgot password | ✅ Real Supabase auth, sessions, friendly errors |
| **Demo mode** — full app without any keys | ✅ Clearly labeled, local accounts |
| **CEFR curriculum** — Spanish A1: 5 chapters × 4 lessons × ~8 exercises | ✅ Hand-authored, culture/grammar notes |
| **Lesson player** — choose · type · listen exercises with native TTS | ✅ Accent-lenient grading, XP + completion |
| **Chapter unlocking** — chapter N opens at 70%+ on N−1 | ✅ Per-lesson scores on the language page |
| **Spaced repetition** — missed words enter a Leitner review queue (1/2/4/8/15 days) | ✅ Daily review screen + Home card |
| **10-language sampler** — playable "First words" chapter in 9 more languages | ✅ |
| **AI Speak tab** — live conversation in 10 languages | ✅ Any OpenAI-compatible API |
| **Native TTS** — hear every reply in a locale voice (`es-ES`, `ar-EG`, `ja-JP`…) | ✅ expo-speech |
| **Scenarios** — café, souk bargaining, konbini, job interview… | ✅ Chips switch context live |
| **Translations** — toggle English under every AI message | ✅ |
| **Language library** — real dialects, native names, speaker counts | ✅ 10 languages |
| **Voice input** — speak your replies (record → Whisper STT → AI reply) | ✅ Any OpenAI-compatible endpoint |
| **Pronunciation scoring** — per-word green/amber/red chips + reference audio | ✅ Accent-blind, works typed in demo mode |
| **Learner profile** — name, job, interests, goals, native language | ✅ Feeds every AI prompt with their real life |
| **Adaptive difficulty** — per-skill analytics pick the weakest skill | ✅ Tutor level auto-rises A1 → B2 |
| **Daily plan** — "~10 min" card tuned to due reviews + weak spots | ✅ Includes a real streak counter |

Languages live: Spanish, Arabic, Mandarin, French, Hindi, Japanese, German,
Portuguese, Russian, Swahili.

## Run it

```bash
npm install
cp .env.example .env    # optional — app runs in demo mode without it
npx expo start          # scan the QR with Expo Go (SDK 58)
```

## Connect real services (recommended)

1. **Backend (Neon)** — the app is wired to a Neon branch: **Managed Better Auth**
   (real accounts + password reset), the **`api` Function** (JWT-verified progress
   sync + presigned Object Storage), **Lakebase Postgres** (`neon/schema.sql`) and
   the **`assets`** bucket. `neon deploy` provisions everything and pulls the branch
   endpoints into `.env.local`; `npm run neon:e2e` proves each service end to end.
   (Neon's AI Gateway needs a paid plan — until then use any OpenAI-compatible key below.)
2. **Accounts (Supabase, legacy)** — create a free [Supabase](https://supabase.com)
   project and put its URL and anon key in `.env`. Used only when Neon isn't configured.
3. **AI tutor** — put any OpenAI-compatible endpoint in `.env`
   (OpenAI, OpenRouter, Groq, or a local server). The tutor gets a native-speaker system
   prompt per language and can't break into English. The same endpoint powers **voice
   input** (`/audio/transcriptions`, `whisper-1` by default — override with
   `EXPO_PUBLIC_AI_STT_MODEL`); without a key, speaking practice still works by typing.

Without keys, the app stays fully usable in **demo mode** — scripted native lines,
on-device accounts — and the Profile tab shows exactly what's connected.

## Project structure

```
src/
  app/                  # expo-router screens
    (auth)/             # login · signup · forgot-password   (protected: signed-out)
    (tabs)/             # home · learn · speak · profile     (protected: signed-in)
    language/[id].tsx   # language detail (chapters · lessons · progress)
    lesson/[id].tsx     # lesson player (choose · type · listen + native TTS)
    review.tsx          # daily Leitner review of missed words
  components/           # Button · TextField · Chip · Logo · Screen
  context/              # AuthContext (Neon Auth · Supabase · demo mode)
  lib/                  # neon auth & api clients · supabase · ai tutor engine · voice recorder · pronunciation scoring · curriculum service & SRS
  state/                # preferences · learning (progress, vocab, XP · cloud sync)
  data/
    languages.ts        # language seed data (real dialects & scenarios)
    practice.ts         # per-scenario key phrases for pronunciation practice
    curriculum/         # bundled CEFR content (Spanish A1 full + 9 samplers)
  theme/                # design tokens (colors · spacing · typography)
functions/
  api/index.ts          # Neon Function: JWT-verified state sync + presigned storage
neon/schema.sql         # Lakebase Postgres schema (app_state) — applied via the Neon CLI
neon.ts                 # Neon infrastructure-as-code (auth · functions · buckets)
hello.ts                # canary function (health check)
supabase/schema.sql     # legacy tables + RLS — run once in the Supabase SQL editor
scripts/generate-curriculum.mjs   # AI draft generator (drafts only, never publishes)
scripts/neon-e2e.mjs    # end-to-end proof of every Neon service (npm run neon:e2e)
```

## Curriculum pipeline

Content ships **bundled** (works offline & in demo mode). When Supabase is
configured, **approved** chapters from the database override the bundle.
`node scripts/generate-curriculum.mjs es "En el restaurante"` drafts new
chapters with your AI key into `src/data/curriculum/drafts/` — review them,
insert with `status='draft'`, and flip to `approved` yourself. Publishing is
never automatic.

## Quality gates

```bash
npx tsc --noEmit   # ✅ typecheck
npx expo lint      # ✅ lint
npx expo-doctor    # ✅ project health
```
