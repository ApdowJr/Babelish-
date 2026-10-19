# Nativa — Auth & API Security Audit (Master Audit, Phase F)

_Last updated: 2026-10-19. Determined **from the code**, not assumed._

## Verdict

The active authentication provider is **Neon Managed Better Auth** (email +
password) with a **Neon Functions** backend and **Lakebase Postgres** for
data. Supabase remains an optional legacy fallback mode; it is not active in
any normal build. Demo mode is used only when *neither* backend is configured,
and it is clearly labeled in the UI.

## How the provider was determined

- `src/context/AuthContext.tsx` branches in a fixed order: **Neon → Supabase →
  demo**. `isNeonConfigured` is checked first for session restore, sign-up,
  sign-in, password reset and sign-out.
- `src/lib/neon.ts` ships the production endpoints as **build defaults**
  (public URLs, not secrets), so `isNeonConfigured` is true in every normal
  build; `EXPO_PUBLIC_NEON_DISABLED=1` is the deliberate escape hatch to force
  demo mode.
- `isDemo` is `!isSupabaseConfigured && !isNeonConfigured` — so demo can only
  happen when nothing real is configured.
- Runtime corroboration: `npm run neon:e2e` exercises real sign-up → session
  cookie → `GET /token` → JWT → authorized API calls against the deployed
  backend (50/50 checks), and the deployed admin dashboard performs Neon-Auth
  admin account deletion.

## Request-authorization model

- **Every `/api/*` route** runs a middleware that requires
  `Authorization: Bearer <jwt>`, verifies it with `jose` against the branch's
  remote JWKS (`NEON_AUTH_JWKS_URL`) and an **issuer** check
  (`NEON_AUTH_BASE_URL` origin). The user id used by all handlers is the JWT
  **`sub` claim only** — never a client-supplied value, so a caller can only
  touch their own rows.
- **Cross-user isolation**: state, storage, and deletion are all keyed by the
  JWT `sub`. `GET /api/storage/url` rejects any key that does not start with
  `users/<caller-sub>/` (covered by e2e).
- **Admin dashboard (`/admin`)**: HTTP Basic, constant-time comparison
  (`safeEqual`), credentials only from Function env (`ADMIN_USERNAME` /
  `ADMIN_PASSWORD`). A failed-attempt limiter blocks an IP after 10 failures
  per 10 minutes; with no client IP the gate fails **open** (documented) so
  operators are never locked out by a shared bucket.
- **`DELETE /api/me`**: idempotent GDPR/Play erasure. Deletes every row keyed
  to the JWT `sub`, then removes the auth user itself and reports the outcome
  honestly (`removed` / `already-gone` / `not-configured` / `failed`).

## Secret handling

- A secret scan of the full working tree (tracked changes + untracked files)
  for `ghp_`, `gho_`, `sk-…` (20+ chars), `napi_`, `AKIA…`, `xoxb-`, and long
  `Bearer` tokens returns **no real credentials**.
- `EXPO_PUBLIC_*` holds only public identifiers/URLs — never a privileged
  secret. The AI provider key exists **only** as a server-side Function env var
  (`AI_API_KEY`); the app talks to the proxy first and only falls back to a
  development endpoint when explicitly configured.
- **CORS** reflects only Nativa's own origins (custom domain, `*.vercel.app`,
  localhost / private-network dev) and allows `DELETE`; unknown origins get no
  `Access-Control-Allow-Origin` header (verified in the local smoke).

## Startup validation

`src/lib/config.ts` validates configuration at launch and surfaces
plain-language, actionable warnings instead of a silent demo banner.

## Evidence (2026-10-19)

| Gate | Result |
|---|---|
| `npm test` (unit) | 26/26 passing |
| `npm run smoke:local` (real app from source: auth/CORS/limits/AI proxy/admin) | 37/37 passing, 3 phases |
| `npm run neon:e2e` (live deployed backend, real Managed Auth) | 50/50 passing |
| App `tsc --noEmit` / functions `tsc --noEmit` / `expo lint` / `expo-doctor` | all clean (RC 0), doctor 20/20 |
| Secret scan (tree incl. untracked) | clean |

## Known limitations / external steps not yet done

- **No password-reset email round-trip** was exercised here (needs a mailbox);
  the code path exists but is untested end-to-end.
- **Provider-key rejection mapping** for live AI calls is covered with a local
  fake provider (401 → 502); a real provider key is not available in this
  environment, so no live provider call was made.
- **Deployment** of the hardened Function and **push** of these commits are
  blocked on user-supplied credentials (see the audit report / `docs/DEPLOYMENT.md`).
- **On-device** auth/mic/TTS flows are checklist-only — see
  `docs/DEVICE_TEST_PLAN.md`.
