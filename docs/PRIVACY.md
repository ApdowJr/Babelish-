# Babelish — Privacy Policy (plain language)

_Last updated: 2026-10-19. This is the source of truth for the store privacy
forms and the in-app privacy screen (Profile → PRIVACY)._

## The short version

Your practice stays on your phone. Babelish has **no ads, no third-party
analytics, and no data brokers**. The only thing that ever syncs to a server
is your progress and vocabulary — in your Supabase account, protected by Row Level Security (RLS). Microphone audio is transcribed on demand and
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
| Lesson progress (scores, timestamps) | Supabase PostgreSQL (`user_progress`) | Resume on another device |
| Vocabulary / spaced-repetition boxes | Supabase PostgreSQL (`user_vocab`) | Keep review queues correct |
| Weekly XP (a number, and a week key) | Stored locally for now | Personal progress summaries |

The weekly board is **privacy-first by design**: you see your own rank and
the number of participants — never another learner's identity, and they never
see yours. Reports you file ("this sounds wrong") are queued with your user
id so reviewers can follow up; they are never shown to other learners.

## Microphone audio

- Pronunciation scoring happens **on your device**.
- Optional cloud speech-to-text runs only when the operator has configured a
  provider. When configured, audio is sent to the operator's chosen tutor gateway, which forwards it to the AI provider
  **for transcription only**; the audio is discarded immediately and only the
  transcribed phrase is kept as practice content. The provider's API key lives
  in the backend's configuration — never inside the app.
- With no STT configured, audio never leaves the device — and the app says so
  instead of pretending otherwise.

## AI tutor content

Tutor replies use the Supabase `babelish-ai` Edge Function when the operator has configured a compatible provider and server-side key, or from the clearly-labelled bundled offline coach when no live model is available. Conversation
text is sent to that endpoint to generate the reply; it is not stored by Babelish.
A failed live request surfaces an error — the app never disguises an outage as
an "AI" answer. Every AI-generated item that could reach the curriculum passes
the human approval gate (`docs/CONTENT_REVIEW.md`) before publication — AI never
publishes itself.

## Children

Babelish is general-audience (12+). It is not directed at children under 13 and
does not knowingly collect their data. No ads, no tracking, no behavioral
profiling — for anyone, of any age. See the app's current privacy and data-safety disclosures.

## Your rights

- **Export everything** the app knows about you: Profile → PRIVACY →
  *Export my data* (JSON via the system share sheet).
- **Delete your account**: Settings → Danger zone → *Delete account*. After confirmation, a protected Supabase Edge Function deletes the authenticated Supabase account; the app then clears local learning data and saved conversations. If the server cannot confirm deletion, the app reports failure rather than claiming success.
- No cookie banners, because there is nothing to consent to.

## Operators & subprocessors

| Service | Role | Data |
|---|---|---|
| Supabase Auth + PostgreSQL | App backend | Account id/email, progress, vocabulary, learner reports |
| OpenAI-compatible endpoint (optional, configurable) | STT + tutor | Audio (transient, STT only), conversation text |

That's the whole list. Nothing else touches your data. AI provider keys are
held only in Supabase Edge Function secrets (`AI_API_KEY` and, if needed, `AI_STT_API_KEY`). `EXPO_PUBLIC_*` values shipped in the app are never used for privileged secrets.
