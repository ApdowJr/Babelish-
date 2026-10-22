# Babelish 3.0 — AI architecture

Babelish teaches 24 languages. Its tutor, voice input and course drills run on
**open-weight models you can host yourself**, with a bundled, labelled offline
coach as the floor. No paid AI API is required for any core feature, and the
app never silently calls one.

This document is the honest map: what runs where, which models were verified
for which languages, how to set each one up, what it costs in hardware, and
what is **not** finished.

---

## 1. Three planes of inference

| Plane | What it is | Runs on | Needs a server? | Cost to you |
|---|---|---|---|---|
| **On-device content** | 97 chapters · 204 lessons · 1,678 exercises · 528 starter words · Leitner review · phrasebook · OS text-to-speech | The learner's phone/browser | No | Free |
| **On-device model** | Optional Transformers.js chat (`Qwen2.5-0.5B-Instruct`) and Whisper (`whisper-base`) in the browser | The learner's browser, via WebAssembly/WebGPU | No (first use downloads weights) | Free (bandwidth + battery) |
| **Self-hosted server** | Optional Ollama / llama.cpp / LM Studio / vLLM / faster-whisper endpoint, or Babelish's own `api` Function gateway | Hardware you own or rent | Yes | Your hardware, power and bandwidth |
| **External provider** | *Not required.* Any OpenAI-compatible endpoint can be pointed at, including paid ones | Someone else's servers | Yes | Whatever that provider charges |

The first three are the product. The fourth exists only because the same
OpenAI-compatible adapter can reach it — it is never a default, never a
fallback, and the UI never labels it as free.

The **offline coach** is not a model. It is a curated set of starter words and
scenario phrases with a translator note, and every message it produces says
`Offline coach` in the tip. It keeps the app useful on a plane, on a bad
connection, or on a device that cannot run any model.

---

## 2. Code map

```
src/lib/models/
  types.ts        # ModelSpec, RuntimeId, Coverage, ChatAnswer, EngineUnavailable/EngineFailed
  catalog.ts      # the model catalogue + per-family language tables + licence/commercial flags
  config.ts       # defaults, URL sanitising, settings validation, runtime planning, coverage gate
  chat.ts         # adapters: Ollama · OpenAI-compatible · gateway · browser; probes
  stt.ts          # adapters: gateway · local Whisper · browser Whisper
  browser.ts      # Transformers.js runtime loader, chat, Whisper decode/resample/transcribe
  audio.ts        # recording bytes for on-device inference
  offlineTutor.ts # the bundled coach (cards + scenario phrases), labelled in every reply
  settings.ts     # AsyncStorage-backed settings store (useSyncExternalStore)
  status.ts       # probe → AiStatus {chat, stt, source, runtime, model, detail}
src/lib/ai.ts     # app-facing API: tutorReply, transcribeSpeech, speakNative, fetchAiStatus
src/lib/aiCore.ts # prompt + strict-JSON contract + wrong-script guard (shared with the Function)
src/app/settings/ai.tsx  # the whole model UI: modes, coverage, URLs, hardware, reset
functions/api/index.ts   # optional gateway (JWT-gated, rate-limited, key stays server-side)
```

Swapping a model = changing a settings value or an entry in `catalog.ts`. No
screen talks to a provider directly, and no adapter knows what a lesson is.

### Runtime selection

`config.ts` decides the attempt order from the learner's mode:

| Mode | Chat order | Speech-to-text order |
|---|---|---|
| `auto` (default) | Ollama → local OpenAI-compatible → gateway → browser | gateway → local Whisper → browser |
| `local` | Ollama → local OpenAI-compatible → browser | local Whisper → browser |
| `server` | gateway only | gateway only |
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
| Qwen2.5 0.5B / 1.5B Instruct | chat | 0.4 / 1.0 GB | Ollama, OpenAI-compatible, gateway, browser | Apache-2.0 | yes | 15: zh en es fr de it pt ru ja ko vi th ar id tr |
| Qwen2.5 3B Instruct | chat | 2 GB | Ollama, gateway | Qwen Research licence | **no** (research only) | same 15 |
| Llama 3.2 3B Instruct | chat | 2 GB | Ollama, gateway | Llama 3.2 Community | check (700 M MAU cap) | 8: es fr de it pt hi th tr |
| Aya Expanse 8B | chat | 5 GB | gateway | CC-BY-NC-4.0 | **no** | 20 (no bn/sw/th/vi) |
| Whisper large-v3-turbo | stt | 1.6 GB | gateway, OpenAI-compatible | MIT | yes | all 24 |
| Whisper base (Transformers.js) | stt | 0.15 GB | browser | MIT | yes | all 24 |
| Kokoro-82M | tts | 0.3 GB | self-hosted TTS server | Apache-2.0 | yes | 7: es fr hi it pt ja zh |
| Piper | tts | 0.06 GB/voice | self-hosted TTS server | MIT (voices vary) | yes | 16 verified voices (no sv/bn/id) |
| OS voice (`expo-speech`) | tts | 0 | device | OS | n/a | whatever the device ships; checked at runtime |

**Qwen3-TTS** and similar recent releases are listed in the catalogue as
watched, *not runnable*: at the time of writing we could not confirm a stable,
documented multilingual release with a working runtime, so the app does not
pretend to offer it.

### What is *not* covered

- **Somali (`so`) is not in the atlas.** The 24 shipped languages are
  `es fr de it pt nl sv pl ru uk el tr ar he fa hi bn zh ja ko vi th id sw`.
  Adding Somali requires a curated starter pack — guessing vocabulary would
  break the honesty rule, so it is left out rather than faked. Swahili (`sw`)
  is the nearest East African course and is covered by Whisper.
