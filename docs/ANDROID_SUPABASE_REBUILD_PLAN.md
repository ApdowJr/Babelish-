# Babelish Android + Supabase migration — current status

Updated: 2026-10-23

## Active architecture

- Android app: Expo, React Native, TypeScript.
- Accounts: Supabase Auth.
- Database: Supabase PostgreSQL with Row Level Security.
- Default project URL: `https://dvgluivslmdrqsvlscmj.supabase.co`.
- Mobile client key: `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (publishable key only).
- AI tutor and voice: Supabase Edge Function `babelish-ai`; provider keys are server-side only.
- Account deletion: Supabase Edge Function `delete-account`.
- Offline curriculum and offline coach remain available without hosted AI.

## Implemented

- Supabase Auth session persistence and login.
- User-scoped progress, vocabulary, and content report tables with RLS.
- AI usage table/RPC with client access explicitly denied.
- Deployed Edge Functions `babelish-ai` and `delete-account`, with JWT verification enabled.
- Default app gateway routes to the Supabase Edge Function.
- Settings account deletion calls the protected function and then clears local learning data.
- Privacy copy and CI include Supabase-specific guidance, Deno type checking, and Android export.

## Required operator configuration

In Supabase Dashboard → Edge Functions → Secrets, add the provider's server-side configuration:

- `AI_API_URL`
- `AI_API_KEY` (create/rotate the key; never paste it into chat or commit it)
- `AI_CHAT_MODEL`
- For cloud voice: `AI_STT_API_URL`, `AI_STT_API_KEY`, and `AI_STT_MODEL`

Until these secrets are configured, the app intentionally reports hosted AI as unavailable and uses its bundled offline coach. Do not put these secrets in `EXPO_PUBLIC_*`.

## Remaining verification

1. Run and pass CI for PR #26, including unit tests, app TypeScript, Deno Edge Function type checks, lint, web export, and Android export.
2. Test signup, email confirmation, password reset, session restore, sign-out, and account deletion with a disposable test account.
3. Test progress/vocabulary/report isolation using two separate test users.
4. Configure provider secrets and test a real AI reply plus voice transcription before claiming hosted AI is live.
5. Port the local content-review dashboard to a protected Supabase-backed admin workflow before enabling online curriculum review.
6. Complete Android physical-device tests for microphone permission, recording, TTS, offline mode, reconnect, and account deletion.

## Data and production safety

No existing accounts or records from the previous backend were migrated or deleted. Keep the old backend and its data untouched until an explicit export/migration/rollback plan is approved. This app migration does not require deleting the old service.
