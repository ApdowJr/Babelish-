# Nativa 🌍

**Speak like a native.** An AI language tutor that talks to you *only* in your target
language — with real dialects, real scenarios, and native pronunciation.

> 📱 2027 vision · Phase 0 build (see [ROADMAP.md](../ROADMAP.md) for the full plan)

## What works today

| Feature | Status |
|---|---|
| **Professional auth** — sign up / sign in / forgot password | ✅ Real Supabase auth, sessions, friendly errors |
| **Demo mode** — full app without any keys | ✅ Clearly labeled, local accounts |
| **AI Speak tab** — live conversation in 10 languages | ✅ Any OpenAI-compatible API |
| **Native TTS** — hear every reply in a locale voice (`es-ES`, `ar-EG`, `ja-JP`…) | ✅ expo-speech |
| **Scenarios** — café, souk bargaining, konbini, job interview… | ✅ Chips switch context live |
| **Translations** — toggle English under every AI message | ✅ |
| **Language library** — real dialects, native names, speaker counts | ✅ 10 languages |
| **CEFR chapters, voice input, pronunciation scoring** | 🗓 Phases 1–2 |

Languages live: Spanish, Arabic, Mandarin, French, Hindi, Japanese, German,
Portuguese, Russian, Swahili.

## Run it

```bash
npm install
cp .env.example .env    # optional — app runs in demo mode without it
npx expo start          # scan the QR with Expo Go (SDK 58)
```

## Connect real services (recommended)

1. **Accounts** — create a free [Supabase](https://supabase.com) project, then put its
   URL and anon key in `.env`. Email/password auth works immediately.
2. **AI tutor** — put any OpenAI-compatible endpoint in `.env`
   (OpenAI, OpenRouter, Groq, or a local server). The tutor gets a native-speaker system
   prompt per language and can't break into English.

Without keys, the app stays fully usable in **demo mode** — scripted native lines,
on-device accounts — and the Profile tab shows exactly what's connected.

## Project structure

```
src/
  app/                  # expo-router screens
    (auth)/             # login · signup · forgot-password   (protected: signed-out)
    (tabs)/             # home · learn · speak · profile     (protected: signed-in)
    language/[id].tsx   # language detail
  components/           # Button · TextField · Chip · Logo · Screen
  context/              # AuthContext (Supabase + demo mode)
  lib/                  # supabase client · ai tutor engine (chat + native TTS)
  state/                # preferences (target/native language, persisted)
  data/                 # language seed data (real dialects & scenarios)
  theme/                # design tokens (colors · spacing · typography)
```

## Quality gates

```bash
npx tsc --noEmit   # ✅ typecheck
npx expo lint      # ✅ lint
npx expo-doctor    # ✅ project health
```
