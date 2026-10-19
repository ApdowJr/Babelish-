# Babelish — App Store & Google Play compliance

Prepared for the launch builds (Phase 6). Every line here is either already
configured in the repo or a named checklist item for the EAS submission.

## Permissions & their justifications

| Permission | Why | Where configured |
|---|---|---|
| Microphone (`RECORD_AUDIO`, `NSMicrophoneUsageDescription`) | Speaking practice: your voice is scored on-device and (when a cloud STT is configured) transcribed | `app.json` → `expo-audio` plugin `microphonePermission` |
| Notifications (local only) | One daily practice reminder you chose | `expo-notifications`, scheduled on-device |
| **No** camera, contacts, location, advertising ID | — | never requested |

Store copy for the permission strings is user-facing and plain-language —
no "may be used for…" legalese.

## Age rating & kids' privacy (COPPA / Play Families)

- Babelish is a **general-audience** education app. Target rating: **12+** (iOS),
  **Everyone** with mild user interaction (Play).
- It is **not directed at children under 13** and doesn't collect data from
  them knowingly. There are no ads, no third-party analytics, no behavioral
  profiling, and no in-app links out to the web inside the child-facing flow.
- The **family plan** (up to 6 seats, Phase 5) is designed for a household:
  seats are provisioned by the purchasing adult, not by children signing up
  with personal data.
- If a child's use comes to light under COPPA, deletion is one tap:
  Profile → PRIVACY → **Delete account** (local wipe + server erasure via
  `DELETE /api/me`).

## Speech / audio data

- Microphone audio is used for two things only:
  1. **On-device pronunciation scoring** (Phase 2): the audio features never
     leave the device.
  2. **Cloud transcription** (optional, only when the operator has configured a
     provider): the audio is sent — through Babelish's own backend Function
     (`POST /api/ai/stt`) — to the provider for transcription and **discarded**.
     Babelish never stores audio, and stores only the resulting text as a practice
     phrase. The provider API key lives only in the Function's server-side
     environment, never in the app binary (`EXPO_PUBLIC_*` is not used for
     privileged secrets).
- If no STT provider is configured the backend answers `503 ai-not-configured`
  and the app says so (Profile → APP STATUS, and the Speak tab degrades
  honestly) — it never sends audio anywhere or fakes a transcript.

## Data-safety form answers (Play) / Privacy Nutrition Labels (App Store)

| Data type | Collected | Linked to identity | Used for tracking |
|---|---|---|---|
| Email / account id | Yes (account only) | Yes | No |
| Other user content (practice text, XP, streaks) | On-device only | — | No |
| Audio | Transient (STT request), never stored | No | No |
| Diagnostics / ads / location / contacts | **No** | — | — |

## Deletion & portability (both stores require it)

- **Delete**: Profile → PRIVACY → Delete account. Wipes `LOCAL_DATA_KEYS`
  on-device and calls `DELETE /api/me`, which deletes every row keyed to the
  account (`app_state`, `weekly_xp`, `learner_reports`) **and then erases the
  auth user itself** via the Neon Auth admin API (`POST /admin/remove-user`),
  so the account can no longer sign in. The response reports the outcome
  honestly (`removed` / `already-gone` / `not-configured` / `failed`) and the
  app surfaces a warning if server-side account removal failed.
- **Export**: Profile → PRIVACY → Export my data → native share sheet with a
  JSON document (`src/lib/privacy.ts` `buildDataExport`), including explicit
  `includesAudio: false` / `includesAdIdentifiers: false` flags.

## Launch-checklist items

- [x] Set `ADMIN_PASSWORD` env on the `api` Function (dashboard auth) — done 2026-10-18.
- [x] Neon-Auth admin-side account deletion — done 2026-10-18 (deployment 5).
      `DELETE /api/me` now signs in a dedicated ops admin
      (`NEON_AUTH_ADMIN_EMAIL` / `NEON_AUTH_ADMIN_PASSWORD` Function env) and
      calls `POST /admin/remove-user`; verified live (removed → 404 on
      `get-user`, sign-in → 401). The ops admin is a `neon_auth."user"` row
      with `role='admin'`; rotate its password like any credential.
- [ ] Fill the store privacy forms using the table above.
- [ ] Attach a privacy policy URL (content: `docs/PRIVACY.md`).
- [ ] Verify the EAS-built binaries include the mic permission string
      (`eas build` → inspect Info.plist / AndroidManifest).
- [ ] Deploy the updated `api` Function (AI proxy + CORS allowlist + rate
      limiting) — pending a Neon API key. Command: `docs/DEPLOYMENT.md`.
- [ ] Set `AI_API_KEY` (and optionally `AI_MODEL` / `AI_STT_MODEL` /
      `AI_API_URL`) on the `api` Function to enable live tutor + voice. Until
      then the app is honest: `503 ai-not-configured` and labeled demo lines.
