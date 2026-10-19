# Babelish — Device Test Plan (Master Audit, Phase J)

_Last updated: 2026-10-19._

This is the **on-device** verification plan for the things that cannot be
checked from a build container (no physical device, microphone, or speaker
here). **None of the rows below have been executed yet** — record a result for
each on real hardware; do not call the release ready until rows 1–8 pass on at
least one iOS device and one Android device.

## Preconditions

- A **development build** (`eas build --profile development`, or
  `npx expo run:ios|android` locally). Expo Go only bundles its own native
  modules; audio/notification behaviour must be checked in a dev build.
- Backend reachable: the app talks to the Neon Function by default (endpoints
  are baked as build defaults). For live AI, the operator must have set
  `AI_API_KEY` on the Function; otherwise expect the **honest** demo/disabled
  states below (those are pass criteria too).
- A quiet room for the microphone rows.

## Rows

| # | Step | Expected | Result |
|---|---|---|---|
| 1 | Cold start with default config | No "demo mode" banner; Profile → APP STATUS shows AI tutor + voice status matching the backend's real `/api/ai/status` | ☐ |
| 2 | Create a new account (email + password) | Real Managed Auth account; sign-out then sign-in restores the session; progress syncs | ☐ |
| 3 | Password reset (if exposed) | Reset email arrives; link works | ☐ |
| 4 | Delete account (Profile → PRIVACY) | Local wipe + `DELETE /api/me`; account can no longer sign in; confirmation is honest about failures | ☐ |
| 5 | Speak tab → record (grant mic) | Permission prompt appears with the plain-language string; recording starts; transcript returns (live STT) or an actionable "not configured" message | ☐ |
| 6 | Deny the mic permission | App explains how to enable it; no crash; typing fallback still works | ☐ |
| 7 | TTS: tap a phrase | Audible, correct target-language voice; for a slow/repeat control, output matches; with a broken voice the Speak tab shows the error banner instead of silent failure | ☐ |
| 8 | AI tutor (live key configured) | Reply is in the target language; Arabic/Chinese target never returns Latin text (script guard); rate limit shows the friendly 429 message after the budget | ☐ |
| 9 | AI tutor (no key configured) | Messages are **explicitly labeled demo**, or an actionable error — never a fake "live" reply | ☐ |
| 10 | `EXPO_PUBLIC_NEON_DISABLED=1` build | Demo mode is explicit and labeled; no real sync is implied | ☐ |
| 11 | Airplane mode | Practice/offline curriculum works; sync failures surface honestly and retry later | ☐ |
| 12 | Background the app mid-recording | No crash; recording state is sane on return | ☐ |

## Why these are not in CI

- Microphone capture, TTS audibility, OS permission prompts, notification
  scheduling, and EAS binary contents require a real device / simulator with
  audio. The container used for the audit has none, so this file is a checklist
  only. Everything that *can* be automated is covered by `npm test`,
  `npm run smoke:local`, and `npm run neon:e2e`.
