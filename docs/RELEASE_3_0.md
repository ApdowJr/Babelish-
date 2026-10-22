# Babelish 3.0 — release notes and verification

Branch: `arena/e110abfd-babelish` (based on `main` @ `ae64e5a`; the session's
branch name is fixed by the workspace, so the 3.0 work lives here rather than on
a separate `feature/*` branch).

## What shipped

1. **Open-source model layer** — `src/lib/models/*` with adapters for Ollama,
   any OpenAI-compatible server, Babelish's optional gateway and Transformers.js
   in the browser, plus a bundled offline coach.
2. **Honest model UI** — `Settings → AI model`, a model bar on Speak, and AI
   rows on Profile. Every "live" claim follows a real probe; nothing is
   pre-labelled.
3. **Tutor** — CEFR level chips, explanation-language selector, target-language
   selector, scenario role-play, strict JSON contract with a target-script guard
   and one corrective retry.
4. **Voice** — mic permission on demand → recording → Whisper (gateway, LAN or
   browser) → tutor → TTS with replay and 0.55× slow mode, plus actionable
   errors and typing fallback. Word-match feedback is explicitly labelled as
   transcript accuracy, not phonetic scoring.
5. **Courses** — every language has a real course; the 23 non-Spanish languages
   get a 4-chapter / 8-lesson / 66-exercise starter course built from verified
   vocabulary, labelled `Starter course · A1–A2`. Spanish keeps its authored
   course, labelled `A1 · in progress`.
6. **Review** — rebuilt screen with a due-card snapshot, flashcards both ways,
   typed recall, live Leitner box state, session stats and a weakest-skill
   recommendation.
7. **Docs and tests** — `docs/AI_ARCHITECTURE.md`, this file, and five new test
   files (courses, models config, adapters, offline coach, review).

## Quality gates actually run

| Gate | Command | Result |
|---|---|---|
| Typecheck (app) | `npx tsc --noEmit` | **0 errors** |
| Typecheck (Function) | `npm run check:functions` | **0 errors** |
| Lint | `npx expo lint` | **0 errors, 0 warnings** |
| Unit tests | `npm test` | **105 passed / 105**, 14 files |
| Web export | `npx expo export --platform web` | **success**, `dist/` 6,586,843 B |
| Dev bundle | Metro entry bundle over HTTP | **200**, 6,904,111 B (dev, unminified) |
| Routes | `curl / /settings/ai /review /speak` with proxy Host | **200** each |

Chunks (production): entry 1.11 MB, shared 1.01 MB, profile 90 KB, speak 75 KB,
words 24 KB, settings/ai 17 KB, review 12 KB. No model weights are bundled —
browser models download only after an explicit opt-in.

## What was **not** run here

- **A live model inference.** The sandbox has no Ollama daemon, no GPU and no
  route to model registries, so every adapter test uses stubbed HTTP. Sections
  §7.1–7.3 of `docs/AI_ARCHITECTURE.md` are the real end-to-end path for a
  machine with a local model.
- **Browser inference in a real browser** (no browser can be installed here).
- **Microphone capture and OS TTS on a device.**
- **A deployed gateway.** The Function type-checks and its contract is covered
  by tests, but no deployment was performed in this environment.

These are stated as limitations rather than claimed as verified.

## File map (3.0 additions)

```
src/lib/models/{types,catalog,config,chat,stt,browser,audio,offlineTutor,settings,status}.ts
src/lib/ai.ts                 # rewritten around the adapters
src/lib/aiCore.ts             # explanationLanguage + widened tutor instructions
src/lib/curriculum/status.ts  # authored vs starter tier + honesty copy
src/lib/review.ts             # grading, due queue, grouping, Leitner maths
src/app/settings/ai.tsx       # the model settings screen
src/app/review.tsx            # rebuilt
src/app/(tabs)/speak.tsx      # model bar, level chips, language pickers, honest mic
src/app/(tabs)/profile.tsx    # AI model card + probe-driven status
src/app/language/[id].tsx     # course tier card
src/data/curriculum/samplers.ts  # 4-chapter starter courses
functions/api/index.ts        # keyless self-hosted gateway, opt-in only
docs/AI_ARCHITECTURE.md       # architecture, coverage, setup, hardware, limits
tests/{courses,modelConfig,modelAdapters,offlineTutor,review}.test.ts
```

## Known limitations

1. Somali is **not** in the atlas; no course was invented for it.
2. Qwen2.5 documents 15 of the 24 languages; the other nine need the explicit
   unverified opt-in or a different server model.
3. Starter courses are A1–A2 vocabulary drills, not complete CEFR paths, and
   have no native-reviewed grammar notes.
4. TTS is the OS voice; Kokoro/Piper are catalogued but not wired to playback.
5. Browser inference is experimental (CDN module import + host CSP).
6. No acoustic pronunciation scoring exists — the UI says so.
7. Self-hosting is free of API fees, not free of hardware, power or maintenance.

## Suggested next steps

- Run a native-speaker review for the 23 starter courses and add grammar notes.
- Add a Somali starter pack from a reviewed source (would extend the atlas to 25).
- Wire a Kokoro/Piper HTTP adapter and a TTS model picker with real playback.
- Add an end-to-end test against a containerised Ollama in CI.
- Consider a small speech model per language once coverage tables are reviewed.
