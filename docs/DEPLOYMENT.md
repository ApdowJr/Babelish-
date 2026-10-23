# Babelish — Deployment

_Last updated: 2026-10-19._ Names and commands only — **never** put secret
values in this file, in `EXPO_PUBLIC_*`, or in git. Real values live in the
Function environment (set by the Neon CLI) and in `.env.local` (git-ignored).

## What deploys where

| Surface | What | How |
|---|---|---|
| **Backend** | the `api` Function (Hono): auth-verified state, storage, review dashboard, **AI proxy** | Neon CLI (`neon functions deploy`) |
| **Web app** | the Expo web SPA | Vercel, from `expo export --platform web` → `dist/` (`vercel.json` catch-all) |
| **Landing page** | the marketing page in `site/` (static HTML/CSS/JS) | Vercel with **Root Directory = `site`**, or any static host |
| **Mobile** | iOS / Android binaries + OTA | EAS (`eas build`) for the store; GitHub Actions for the side-loadable APK |

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
| `AI_MODELS` | Comma-separated chat fallback chain (defaults to OpenRouter free Qwen3 when the URL is OpenRouter) | optional |
| `AI_MODEL`, `AI_STT_MODEL` | Single chat model (legacy) / transcription model | optional |
| `AI_STT_ENABLED` | Explicitly enables transcription when using a custom `AI_API_URL` that supports `/audio/transcriptions` | optional |

### Enabling the tutor (one configuration for every learner)

The app has **no model screen**: learners open Speak and the tutor answers. The
only configuration is server-side, in the Function environment. OpenRouter's
free Qwen3 endpoints cover all 24 Babelish languages:

```bash
# key stays on the server; rotate it if it was ever pasted into a chat
read -rsp "OpenRouter API key: " AI_API_KEY; echo
AI_API_KEY="$AI_API_KEY" npm run deploy:tutor
unset AI_API_KEY
```

`AI_MODELS` is a **fallback chain**: free endpoints rotate, so the server tries
each id in order and only moves on when a model has disappeared; a bad key, a
rate limit or a timeout is reported as itself, never masked.

Voice input, free and on-device: leave `AI_STT_ENABLED=false` and web users get
Whisper in the browser (one tap, ~150 MB, downloaded once). Setting
`AI_STT_ENABLED=true` with `AI_STT_MODEL=openai/whisper-large-v3-turbo` routes
audio through the server instead — accurate and fast, but **metered per second
of audio** by the provider. That is a real cost, not free.

Self-hosted alternative (no account, no bill, your own electricity):

```bash
neon functions deploy api --src functions/api/index.ts \
  --env AI_API_URL=http://127.0.0.1:11434/v1 \
  --env AI_MODEL=qwen2.5:1.5b --env AI_STT_ENABLED=false --wait
```

Signed-out learners can use the tutor too (guest budget: 6 chats and 2
transcriptions per minute per IP); anyone can sign in for the normal budget of
20 chats and 10 transcriptions per minute. Nothing about the tutor requires a
session in demo mode.

Until `AI_API_KEY` (or `AI_API_URL`) is set, the backend is deliberately honest:

- `GET /api/ai/status` → `{ "chat": false, "stt": false }`
- `POST /api/ai/chat` → `503 { "error": "ai-not-configured" }`
- `POST /api/ai/stt` → `503 { "error": "ai-not-configured" }`; chat-only providers return `503 { "error": "ai-stt-not-configured" }`

The app then shows the labelled coach — it never fakes a live reply, and it
never tells the learner to configure anything they cannot reach.

### Verify after deploy

```bash
curl -s "$API/"            # { "ok": true, "service": "babelish-api", ... }
curl -s "$API/api/ai/status" -H "Authorization: Bearer <jwt>"
npm run neon:e2e           # full end-to-end proof against the live backend
```

## API CORS policy

The Function currently retains the existing `zelvoca.app` origin and allows the intended `babelish.app` origin, alongside explicit known Babelish Vercel aliases. Do not remove the legacy origin until the replacement domain is verified and configured in Neon Auth. Babelish deployment URLs are limited to the `babelish-<deployment-hash>-ururka-lp.vercel.app` form, with the known Git aliases retained (the main Git alias and the current PR branch alias). It does not trust arbitrary Vercel hosts merely because they start with `babelish-`. Local development hosts are handled separately. The smoke suite includes negative tests for unrelated and branded-looking but unregistered hosts; update the allowlist and tests together when aliases change.

## Web (Vercel)

`vercel.json` rewrites every route to the SPA shell; `dist/` holds the export
plus the per-route chunks (e.g. the `/privacy` screen). Build with
`npm run build:web`. `.npmrc` sets `legacy-peer-deps=true` for the Expo/React
peer range.

## Landing page (`site/`)

`site/` is plain HTML, CSS and JavaScript — no build step, no framework, no
third-party requests. It is deliberately **independent of the Expo web app**:
the app stays at the domain root (`vercel.json` rewrites to the SPA shell),
while the landing page is deployed as its own project.

### Deploy to Vercel

1. New Project → import `ApdowJr/Babelish-`.
2. **Root Directory:** `site`. **Framework preset:** Other. **Build command:** empty.
3. Add the domain (e.g. `babelish.app`). `site/vercel.json` supplies the CSP and
   cache headers; that file is only read when the root directory is `site`.

### Preview locally

```bash
python3 -m http.server 8080 --directory site   # http://localhost:8080
```

### The download button

It points at
`https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk`.
That URL resolves to the asset `babelish.apk` on the latest release, which
`.github/workflows/android-apk.yml` attaches when a `v*` tag is pushed:

```bash
git tag v3.4.0 && git push origin v3.4.0
```

The page asks the GitHub API whether that asset exists — if it does not, the
buttons fall back to the releases page and a note says so instead of handing a
visitor a dead link. **The APK from this workflow is signed with the debug
keystore**: it is installable by side-loading, and it is *not* the artifact you
upload to Play (that is `eas.json` → `app-bundle`, signed with the real key).

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
