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

## Platform session model — web vs native (fixed 2026-10-19)

The session is a signed **`HttpOnly`** cookie (`__Secure-neon-auth.session_token`),
and the two platforms reach it differently. Conflating them was a real bug:

- **Native** — React Native exposes `Set-Cookie` on the response, so the client
  captures the signed cookie and replays it as a `Cookie` header on
  `/get-session` and `/token`.
- **Web** — browsers **never** expose `Set-Cookie` to JavaScript (forbidden
  response-header name) and refuse a manually-set `Cookie` header. The browser's
  own jar owns the session, so every auth request must opt in with
  **`credentials: 'include'`**, and sign-in is confirmed with `GET /get-session`
  rather than by reading a cookie.

**The bug:** the client required a readable `Set-Cookie` on *every* platform and
never sent `credentials`, so on the deployed web app a **successful** sign-in
(HTTP 200 + user) threw the credential error, and no session was ever
established in the browser — sign-in could not work on web at all.
**The fix:** `src/lib/authSession.ts` holds the pure rules
(`sessionTransportFor`, `sessionCookieFromHeaders`, `classifyAuthResponse`,
`mapAuthErrorCode`); `src/lib/neonAuth.ts` applies them
(`credentials: 'include'` on web, `/get-session` confirmation, an honest
"browser blocked the session cookie" message instead of a false
"wrong password"). The branch sets `SameSite=None; Secure; Partitioned`, so a
mainstream browser stores the cross-site cookie; a browser that blocks
third-party cookies now gets a message that says so.

## Sign-out revocation (fixed 2026-10-19)

Managed Auth is **JSON-only**: a `POST` with no body arrives as `text/plain` and
is refused. `neonSignOut` used to send `/sign-out` with neither body nor content
type and **swallowed the response**, so the app reported a successful sign-out
while a valid 7-day session cookie stayed alive server-side. Verified live:

| `POST /sign-out` shape (with the session cookie) | Result |
| --- | --- |
| no body, no content type | `415`, session still valid |
| `Content-Type: application/json`, no body | `400`, session still valid |
| `Content-Type: application/json` + `{}` | `200`, `/get-session` no longer returns the user |

The fix is structural: `jsonBodyFor(method, body)` in `src/lib/authSession.ts`
(non-GET requests always carry JSON, at minimum `{}`; GETs never carry a body)
is routed through by every `neonAuth.ts` request, so no future body-less `POST`
can repeat the bug. `tests/authSession.test.ts` guards the invariant. The local
session is still cleared first, so signing out always succeeds from the user's
point of view.

## Password recovery (added 2026-10-19)

**Managed Auth has no hosted reset page** — `GET {auth}/reset-password/<token>`
answers `400` and the query form answers `404`. Recovery is therefore two steps,
and the second one lives in the app:

1. `POST /request-password-reset` (screen `(auth)/forgot-password`) — the branch
   uses shared SMTP (`email_provider: {"type":"shared"}`) and returns 200.
2. `POST /reset-password` with the one-time token — screen
   `(auth)/reset-password`, mounted at both link shapes (`?token=…` and
   `/reset-password/<token>`), via `src/components/ResetPasswordForm.tsx`.

Verified against the live branch: `POST /reset-password { newPassword, token }`
→ `200`, the old password then `401`, the new password `200`; failures surface as
`INVALID_TOKEN` / `PASSWORD_TOO_SHORT` (mapped in `authSession.ts`).

⚠️ **Not verified:** the exact URL inside the email and its delivery. No mailbox
is reachable from this environment, and Neon documents that **verification links
need custom SMTP** (codes work on shared SMTP). Enabling custom SMTP is the
production step for link-based recovery — see `docs/DEPLOYMENT.md`.

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
| `npm test` (unit, 5 files) | 37/37 passing |
| `npm run smoke:local` (real app from source: auth/CORS/limits/AI proxy/admin) | 37/37 passing, 3 phases |
| `npm run neon:e2e` (live deployed backend, real Managed Auth) | 50/50 passing |
| App `tsc --noEmit` / functions `tsc --noEmit` / `expo lint` / `expo-doctor` | all clean (RC 0), doctor 20/20 |
| Web export | RC 0; built bundle carries `credentials:'include'` (web folds `IS_WEB` to true) |
| Secret scan (tree incl. untracked) | clean |

## Known limitations / external steps not yet done

- **No password-reset email round-trip** was exercised here (needs a mailbox);
  `POST /request-password-reset` returns 200 and the branch uses shared SMTP
  (`email_provider: {"type":"shared"}`), but no email was received here. The
  server-side reset contract *is* verified (see "Password recovery"); the email
  link's shape and delivery are not. The `callbackURL` now uses the live web
  origin instead of the unreachable `nativa.app` site.
- **Provider-key rejection mapping** for live AI calls is covered with a local
  fake provider (401 → 502); a real provider key is not available in this
  environment, so no live provider call was made.
- **Deployment and push are done** (Function deployment 6 on branch `production`;
  commit pushed to `origin/main`). The web client fix in this section ships with
  the next Vercel build.
- **The sign-in failure was not reproduced in a browser here** (no browser
  runtime available in this environment): the platform session bug above is
  proven by code, by the auth server's own headers, and by the built bundle, but
  the end-to-end click-through is on the device/web checklist.
- **On-device** auth/mic/TTS flows are checklist-only — see
  `docs/DEVICE_TEST_PLAN.md`.