- Qwen2.5 does not document `nl sv pl uk el he fa hi bn sw`. Dutch, Swedish,
  Polish, Ukrainian, Greek, Hebrew, Persian, Hindi, Bengali and Swahili
  therefore run **only** with the opt-in, or on a server model whose own card
  covers them.
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

### 7.1 Local model (recommended, free)

```bash
# 1. Install Ollama (https://ollama.com) and pull a small multilingual model
ollama pull qwen2.5:1.5b        # ~1 GB, Apache-2.0, 15 documented languages

# 2. Let the web build (a different origin) call the daemon
export OLLAMA_ORIGINS='*'       # dev only — restrict to your app origin in production
ollama serve

# 3. Run Babelish and open Settings → AI model → Check
npm install && npx expo start --web
```

Defaults: `http://localhost:11434`, `qwen2.5:1.5b`. For a phone on the same
Wi-Fi, use the computer's LAN address (`http://192.168.x.x:11434`) and set
`OLLAMA_HOST=0.0.0.0` on the server. The same screen lets you enter any
OpenAI-compatible base URL (LM Studio, llama.cpp server, vLLM, LocalAI).

### 7.2 Self-hosted gateway (optional)

Deploy the `api` Function and set:

```
AI_API_URL=http://127.0.0.1:11434/v1     # your OpenAI-compatible server
AI_MODEL=qwen2.5:1.5b                    # any id your server serves
AI_API_KEY=                              # only if the server requires one
AI_STT_MODEL=whisper-large-v3-turbo      # needs /audio/transcriptions
AI_STT_ENABLED=false                     # chat-only servers
```

The gateway is considered configured only when one of those variables is set.
Leaving them unset is the normal open-source deployment: `/api/ai/status`
reports `chat: false` and the app uses local, browser or offline paths.

If you point it at a paid provider, that is your choice and your bill — the app
does not default to one, and the docs do not call it free.

### 7.3 Browser model (opt-in, experimental)

Settings → *In this browser*:

- chat: `onnx-community/Qwen2.5-0.5B-Instruct` (~300–600 MB)
- speech: `onnx-community/whisper-base` (~150 MB)
- runtime: `https://esm.sh/@huggingface/transformers@3.7.5` (overridable for
  air-gapped builds)

Nothing is downloaded until the switch is on and the first request runs; the
screen shows download progress and falls back from WebGPU to WebAssembly.

---

## 8. Hardware and cost

| Setup | RAM needed | Disk / download | GPU | Notes |
|---|---|---|---|---|
| Offline coach only | any | 0 | no | Works on low-end phones; no model |
| Qwen2.5 0.5B (browser) | ~2 GB free | 0.4–0.6 GB | WebGPU helps; WASM works | First load is slow on mobile |
| Qwen2.5 1.5B (Ollama) | ~3 GB | 1 GB | no | Good balance for a laptop |
| Qwen2.5 3B | ~6 GB | 2 GB | no | Research licence — not for commercial use |
| Llama 3.2 3B | ~6 GB | 2 GB | no | Check the 700 M MAU licence cap |
| Whisper large-v3-turbo | ~6 GB (server) | 1.6 GB | GPU recommended | ~1–3 s per short clip on CPU |
| Whisper base (browser) | ~1 GB free | 0.15 GB | no | Accuracy is visibly lower |
| Kokoro-82M TTS | ~1 GB | 0.3 GB | no | 7 languages; needs a TTS server |
| Piper TTS | <1 GB | ~60 MB/voice | no | 16 verified voices |

Self-hosting is **not free**: it costs electricity, hardware, storage and
maintenance. A small VPS or a laptop that stays on is the realistic baseline;
a GPU only matters for larger models and low-latency voice.

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

Automated (`npm test`, 14 files, 105 tests):

- catalogue consistency and licence labels;
- URL sanitising, settings validation, runtime plans per mode;
- coverage gating (blocked unverified language, opt-in path, unknown model);
- adapters against stubbed HTTP: Ollama success/404, fallback to gateway,
  gateway 503, unverified-language skip, local OpenAI-compatible path;
- offline coach for all 24 languages (labels, counts, scripts, scenarios);
- course data: 24 courses, unique ids, answerable exercises, four skills,
  tier labels, catalogue totals;
- review maths: grading, due order, grouping, clamping, Leitner intervals.

**Not proven in this environment:**

- a live model call (no GPU/server or model download was available here). The
  adapter paths are tested with stubbed HTTP; run §7.1 to exercise a real one.
- browser inference in a real browser (the runtime is loaded from a CDN at
  call time; the sandbox has no browser).
- TTS beyond the OS voice engine; a Kokoro/Piper server adapter is catalogued
  but playback still uses `expo-speech`.
- microphone capture on a physical device.

---

## 11. Known limitations

1. **No Somali course.** See §3.
2. **Starter courses are not CEFR-complete.** A1–A2 vocabulary drills only for
   23 languages; no grammar notes for those languages yet.
3. **Model coverage gaps.** Ten atlas languages are unverified for Qwen2.5.
4. **Browser inference is experimental.** It depends on a CDN module import
   (`new Function('u', 'import(u)')` to defeat static bundling) and on the
   host's Content-Security-Policy. Self-host the runtime URL if your CSP blocks
   `esm.sh`.
5. **TTS is the device voice.** Neural TTS options are catalogued, not wired.
6. **Word-match, not phonetics.** No acoustic pronunciation scoring exists.
7. **Self-hosting has real costs.** See §8.
8. **Gateway requires deployment.** Without it, `server` mode has nothing to
   talk to — the app says so instead of falling back to a paid API.
