# Babelish 3.0 — AI architecture

Babelish teaches 25 languages. **The learner never configures a model.** They
open Speak and the tutor answers; the only configuration lives on the server
that the app owner runs.

The tutor is a hosted deployment of open-weight models (Qwen3-Next 80B via
OpenRouter by default, or any OpenAI-compatible endpoint you host). Courses,
review, the phrasebook and device audio need no model at all, and a labelled
coach covers the tutor when the server is unreachable. No model screen ships in
the app.

This document is the honest map: what runs where, which models were verified
for which languages, how to set each one up, what it costs in hardware, and
what is **not** finished.

---

## 1. Three planes of inference

| Plane | What it is | Runs on | Needs a server? | Cost to you |
|---|---|---|---|---|
| **On-device content** | 101 chapters · 212 lessons · 1,744 exercises · 550 starter words · Leitner review · phrasebook · OS text-to-speech | The learner's phone/browser | No | Free |
| **Tutor server** | Babelish's `api` Function → OpenRouter free Qwen3 endpoints (default) or any OpenAI-compatible server you host | A machine you rent or own | Yes | Free-tier requests are $0; self-hosting costs electricity and hardware |
| **On-device model** | Transformers.js Whisper (`whisper-base`) for voice input in the browser | The learner's browser | No (one ~150 MB download) | Free (bandwidth + battery) |
| **External provider** | Optional. Any OpenAI-compatible endpoint, including paid ones | Someone else's servers | Yes | Whatever that provider charges |

The first two are the product. The tutor server is what makes the app work with
**zero setup for the learner**: they never download weights, never pick a model,
never paste a key. That convenience has a real cost for whoever operates the
server — free endpoints are rate-limited and rotate, and self-hosting is not
free of electricity.

The **offline coach** is not a model. It is a curated set of starter words and
scenario phrases with a translator note, and every message it produces says
`Offline coach` in the tip. It keeps the app useful on a plane, on a bad
connection, or on a device that cannot run any model.

---

## 2. Code map

```
src/lib/models/
  types.ts        # ModelSpec, RuntimeId, Coverage, ChatAnswer, EngineUnavailable/EngineFailed
  catalog.ts      # model catalogue + per-family language tables + licence/commercial flags
  config.ts       # defaults (server mode), URL sanitising, runtime planning, coverage gate
  chat.ts         # adapters: gateway · Ollama · OpenAI-compatible · browser; probes
  stt.ts          # adapters: gateway · local Whisper · browser Whisper
  browser.ts      # Transformers.js runtime loader, chat, Whisper decode/resample/transcribe
  audio.ts        # recording bytes for on-device inference
  offlineTutor.ts # the bundled coach (cards + scenario phrases), labelled in every reply
  settings.ts     # on-device settings store (server mode by default)
  status.ts       # probe → AiStatus {chat, stt, source, runtime, model, detail}
src/lib/mic.ts    # microphone failure → actionable message (web/native, iframe, insecure…)
src/lib/ai.ts     # app-facing API: tutorReply, transcribeSpeech, speakNative, fetchAiStatus
src/lib/aiCore.ts # prompt + strict-JSON contract + wrong-script guard (shared with the Function)
functions/api/index.ts  # the tutor server: model chain, rate limits, key stays server-side
```

There is no model screen. Swapping a model is a server environment change
(`AI_MODELS`), not an app rebuild and never something the learner does.

### Runtime selection

`config.ts` decides the attempt order from the learner's mode:

| Mode | Chat order | Speech-to-text order |
|---|---|---|
| `server` (**default**) | tutor server | tutor server → browser Whisper |
| `auto` | local/LAN → tutor server → browser | tutor server → local Whisper → browser |
| `local` | Ollama → local OpenAI-compatible → browser | local Whisper → browser |
| `browser` | browser only | browser only |
| `offline` | none (bundled coach) | none (typing) |

`local` deliberately never posts audio to the app owner's server. `auto` puts a
LAN server first because it is cheaper than downloading a model.

Every runtime is probed with a real request (`/api/tags`, `/models`,
`/api/ai/status`) before the UI claims it is live. Until a probe returns, the
badge says "Checking for a language model…", not "Live".

