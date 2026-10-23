# Babelish — Android-first roadmap

## Product goal

Build a reliable language-learning app for Android with offline lessons, spaced repetition, speaking practice, an optional AI tutor, and privacy-protective learner progress sync.

## Current architecture

| Layer | Choice |
|---|---|
| Mobile app | Expo, React Native, TypeScript, Expo Router |
| Accounts | Supabase Auth |
| Database | Supabase PostgreSQL with Row Level Security |
| Learning content | Bundled curriculum first; approved Supabase curriculum when available |
| Learner data | Per-user progress, vocabulary review, and content reports |
| AI tutor | Optional owner-operated OpenAI-compatible gateway; provider keys stay server-side |
| Speech playback | Native device voices via Expo Speech |
| Offline support | Bundled lessons, phrasebook, and local review state |

## Implementation phases

### Phase 1 — Supabase foundation
- [x] Create a separate Supabase development project.
- [x] Create chapters, lessons, exercises, user progress, and vocabulary tables.
- [x] Enable RLS and add policies for approved curriculum and owner-scoped learner data.
- [x] Add content reports with owner-scoped insert/read policies.
- [x] Remove Neon auth and API modules from the Android app runtime.
- [x] Switch auth/session persistence to Supabase Auth.
- [x] Switch progress and vocabulary sync to Supabase PostgreSQL.
- [x] Set the project URL in app configuration and use a publishable key from environment variables.
- [ ] Run TypeScript, lint, unit tests, and Android export on the current branch.
- [ ] Test sign-up, email confirmation, password reset, session restore, and sign-out on an Android device.
- [ ] Verify user A cannot read or alter user B's progress, vocabulary, or reports.

### Phase 2 — Complete backend migration
- [x] Deploy the Supabase Edge Function for AI chat and speech-to-text; provider secrets remain server-side.
- [ ] Configure AI provider secrets and verify a real tutor/STT request.
- [x] Deploy protected account deletion through a server-side Supabase function.
- [ ] Port curriculum review/admin workflows to Supabase and protect them with explicit admin authorization.
- [ ] Decide whether existing accounts are migrated; do not copy old production records by default.
- [ ] Add database export/retention rules and test account deletion end-to-end.

### Phase 3 — Android quality
- [ ] Test airplane mode, weak connectivity, session expiry, app restart, and fresh installation.
- [ ] Verify local progress merges safely after reconnecting.
- [ ] Test microphone permission denial, recording interruptions, transcription failures, and playback.
- [ ] Run the Android build and internal-device smoke test.
- [ ] Review Play Store data-safety, privacy, permissions, and account deletion requirements.

## Safety boundary

Current follow-up changes are isolated to `fix/supabase-android-completion`; the previous Supabase migration PR was merged by the project owner. The two Supabase Edge Functions are deployed to the Babelish Supabase project. No Neon data was migrated. Do not change or delete the legacy Neon project as part of this app migration.
