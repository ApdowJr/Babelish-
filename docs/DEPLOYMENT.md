# Babelish — Deployment

_Last updated: 2026-10-19._ Names and commands only — **never** put secret
values in this file, in `EXPO_PUBLIC_*`, or in git. Real values live in the
Function environment (set by the Neon CLI) and in `.env.local` (git-ignored).

## What deploys where

| Surface | What | How |
|---|---|---|
| **Backend** | the `api` Function (Hono): auth-verified state, storage, review dashboard, **AI proxy** | Neon CLI (`neon functions deploy`) |
| **Web** | the Expo web SPA preview | Vercel, from `expo export --platform web` → `dist/` (`vercel.json` catch-all) |
| **Mobile** | iOS / Android binaries + OTA | EAS (`eas build`, `eas update`) |

## Backend: the `api` Function

Prerequisite: an authenticated Neon CLI with a valid API key (`neon auth` /
`NEON_API_KEY`). Without one the CLI cannot reach the API at all.

```bash
# Deploy the current source. The CLI treats --env as a *targeted* update:
# existing Function env vars are preserved, so you only pass what changes.
neon functions deploy api --src functions/api/index.ts --wait
```

Before deploying, the repo gates must be green:

```bash
npm test && npm run smoke:local && npx tsc --noEmit && npm run check:functions && npx expo lint
```

### Function environment variables

Set once, preserved across deploys (only pass `--env KEY=VALUE` to change one):

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | Postgres (injected by Neon) | yes |
| `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL` | Verify Managed-Auth JWTs (injected) | yes |
| `NEON_BRANCH` | Reported by the health check | yes |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | Object Storage presigning (injected) | yes |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | `/admin` review dashboard Basic auth | yes |
| `NEON_AUTH_ADMIN_EMAIL`, `NEON_AUTH_ADMIN_PASSWORD` | Ops admin for auth-user deletion | for account deletion |
| `AI_API_KEY` | Enables live tutor chat; transcription additionally requires a compatible provider | optional |
| `AI_API_URL` | OpenAI-compatible base URL (default `https://api.openai.com/v1`) | optional |
| `AI_MODEL`, `AI_STT_MODEL` | Chat / transcription models | optional |
| `AI_STT_ENABLED` | Explicitly enables transcription when using a custom `AI_API_URL` that supports `/audio/transcriptions` | optional |

### Enabling live AI

For OpenRouter's free-model router, use chat-only configuration. Replace the placeholder with a **new, rotated** OpenRouter key locally; never commit it or put it in `EXPO_PUBLIC_*`:

```bash
read -rsp "New OpenRouter API key: " OPENROUTER_API_KEY; echo
neon functions deploy api --src functions/api/index.ts \
  --env "AI_API_KEY=$OPENROUTER_API_KEY" \
  --env AI_API_URL=https://openrouter.ai/api/v1 \
  --env AI_MODEL=openrouter/free --wait
unset OPENROUTER_API_KEY
```

With a custom `AI_API_URL`, speech-to-text is reported as unavailable unless `AI_STT_ENABLED=true` is explicitly set. OpenRouter free chat configuration alone does not enable transcription. The default OpenAI endpoint keeps the existing `whisper-1` transcription path.

Until `AI_API_KEY` is set, the backend is deliberately honest:

- `GET /api/ai/status` → `{ "chat": false, "stt": false }`
- `POST /api/ai/chat` → `503 { "error": "ai-not-configured" }`
- `POST /api/ai/stt` → `503 { "error": "ai-not-configured" }`; custom chat-only providers return `503 { "error": "ai-stt-not-configured" }`

The app then shows clearly-labeled demo lines — it never fakes a live reply.

### Verify after deploy

```bash
curl -s "$API/"            # { "ok": true, "service": "babelish-api", ... }
curl -s "$API/api/ai/status" -H "Authorization: Bearer <jwt>"
npm run neon:e2e           # full end-to-end proof against the live backend
```

## API CORS policy

The Function allows the branded `babelish.app` / `babelish.app` origins and an explicit set of known Vercel aliases. Babelish deployment URLs are limited to the `babelish-<deployment-hash>-ururka-lp.vercel.app` form, with the known Git alias retained. It does not trust arbitrary Vercel hosts merely because they start with `babelish-` or `babelish-`. Local development hosts are handled separately. The smoke suite includes negative tests for unrelated and branded-looking but unregistered hosts; update the allowlist and tests together when aliases change.

## Web (Vercel)

`vercel.json` rewrites every route to the SPA shell; `dist/` holds the export
plus the per-route chunks (e.g. the `/privacy` screen). Build with
`npm run build:web`. `.npmrc` sets `legacy-peer-deps=true` for the Expo/React
peer range.

## Mobile (EAS)

```bash
bunx eas-cli build --profile preview   # or: npx eas-cli@latest build --profile preview
bunx eas-cli update                    # ship an OTA update
bunx eas-cli submit                    # App Store / Play submission
```

`ios/` and `android/` are generated (CNG) — configure native behaviour in
`app.json` and config plugins, never by editing those directories.

## Rules

- Never put a privileged secret in `EXPO_PUBLIC_*` (it ships in the app). The
  only provider key in production lives in the Function env (`AI_API_KEY`).
- Never commit `.env.local` or paste secrets into docs, logs, or reports.
- Run the device checklist (`docs/DEVICE_TEST_PLAN.md`) before a store release.
