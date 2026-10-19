# Babelish — Privacy Policy (plain language)

_Last updated: 2026-10-19. This is the source of truth for the store privacy
forms and the in-app privacy screen (Profile → PRIVACY)._

## The short version

Your practice stays on your phone. Babelish has **no ads, no third-party
analytics, and no data brokers**. The only thing that ever syncs to a server
is your progress and vocabulary — under **your own** Neon account, on a
database branch you control. Microphone audio is transcribed on demand and
never stored.

## What lives only on your device

- Practice events, XP, streaks, league standing (computed locally)
- Your learner profile (name, goals, interests)
- Reminder settings (scheduling is a local OS notification — no push server)
- The offline curriculum for every language (bundled in the app)

None of this leaves the device unless **you** sign in, and even then only the
items in the next section sync.

## What syncs when you sign in

| Data | Where | Why |
|---|---|---|
| Lesson progress (scores, timestamps) | Your Neon Postgres branch (`app_state`) | Resume on another device |
| Vocabulary / spaced-repetition boxes | Same row | Keep review queues correct |
| Weekly XP (a number, and a week key) | `weekly_xp` | Your rank on the weekly board |

The weekly board is **privacy-first by design**: you see your own rank and
the number of participants — never another learner's identity, and they never
see yours. Reports you file ("this sounds wrong") are queued with your user
id so reviewers can follow up; they are never shown to other learners.

## Microphone audio

- Pronunciation scoring happens **on your device**.
- Optional cloud speech-to-text runs only when the operator has configured a
  provider. In production the audio is sent to **Babelish's own backend** (a
  Neon Function, `POST /api/ai/stt`), which forwards it to the AI provider
  **for transcription only**; the audio is discarded immediately and only the
  transcribed phrase is kept as practice content. The provider's API key lives
  in the backend's configuration — never inside the app.
- On the **web** app, when no provider is configured, Babelish can use your
  **browser's own speech recognition** (the Web Speech API) so the microphone
  still works with no server key. In that mode your audio is handled by the
  browser's speech service (in Chrome, Google's) — **not** by Babelish — and
  only the resulting text returns to the page; Babelish keeps nothing from it
  beyond the same practice content described above. The Speak tab labels this
  mode while it is active.
- With no STT configured *and* no browser recogniser available, audio never
  leaves the device — and the app says so instead of pretending otherwise.

## AI tutor content

Tutor replies come from the app's AI backend when the operator has configured a
provider (server-side key), or from a development endpoint in local builds, or
from the clearly-labeled built-in demo lines when neither exists. Conversation
text is sent to that endpoint to generate the reply; it is not stored by Babelish.
A failed live request surfaces an error — the app never disguises an outage as
an "AI" answer. Every AI-generated item that could reach the curriculum passes
the human approval gate (`docs/CONTENT_REVIEW.md`) before publication — AI never
publishes itself.

## Children

Babelish is general-audience (12+). It is not directed at children under 13 and
does not knowingly collect their data. No ads, no tracking, no behavioral
profiling — for anyone, of any age. See `docs/STORE_COMPLIANCE.md`.

## Your rights

- **Export everything** the app knows about you: Profile → PRIVACY →
  *Export my data* (JSON via the system share sheet).
- **Delete everything**: Profile → PRIVACY → *Delete account* — wipes the
  device and calls `DELETE /api/me`, which erases your rows from
  `app_state`, `weekly_xp`, and `learner_reports`.
- No cookie banners, because there is nothing to consent to.

## Operators & subprocessors

| Service | Role | Data |
|---|---|---|
| Neon (Lakebase Postgres + Managed Auth + Functions) | App backend | Account id/email, progress, vocab, weekly XP, reports |
| OpenAI-compatible endpoint (optional, configurable) | STT + tutor | Audio (transient, STT only), conversation text |

That's the whole list. Nothing else touches your data. AI provider keys are
held only in backend configuration (a Neon Function env var) — `EXPO_PUBLIC_*`
values shipped in the app are never used for privileged secrets.