---

## 3. Model catalogue and verified language coverage

The catalogue records what each model card actually documents. A language
missing from a table is **unverified**, not assumed. Unverified languages are
blocked unless the learner flips *Use unverified languages* in Settings.

| Model | Kind | Size (approx.) | Runtime(s) | Licence | Commercial use | Languages in the atlas documented by its card |
|---|---|---|---|---|---|---|
| **Qwen3-Next 80B A3B Instruct (default, hosted)** | chat | 0 on device | tutor server (OpenRouter) | Apache-2.0 | yes | **24 of 25** (Somali is not yet model-verified; Qwen3 documents 119 languages) |
| Qwen2.5 0.5B / 1.5B Instruct | chat | 0.4 / 1.0 GB | Ollama, OpenAI-compatible, gateway, browser | Apache-2.0 | yes | 15: zh en es fr de it pt ru ja ko vi th ar id tr |
| Qwen2.5 3B Instruct | chat | 2 GB | Ollama, gateway | Qwen Research licence | **no** (research only) | same 15 |
| Llama 3.2 3B Instruct | chat | 2 GB | Ollama, gateway | Llama 3.2 Community | check (700 M MAU cap) | 8: es fr de it pt hi th tr |
| Aya Expanse 8B | chat | 5 GB | gateway | CC-BY-NC-4.0 | **no** | 20 (no bn/sw/th/vi) |
| Whisper large-v3-turbo | stt | 1.6 GB | gateway, OpenAI-compatible | MIT | yes | 24 of 25; Somali unverified |
| Whisper base (Transformers.js) | stt | 0.15 GB | browser | MIT | yes | all 24 |
| Kokoro-82M | tts | 0.3 GB | self-hosted TTS server | Apache-2.0 | yes | 7: es fr hi it pt ja zh |
| Piper | tts | 0.06 GB/voice | self-hosted TTS server | MIT (voices vary) | yes | 16 verified voices (no sv/bn/id) |
| OS voice (`expo-speech`) | tts | 0 | device | OS | n/a | whatever the device ships; checked at runtime |

**Qwen3-TTS** and similar recent releases are listed in the catalogue as
watched, *not runnable*: at the time of writing we could not confirm a stable,
documented multilingual release with a working runtime, so the app does not
pretend to offer it.

### What is *not* covered

- **Somali (`so`) is in the atlas as a starter course, but is not yet verified for the listed AI models.** The 24 previously shipped languages are
  `es fr de it pt nl sv pl ru uk el tr ar he fa hi bn zh ja ko vi th id sw`.
  Adding Somali requires a curated starter pack — guessing vocabulary would
  break the honesty rule, so it is left out rather than faked. Swahili (`sw`)
  is the nearest East African course and is covered by Whisper.
- The default hosted Qwen3 model documents 24 of 25 atlas languages, including
  Swahili, Bengali, Hebrew and Persian. Somali is the one atlas language not yet
  verified for this model family. If you swap in Qwen2.5 instead, nine
  languages (`nl sv pl uk el he fa hi bn sw`) are listed as unverified and are
  blocked unless you opt in — that is the catalogue being honest, not a bug.
- No model is claimed to produce *perfect* grammar in any language. Lessons are
  the validated content; the model is a conversation partner.

---

## 4. Tutor contract

The tutor is one request/response shape whichever runtime answers:

```
POST /api/ai/chat  (gateway)  or  runChat(...)  (local/browser)
{ languageId, level, scenarioTitle?, learnerName?, explanationLanguage?, profile?, history[] }
→ { reply, translation, tip? }
```

`aiCore.ts` builds the system prompt:

- speaks **only** the target language in `reply`; translation and tips go in
  the learner's native language (`explanationLanguage`);
- adapts to CEFR A1–B2 (`auto` follows completed lessons, the chips override);
- recasts mistakes with a reason instead of a bare correction;
- role-plays the selected scenario; keeps the last turns in context;
- answers translate / explain / drill requests grounded in the course;
- teaches only grammar it is certain about;
- returns strict JSON `{reply, translation, tip}` — anything else is rejected.

