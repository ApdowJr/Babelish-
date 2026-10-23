# Babelish — Android-first roadmap

## Product goal

Build a reliable language-learning app for Android and Web with offline lessons, spaced repetition, speaking practice, an optional AI tutor, and privacy-protective learner progress sync.

## Current architecture

| Layer | Choice |
|---|---|
| Mobile & Web app | Expo, React Native, TypeScript, Expo Router (`https://babelish.vercel.app`) |
| Accounts | Supabase Auth |
| Database | Supabase PostgreSQL with Row Level Security (`user_progress`, `user_vocab`, `content_reports`, `ai_usage_daily`) |
| Learning content | Bundled 25-language curriculum first; approved Supabase curriculum (`chapters`, `lessons`, `exercises`) when available |
| Learner data | Per-user progress, vocabulary review, and content reports (isolated per account on shared devices) |
| AI tutor | Protected `babelish-ai` Supabase Edge Function + bundled coach fallback; provider keys stay server-side |
| Speech playback & input | Native device voices via Expo Speech; server STT or browser Web Speech API |
| Offline support | Bundled lessons, phrasebook, and local review state |

## Implementation phases

### Phase 1 — Supabase foundation
- [x] Create a separate Supabase project (`dvgluivslmdrqsvlscmj`).
- [x] Create chapters, lessons, exercises, user progress, and vocabulary tables.
- [x] Enable RLS and add policies for approved curriculum and owner-scoped learner data.
- [x] Add content reports with owner-scoped insert/read policies.
- [x] Remove Neon auth and API modules from the Android/Web app runtime.
- [x] Switch auth/session persistence to Supabase Auth (including PKCE/OTP/hash recovery callbacks and Vercel redirect allowlists).
- [x] Switch progress and vocabulary sync to Supabase PostgreSQL (including reset cleanup).
- [x] Set the project URL and publishable key across Vercel, `app.json`, and `eas.json` build profiles.
- [x] Run TypeScript, lint, unit tests, release checks, and static web export on the current branch.
- [ ] Test sign-up, email confirmation, password reset, session restore, and sign-out on a physical Android device.
- [x] Isolate local storage per account (`u:<userId>`) so user A cannot leak into user B on shared devices, with RLS enforcing server isolation.

### Phase 2 — Complete backend migration
- [x] Deploy the `babelish-ai` Supabase Edge Function for AI chat and speech-to-text; provider secrets remain server-side.
- [x] Configure AI chat secrets (`AI_API_URL`, `AI_API_KEY`, `AI_CHAT_MODEL`) on Supabase (optional `AI_STT_*` secrets remain configurable for server-side Whisper).
- [x] Deploy protected account deletion (`delete-account` Edge Function) with `ON DELETE CASCADE` across learner tables.
- [ ] Port curriculum review/admin workflows to Supabase and protect them with explicit admin authorization.
- [x] Keep legacy Neon data untouched; start clean on Supabase.
- [x] Support JSON data export on Web and Android plus full in-app account & local-state deletion.

### Phase 3 — Android & store release quality
- [ ] Test airplane mode, weak connectivity, session expiry, app restart, and fresh installation on a physical Android device.
- [x] Verify local progress merges and resets safely on reconnect.
- [ ] Test microphone permission denial, recording interruptions, transcription failures, and playback on physical Android hardware.
- [ ] Run `eas build --platform android --profile preview` / `production` and internal-device smoke test.
- [x] Align Play Store data-safety, privacy (`/privacy`), terms (`/terms`), permissions, and account deletion requirements (`docs/STORE_RELEASE.md`).
