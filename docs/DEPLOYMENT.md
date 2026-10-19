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
| `AI_API_KEY` | Enables live tutor + voice; **server-side only** | optional |
| `AI_API_URL` | OpenAI-compatible base URL (default `https://api.openai.com/v1`) | optional |
| `AI_MODEL`, `AI_STT_MODEL` | Chat / transcription models | optional |

### Enabling live AI + voice

```bash
# Merges into the existing env; the app then reports {chat:true, stt:true}
neon functions deploy api --src functions/api/index.ts --env AI_API_KEY=... --wait
```

Until `AI_API_KEY` is set, the backend is deliberately honest:

- `GET /api/ai/status` → `{ "chat": false, "stt": false }`
- `POST /api/ai/chat` and `POST /api/ai/stt` → `503 { "error": "ai-not-configured" }`

The app then shows clearly-labeled demo lines — it never fakes a live reply.

### Verify after deploy

```bash
curl -s "$API/"            # { "ok": true, "service": "babelish-api", ... }
curl -s "$API/api/ai/status" -H "Authorization: Bearer <jwt>"
npm run neon:e2e           # full end-to-end proof against the live backend
```

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

## Rename / rebrand checklist

The 1.1.0 rename (Nativa → Babelish) touched ~300 occurrences across ~60 files.
Most were cosmetic; these were not. Read this before renaming anything again.

### Already handled in code

| Concern | How |
|---|---|
| On-device data | `src/lib/storageMigration.ts` carries every `nativa:*` key to `babelish:*` on first launch, and `src/app/_layout.tsx` **gates the whole provider tree** on it so no provider can read a key before its value has moved. Without the gate a returning learner sees zero progress and is signed out. |
| Data never lost | A legacy key is deleted only *after* its copy is confirmed written; the flag is set only if nothing failed, so a partial failure retries next launch. |
| GDPR erase | `privacy.ts` keeps `LEGACY_LOCAL_DATA_KEYS` in the wipe set — a learner may erase before the migration ever runs. Erasing an absent key is a no-op. |
| Premium codes | `NATIVA-BETA` / `NATIVA-PREMIUM` are still accepted (published in PHASE5, already in testers' hands). New copy uses `BABELISH-*`. |
| Deep-link scheme | `app.json` `scheme` is now `babelish`. **Published `nativa://` links stop resolving** — any QR codes, emails or store listings using them need reissuing. |

### Requires action OUTSIDE this repo — the app breaks without it

1. **Register the new trusted domain on the Neon branch.** `NEON_TRUSTED_ORIGIN`
   is now `https://babelish.app`; Managed Auth validates the `Origin` header for
   CSRF, so until this runs, **sign-up, sign-in and password reset all fail**:

   ```bash
   neon neon-auth domain add https://babelish.app
   ```

   Keep `https://nativa.app` registered until every shipped binary has updated.
2. **Redeploy the `api` Function.** Its CORS allowlist
   (`TRUSTED_WEB_ORIGIN` in `functions/api/index.ts`) changed to
   `babelish\.app`. The deployed function still reflects the old origin until
   you redeploy — see "Backend" above.
3. **Pin `android.package` and `ios.bundleIdentifier` in `app.json`.** They are
   currently *undeclared*, so they derive from `slug` — which just changed from
   `nativa` to `babelish`. **Both stores would treat this as a brand-new app**:
   existing installs never receive the update, and ratings/reviews do not carry
   over. Declare them explicitly *before* the next store build, using whatever
   identifiers the app is already published under.
4. **Re-link EAS.** A new `slug` is a new EAS project identity: run
   `eas init` and expect existing OTA update channels not to carry over.
5. **Clear build caches, or the old name ships.** Metro caches the embedded
   manifest, so a rebuild after editing `app.json` can silently emit the *old*
   `name`/`slug`/`scheme` while everything else looks renamed. This happened
   during the 1.1.0 rename:

   ```bash
   rm -rf dist .expo node_modules/.cache && npm run build:web
   # verify before shipping:
   grep -o '\\"name\\":\\"[A-Za-z]*\\"' dist/_expo/static/js/web/entry-*.js
   ```

6. Update the Vercel project/domain and any `EXPO_PUBLIC_NEON_ORIGIN` set in a
   build environment (it overrides the compiled-in default).

## Rules

- Never put a privileged secret in `EXPO_PUBLIC_*` (it ships in the app). The
  only provider key in production lives in the Function env (`AI_API_KEY`).
- Never commit `.env.local` or paste secrets into docs, logs, or reports.
- Run the device checklist (`docs/DEVICE_TEST_PLAN.md`) before a store release.