The client validates the JSON *and* checks the target script (`scriptMatches`)
for non-Latin languages. A wrong-script answer triggers **one** corrective
retry; if that also fails, the learner sees an error. It is never replaced with
scripted text in "live" mode.

The gateway (`functions/api`) repeats request validation server-side: ≤40
messages, ≤4,000 characters, CEFR bounded, unknown language rejected, 55 s
upstream timeout, 20 chats/minute/user. The model id is never accepted from the
client.

---

## 5. Voice pipeline

```
mic permission (only on tap) → record (≤30 s) → STT adapter → tutor → TTS playback
```

| Stage | Implementation | Failure behaviour |
|---|---|---|
| Permission | `AudioModule.requestRecordingPermissionsAsync` on first mic tap | Explains how to enable it; no recording |
| Capture | `expo-audio` `HIGH_QUALITY` preset, one recorder per screen, race-safe start/stop | "Nothing was captured — try again" |
| STT | gateway `/api/ai/stt` → local `/audio/transcriptions` → browser Whisper | Specific message; falling back to typing is always offered |
| Tutor | `runChat` chain | Real error surfaced (rate limit, timeout, wrong script) |
| TTS | `expo-speech` with the language's `ttsLocale` (e.g. `ar-EG`, `ja-JP`), replay and 0.55× slow mode | A banner says when no locale voice is installed and playback uses the default |

Privacy: recordings are written to the app's cache by the OS recorder,
uploaded only when the learner uses voice input, and never stored by Babelish.
Chat transcripts live in memory for the session; conversation text is not
logged. The gateway keeps no audio.

**Pronunciation honesty.** The per-word chips compare the *transcript* with the
target phrase (exact / close / missed). The UI now calls this **word match**
and states that it is not acoustic pronunciation scoring. There is no phonetic
scorer, no accent score and no claim of one. Twice-repeated mistakes still get
an honest "try again", not a fabricated grade.

---

## 6. Courses

| Tier | Languages | Structure | Honest label |
|---|---|---|---|
| Authored | Spanish | 5 chapters · 20 lessons · grammar/culture notes | `A1 · in progress` — A2–B2 not finished |
| Starter (validated) | 23 | 4 chapters · 8 lessons · 66 exercises each, built from the 22 verified starter words | `Starter course · A1–A2` — no native-reviewed grammar notes |

Totals: **24 languages · 97 chapters · 204 lessons · 1,678 exercises · 528
starter words**, all bundled and validated by `tests/courses.test.ts` (unique
ids, answerable exercises, options containing the answer, all four skills
present, no placeholder lessons).

The starter courses drill *meaning, typing, listening and speaking* of real
curated vocabulary. They deliberately do not invent example sentences for
languages we have not had reviewed. The language page shows the tier and the
note; neither tier is advertised as a complete CEFR path.

Review is a Leitner queue (1/2/4/8/15 days) fed by real lesson results and
phrasebook saves. The review screen quizzes due cards both ways (target →
meaning, meaning → typed target), records every answer through
`reviewWord`, and recommends the weakest skill from actual analytics.

---

## 7. Setup

The app ships with **no model configuration for the learner**. Everything below
is an operator task, done once.

### 7.1 Hosted tutor server (recommended — zero setup for learners)

Deploy the `api` Function with an OpenRouter key. Free Qwen3 endpoints cover all
24 languages at $0 per token:

```bash
AI_API_KEY=sk-or-... npm run deploy:tutor
```

`scripts/deploy-tutor.mjs` wraps the CLI call below and refuses to print the
key; `AI_API_URL`, `AI_MODELS`, `AI_STT_ENABLED` and `AI_STT_MODEL` can be
overridden as env vars.

```bash
neon functions deploy api --src functions/api/index.ts \
  --env "AI_API_KEY=$OPENROUTER_API_KEY" \
  --env AI_API_URL=https://openrouter.ai/api/v1 \
  --env "AI_MODELS=qwen/qwen3-next-80b-a3b-instruct:free,qwen/qwen3-next-80b-a3b-instruct" \
  --env AI_STT_ENABLED=false --wait
```

No app rebuild is needed — the client discovers the tutor by probing
`GET /api/ai/status` through the same backend URL it already uses, and the
Speak screen's **Retry** action re-probes without a reload.

