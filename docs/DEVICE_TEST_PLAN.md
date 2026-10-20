# Zelvoca — Device Test Plan (Master Audit, Phase J)

_Last updated: 2026-10-20._

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

## Microphone fixes (2026-10-20)

Code changed for the "mic must work on mobile and web" request — every rule
below is guarded by `npm test` (49 checks, 6 files):

- **`src/lib/recorderControl.ts` (new)** — pure start/stop orchestration for
  the recorder. `stop()` first awaits an in-flight `prepareToRecordAsync()`
  (a fast second tap used to land while the mic was still opening, get
  `null`, and leave the web mic running), then decides using the recorder's
  **live** `isRecording` property instead of `useAudioRecorderState`'s
  500ms-polled value (the stale read skipped the stop entirely), and
  swallows the double-stop throw web raises after the 30s cap
  auto-stopped. `dispose()` releases the mic on unmount even mid-prepare.
  9 unit tests simulate each timing with a fake recorder — including a
  denied permission and unmount-during-start.
- **`src/lib/voice.ts`** — thin React wrapper over that module.
- **`src/app/(tabs)/speak.tsx`** — a failed `start()` now shows "Couldn't
  start recording — check your microphone and try again." instead of
  leaving a dead "Recording…" UI; an empty stop says "Nothing was
  captured…" instead of silently returning; the stop path is reachable
  while a start is still preparing (guards reordered).
- **`src/lib/sttUpload.ts`** — the web `blob:` URL is revoked once its
  bytes are read (one object URL leaked per take); 3 tests cover revoke /
  no-revoke / native.

Verified in the build container: `npm test` 49/49 · `npx expo lint` 0 ·
`npx tsc --noEmit` 0 · functions `tsc` 0 · `npm run smoke:local` all
phases · `npx expo export --platform web` builds with this code.

**Still unverified here:** a live *browser* mic run was not possible — the
container's Chromium (arm64) crashes its network service and the in-app
browser is unavailable, so no synthetic-microphone run was executed. Rows
5, 6 and 12 above therefore stand for a real browser as well as a device.
Full speech→text additionally needs `AI_API_KEY` on the Function; without
it the Speak tab honestly reports voice input as not configured.

## Why these are not in CI

- Microphone capture, TTS audibility, OS permission prompts, notification
  scheduling, and EAS binary contents require a real device / simulator with
  audio. The container used for the audit has none, so this file is a checklist
  only. Everything that *can* be automated is covered by `npm test`,
  `npm run smoke:local`, and `npm run neon:e2e`.
