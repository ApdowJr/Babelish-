# Shipping Babelish to the Play Store (and the App Store)

Everything in this file is either **done in code** or an **explicit action only you can take**
(accounts, uploads, legal identity). Nothing here is claimed to be done on your behalf.

Run `npm run check:release` before every upload — it blocks the mistakes that cost a build cycle.

---

## 1. What is already configured

| Item | Value | Where |
|---|---|---|
| App name / slug | Babelish / `babelish` | `app.json` |
| Android package | `app.zelvoca.babelish` | `app.json` |
| iOS bundle id | `app.zelvoca.babelish` | `app.json` |
| Version | `3.2.0` (must match `package.json`) | `app.json`, `package.json` |
| Android versionCode | `30200` = major·10000 + minor·100 + patch | `app.json` |
| Permissions | `RECORD_AUDIO`, `POST_NOTIFICATIONS` only | `app.json` |
| iOS mic string | set | `app.json` → `ios.infoPlist` |
| Encryption question | answered (`false`) | `app.json` → `ios.infoPlist` |
| Icons / splash | generated, all sizes | `assets/`, `assets/store/` |
| Play icon + feature graphic | 512² RGB, 1024×500 | `assets/store/` |
| Build profiles | development / preview / production (AAB) | `eas.json` |
| Submit profile | internal track, **draft** | `eas.json` |
| Legal pages | `/privacy`, `/terms` | `src/app/` |
| Consent | shown before onboarding completes | `src/app/onboarding.tsx` |

**Bump the version in one place.** Change `package.json`, `app.json` and `android.versionCode`
together; `npm run check:release` fails if they disagree or if the code goes backwards.

---

## 2. Build and upload

```bash
# one-time
npm i -g eas-cli        # or: npx eas-cli@latest …
eas login               # your Expo account
eas init                # links the project, writes extra.projectId

# build (cloud, no local Android SDK needed)
eas build --platform android --profile production    # → .aab
eas build --platform ios --profile production        # → .ipa (needs an Apple account)

# upload
eas submit --platform android --profile production   # internal track, draft
```

The first production Android build asks whether EAS should generate the signing key — say **yes**
and let EAS store it. Never commit a keystore (`secrets/`, `*.jks`, `*.keystore` are gitignored).

> **Not verified here:** this environment has no EAS account and no Android SDK, so no build or
> upload has been run. The configuration is validated by `npm run check:release` and by
> `tests/releaseConfig.test.ts`, not by a real upload.

---

## 3. Play Console — the declarations that block publishing

Create the app, then fill **App content**. Each answer below is what the code actually does.