**Fallback chain.** `AI_MODELS` is tried in order. Free endpoints are retired
without notice, so when one disappears the server moves to the next; a bad key,
a rate limit or a timeout is returned as itself instead of being hidden.

**Rate limits.** Free OpenRouter tiers allow roughly 20 requests/minute and
50/day on an unfunded account (1,000/day after a one-time $10 credit purchase).
The server adds its own budgets: 20 chat + 10 transcription per minute per
signed-in learner, 6 + 2 per minute per anonymous IP.

**A note on privacy.** Prompts leave the learner's device and reach the model
provider you configured. The app says "Tutor server" — it does not claim the
model runs locally. If that matters for your audience, use §7.2 instead.

### 7.2 Self-hosted model (no account, no bill, real electricity)

```bash
ollama pull qwen2.5:1.5b          # ~1 GB, Apache-2.0
OLLAMA_ORIGINS='*' ollama serve   # dev only — restrict in production

neon functions deploy api --src functions/api/index.ts \
  --env AI_API_URL=http://127.0.0.1:11434/v1 \
  --env AI_MODEL=qwen2.5:1.5b --env AI_STT_ENABLED=false --wait
```

Any OpenAI-compatible server works the same way (llama.cpp, LM Studio, vLLM,
LocalAI). Qwen2.5 documents 14 of the 25 atlas languages; the other eleven show as
unverified rather than being silently guessed at.

### 7.3 Voice input

Priority: server transcription (if enabled) → **browser Whisper** → typing.

- Server: `AI_STT_ENABLED=true` + `AI_STT_MODEL=openai/whisper-large-v3-turbo`.
  Accurate, works on phones, **metered per second of audio** by the provider.
- Browser: free and on-device. On web, tapping the mic when the server has no
  audio offers **one tap** to download `onnx-community/whisper-base` (~150 MB,
  cached afterwards). Nothing downloads until that tap.
- Typing always works, and the mic says why it cannot record instead of
  pointing at a settings screen that does not exist.

### 7.4 Browser chat model (optional)

A small chat model can run fully on-device (`onnx-community/Qwen2.5-0.5B-Instruct`,
~300–600 MB) for air-gapped use. It is off by default, never needed for the
normal hosted setup, and never downloaded without an explicit opt-in. The
`Transformers.js` module URL is configurable for self-hosted builds.

## 8. Hardware and cost

| Setup | RAM needed | Disk / download | GPU | Notes |
|---|---|---|---|---|
| **Hosted tutor (default)** | 0 on device | 0 | no | The server does the work; learners need nothing |
| Coach only | any | 0 | no | Works on low-end phones; no model |
| Qwen2.5 0.5B (browser) | ~2 GB free | 0.4–0.6 GB | WebGPU helps; WASM works | First load is slow on mobile |
| Qwen2.5 1.5B (Ollama) | ~3 GB | 1 GB | no | Good balance for a laptop |
| Qwen2.5 3B | ~6 GB | 2 GB | no | Research licence — not for commercial use |
| Llama 3.2 3B | ~6 GB | 2 GB | no | Check the 700 M MAU licence cap |
| Whisper large-v3-turbo | ~6 GB (server) | 1.6 GB | GPU recommended | ~1–3 s per short clip on CPU |
| Whisper base (browser) | ~1 GB free | 0.15 GB | no | Accuracy is visibly lower |
| Kokoro-82M TTS | ~1 GB | 0.3 GB | no | 7 languages; needs a TTS server |
| Piper TTS | <1 GB | ~60 MB/voice | no | 16 verified voices |

**What "free" means in each case:**

- Hosted free endpoints: $0 per token, but rate-limited and dependent on the
  provider's goodwill — they rotate, and a stalled free tier has no SLA.
- Self-hosting: free of API fees, not free of electricity, hardware, storage and
  maintenance. A laptop that stays on is the realistic baseline; a GPU only
  matters for larger models and low-latency voice.
- Server transcription: **metered per second of audio** where enabled. Browser
  Whisper is the free alternative.

---

## 8b. Microphone behaviour (why it asks for what it asks for)

