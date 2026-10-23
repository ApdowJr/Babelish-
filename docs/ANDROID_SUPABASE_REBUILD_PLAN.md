# Babelish Android + Supabase Rebuild Plan

Status: implementation in progress on this isolated branch. Supabase development project `dvgluivslmdrqsvlscmj` is active. Production `main`, existing Neon backend, existing accounts, and deployments have not been changed.

## Goal

Prepare an Android-first Babelish implementation using Supabase PostgreSQL and Supabase Auth as the primary backend. Preserve the existing language-learning product: offline lessons, language catalog, review/phrasebook, progress, speaking practice, AI tutor, profile/preferences, and account/data controls.

## Repository findings (checked against `main`)

- Expo / React Native app with Expo Router; package currently uses Expo SDK 58, React Native 0.88, React 19, TypeScript.
- Supabase client already exists in `src/lib/supabase.ts`, using `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and AsyncStorage session persistence.
- Supabase schema already exists in `supabase/schema.sql` for approved curriculum content, per-user lesson progress, and vocabulary review, with RLS.
- Current authentication checks Neon first, then Supabase, then local demo mode (`src/context/AuthContext.tsx`). Neon URLs are hard-coded production defaults in `src/lib/neon.ts`, so simply adding Supabase credentials will NOT switch the app to Supabase.
- AI tutor uses a server-side proxy; provider secrets are expected to stay server-side. Existing Neon Functions and Neon-specific routes need an inventory and a migration plan before any removal.
- Existing bundled curriculum provides an offline-first baseline. Keep it available when offline or when backend content is unavailable.

## Target architecture

1. **Android client:** Expo + React Native + Expo Router. Keep the app native-first; do not spend this phase on web or iOS release workflows.
2. **Identity:** Supabase Auth email/password, confirmation, reset and sign-out. Persist native sessions with AsyncStorage. Remove provider ambiguity only after Supabase is configured and tested in a non-production environment.
3. **Database:** Supabase PostgreSQL. Apply versioned SQL migrations; use foreign keys, constraints, indexes, and RLS.
4. **Learning content:** bundled lessons remain available offline; optional server curriculum is read-only to learners and only approved content is visible.
5. **Learner data:** progress, saved vocabulary, review schedule, profile and preferences are scoped to the signed-in user through RLS.
6. **AI tutor:** Android app calls a trusted server endpoint; OpenRouter/LLM credentials remain in server environment variables. Do not put service-role keys or AI API keys in `EXPO_PUBLIC_*` variables or the mobile binary.
7. **Voice:** preserve current record/transcribe/tutor/TTS flow and test permissions, interruption, no-speech, offline, and network failures on a real Android device.
8. **Files:** add Supabase Storage only if a real feature requires user-uploaded audio or avatars; define private buckets and ownership policies before enabling uploads.

## Proposed schema work

Review the existing schema before changing it. Candidate tables include:
- `profiles` keyed to `auth.users(id)` for display name and learner preferences.
- Existing `chapters`, `lessons`, `exercises` for curriculum.
- Existing `user_progress` and `user_vocab` for learning progress and spaced repetition.
- A minimal `tutor_sessions` / `tutor_messages` design only if conversation history must persist; define retention and user deletion behavior first.
- Subscription/billing tables only when a real billing provider and entitlement rules are chosen.

All user-owned tables must have RLS enabled and policies that check `auth.uid() = user_id` (or the equivalent owner key). Public/anonymous reads should be denied by default unless a specific content policy requires otherwise. Never rely on UI-only access control.

## Phased execution

### Phase 0 — Isolated preparation (this branch)
- Record repository findings and target architecture.
- Do not change production credentials, production schema/data, `main`, or deployments.
- Confirm the Supabase development project and its ownership before applying SQL.

### Phase 1 — Backend and schema
- Create/use a separate Supabase development project.
- Review existing `supabase/schema.sql`; convert it into ordered, repeatable migrations.
- Add profile/preferences schema only after checking current local storage/data types.
- Test RLS with two different test users and an unauthenticated client.
- Seed only synthetic development content; do not copy production/user data by default.

### Phase 2 — Auth cutover in development
- Add an explicit backend selection/configuration strategy so development Supabase mode cannot silently fall through to hard-coded Neon defaults.
- Test sign-up, email confirmation, sign-in, session restoration, password reset, sign-out, and account deletion.
- Keep Neon code intact until parity tests pass; remove legacy code in a separate reviewed change.

### Phase 3 — Learning data
- Add typed repositories for profile, progress, vocabulary, and approved curriculum.
- Define conflict handling and offline queue behavior before syncing local progress.
- Verify cross-user isolation and delete/export behavior.

### Phase 4 — AI and voice
- Point the mobile client to a secure backend proxy independent of Neon-specific assumptions.
- Keep all model credentials on the server.
- Test the complete Android flow: microphone permission → speech capture → transcript → tutor response → speech playback.
- Preserve honest fallback/error states.

### Phase 5 — Android quality and release
- Run type checks, lint, unit tests, Expo Doctor, Android export/build, and device smoke tests.
- Test airplane mode, weak connectivity, session expiry, app restart, permission denial, and a fresh install.
- Review Play Store permissions, privacy disclosures, account deletion and data safety.
- Only after explicit approval, prepare a separate production cutover plan with backups and rollback steps.

## Acceptance criteria

- A test account can register, verify email, sign in, restart the app, reset password and sign out.
- User A cannot read or mutate User B's profile, progress, vocabulary or tutor history through the API.
- Lessons and review remain usable offline using bundled content.
- Progress syncs safely when connectivity returns and does not overwrite newer server state silently.
- AI keys and Supabase service-role credentials never ship in the Android client.
- Speaking practice works end-to-end on a real Android device, with useful errors for denied permission and unavailable services.
- Tests and Android build pass before any production cutover.
- Existing `main`, production database, existing accounts and current deployment remain unchanged until explicitly approved.

## Remaining work before release

1. Complete removal of legacy Neon-only backend files, deployment scripts, and package dependencies after verifying no app imports remain.
2. Implement a secure Supabase Edge Function for AI tutor proxy and account deletion.
3. Decide whether existing Neon users should be migrated later or whether Supabase starts with new accounts.
4. Confirm supported Android devices / minimum Android version.

## Safety boundary

The Supabase development project has been inspected and two migrations were applied: learning tables/RLS plus content reports and RLS hardening. Android auth and learning sync have been switched on this branch. No Neon accounts/data were migrated, and production `main`, production environment variables, and deployments remain untouched.