| Declaration | Answer | Why |
|---|---|---|
| Privacy policy URL | `https://zelvoca.app/privacy` | `/privacy` is a real route, not a placeholder |
| Ads | **No ads** | no ad SDK in `package.json` |
| In-app purchases | **No** | the plan screens are informational; nothing is sold |
| Content rating | fill the questionnaire honestly | no violence, no user-generated public content, no gambling |
| Target audience | 13+ (not a children's app) | tutor content is unrestricted conversation |
| News app | No | — |
| COVID-19 apps | No | — |
| Data safety | see below | must match `docs/AI_ARCHITECTURE.md` |
| Government app | No | — |
| Financial features | None | no lending, no crypto, no payments |
| Permissions | `RECORD_AUDIO` (microphone, on demand), `POST_NOTIFICATIONS` (reminder) | nothing else is requested |

### Data safety form (answer exactly this)

- **Collected:** *Personal info → Name* (account display name), *Email* (account), *App activity →
  Other user-generated content* (tutor messages, if you signed in).
- **Not collected:** location, contacts, calendar, health, photos, files, browsing history.
- **Shared with third parties:** *No.* The tutor server is ours; a configured model provider
  receives the message text but no account identity.
- **Encrypted in transit:** Yes (HTTPS only).
- **Deletion:** users can delete their account in-app (Settings → Danger zone).
- **Audio:** transcribed on demand, **never stored** — say "not collected" and explain in the
  privacy policy.

---

## 4. Listing copy (paste-ready)

**Short description** (≤ 80 chars):

```
Learn 24 languages by talking — free AI tutor, offline lessons, no ads
```

**Full description** (≤ 4000 chars):

```
Babelish is a language app built around one idea: you learn a language by using it.

Open the Speak tab and start a conversation. The tutor answers only in the language you
are learning, gently recasts your mistakes with the reason, and follows up on what you
actually said. It knows which lesson you are on, so its examples match the course you are
working through — not a generic textbook.

── 24 LANGUAGES, REAL COURSES ──
Spanish, French, Arabic, Hindi, Swahili, Bengali, Urdu, Persian, Turkish, Indonesian,
Japanese, Korean, Mandarin, German, Portuguese, Italian, Russian, Dutch, Swedish, Polish,
Ukrainian, Greek, Hebrew and Somali. 97 chapters, 204 lessons and 1,678 exercises ship
inside the app and work offline.

── A REAL VOICE ──
Tap the mic, speak your reply, and see the transcript. Play any line again, or slow it
down. Babelish never invents a pronunciation score: when there is no transcript to
compare against, it says so.

── PRACTICE THAT STICKS ──
Spaced review with due words, typed recall, and a daily goal you choose. Streaks, XP and
levels are computed on your device — missing a day never costs you anything.

── HONEST ABOUT WHAT IT RUNS ON ──
The tutor uses open-weight language models (Qwen3 family) on free endpoints, or a model
on your own machine. When no model is reachable, the tutor switches to a clearly labelled
coach that works from the bundled course instead of pretending to be an AI. There is no
model screen, no download, no API key to paste — and no paid AI service behind it.

── PRIVATE BY DEFAULT ──
Practice events, streaks and your learner profile stay on your phone. Only progress and
vocabulary sync to your own account. The microphone is used only while you hold it, and
recordings are never stored. No ads. No third-party trackers. Delete your account and
everything in it at any time.

── FREE, AND HONEST ABOUT LIMITS ──
Every lesson is free. Tutor messages and voice transcriptions have a daily allowance
(shown in the app when you reach it) because free model endpoints are not infinite.
Lessons, review and the phrasebook keep working when the allowance is spent.

Babelish is open source. If you want to run it on your own hardware, the instructions are
in the repository.
```

**What's new** (≤ 500 chars):

```
New in 3.2:
• A profile you control — avatar, bio, interests and goals, used to make the tutor talk
  about your life instead of someone else's.
• A redesigned, searchable Settings screen: reminders, voice speed, read-aloud,
  translations and reduced motion.
• A new look — mark, app icon and animated splash.
• Terms of Service are now in the app.
```

---

## 5. Screenshots

Play needs **at least 2 phone screenshots** (min 320 px, max 3840 px, ratio between 1:2 and 2:1).
App Store wants 6.7", 5.5" and (optional) iPad.

Capture these five, in this order — they mirror the first-run experience:

1. **Home** — greeting, today's plan, streak.
2. **Lesson** — an exercise with the explanation visible.
3. **Speak** — a real tutor exchange (do **not** stage a fake AI bubble; use Coach mode or a live
   server, and leave the "real model / coach" label visible).
4. **Review** — a due-words session.
5. **Profile / Settings** — the new profile card and the searchable settings list.

Rules that keep the listing honest: no text overlays claiming features that are not visible on the
screen, no stock photos, and no screenshot showing a limit as a failure.

> Screenshots are **not** included in this repository: they must be captured from a real device
> or simulator running the built app. `npm run start` serves the same UI in a browser if you need a
> quick reference, but store screenshots should come from the native build.

---

## 6. iOS specifics

- `ITSAppUsesNonExemptEncryption: false` is set — the app only uses HTTPS.
- `NSMicrophoneUsageDescription` is set; the wording matches the in-app permission rationale.
- App Review will exercise the tutor. If `AI_API_KEY` is not deployed, they see **Coach mode**,
  which is labelled — that is acceptable, but a live tutor is a better demo. Deploy it first:

```bash
AI_API_KEY=sk-or-… npm run deploy:tutor      # runs the live gate afterwards
```

---

## 7. Release checklist

```bash
npm run check:release     # versions, ids, permissions, assets, secrets, legal pages
npm test                  # 213 tests
npx tsc --noEmit && npm run check:functions && npx expo lint
npm run build:web         # export still builds
eas build --platform android --profile production
eas submit --platform android --profile production
```

Then, in Play Console: **Internal testing → add testers → promote to Closed → Production** (staged
rollout). Nothing here promotes automatically; `eas.json` submits as a *draft* on the *internal*
track on purpose.