`getUserMedia` fails for four different reasons that all look alike: permission
denied, an embedded frame without mic policy, no input device, or an insecure
origin. `src/lib/mic.ts` keeps the real `DOMException` name and maps it to
advice the learner can act on:

| Cause | What the learner sees |
|---|---|
| Embedded preview (`window.self !== window.top`) | "Open Babelish in its own browser tab…" |
| `NotAllowedError` / denied | "Tap the lock icon next to the address, set Microphone to Allow…" |
| Insecure origin | "Browsers only allow the microphone on HTTPS (or localhost)…" |
| `NotFoundError` / `OverconstrainedError` | "No microphone was found…" |
| `NotReadableError` | "The microphone is busy in another tab or app…" |
| Native app denied | "Turn on Microphone in the app's system settings" + an Open-settings button |

Permission is still requested only on the first mic tap, never at launch, and
the probe stops the stream immediately so the recorder (or another tab) can
open the device.

---

## 9. Security and privacy

- **No credentials in the app.** The bundle contains only public URLs. Local
  servers need no key; the gateway keeps `AI_API_KEY` server-side.
- **URL validation.** Model server URLs accept `http(s)://host[:port][path]`
  only — credentials, query strings and fragments are rejected before storage.
- **Settings validation.** Unknown modes, models, levels and booleans fall back
  to defaults rather than being trusted.
- **Request limits.** Chat: 20/min/user; STT: 10/min/user; ≤40 messages,
  ≤4,000 characters, ≤8 MB audio, 55 s upstream timeout.
- **Output validation.** JSON contract, length caps, target-script check,
  one retry, then a visible error.
- **Microphone on demand.** Permission is requested on the first mic tap with
  an explanation; voice is never always-on.
- **No recording storage.** Clips are uploaded only for the STT request and
  never persisted by Babelish. Conversations are not logged.
- **Local vs server is visible.** The status row, model bar and settings screen
  all state which runtime answered.

---

## 10. Testing — what is and is not proven

Automated (`npm test`, 16 files, 116 tests):

- catalogue consistency and licence labels;
- URL sanitising, settings validation, runtime plans per mode;
- coverage gating (blocked unverified language, opt-in path, unknown model);
- adapters against stubbed HTTP: Ollama success/404, fallback to gateway,
  gateway 503, unverified-language skip, local OpenAI-compatible path;
- **server routing** (new): default is the tutor server, no localhost probing,
  a signed-out request sends no Authorization header, 401 and
  `ai-not-configured` both fall through to the coach instead of an error;
- **microphone copy** (new): iframe, browser denial, insecure origin, missing
  device, busy device and native denial each produce their own actionable text;
- offline coach for all 25 languages (labels, counts, scripts, scenarios);
- course data: 25 courses, unique ids, answerable exercises, four skills,
  tier labels, catalogue totals;
- review maths: grading, due order, grouping, clamping, Leitner intervals.

**Not proven in this environment:**

- a live call to OpenRouter (this sandbox cannot reach it) or to any model.
  Adapter paths are tested with stubbed HTTP; the server chain is exercised by
  the local smoke harness against a fake provider, not a real one.
- browser inference in a real browser.
- microphone capture on a physical device or in a non-embedded tab.
- a deployed gateway with the real key.

Run `npm run smoke:local` (fake provider, 4 phases) and then the §7.1 deploy
command to see a real answer.

---

## 11. Known limitations

1. **No Somali course.** See §3.
2. **Starter courses are not CEFR-complete.** A1–A2 vocabulary drills only for
   23 languages; no grammar notes for those languages yet.
3. **Free hosted models are rate-limited and rotate.** The fallback chain
   absorbs retired endpoints, not outages or exhausted daily quotas.
4. **Server transcription costs money** where enabled; browser Whisper is free
   but downloads ~150 MB once.
5. **Browser chat inference is experimental** (`new Function('u', 'import(u)')`
   to defeat static bundling; host CSP must allow the runtime URL).
6. **TTS is the device voice.** Kokoro/Piper are catalogued, not wired.
7. **Word-match, not phonetics.** No acoustic pronunciation scoring exists.
8. **The learner's text leaves the device** on the hosted path. §7.2 is the
   local-only alternative.
