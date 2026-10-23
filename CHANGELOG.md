# Changelog

All notable changes to Babelish. The format follows Keep a Changelog and the
project uses semantic versioning.

## [Unreleased]

### Changed

- **Native-only: Android APK + iPhone, no web.** At the owner's request the
  web target was removed completely — `app.json` now declares
  `platforms: ["android", "ios"]`, the Vercel web build config (now
a disable-only `vercel.json` kill switch: `git.deploymentEnabled: false`) and the web-only
  dependencies (`react-native-web`, `react-dom`, `@expo/metro-runtime`) are
  gone, and `expo export --platform web` is refused by Expo itself. CI now
  bundles **both** Android and iOS. `npm run check:release` and
  `tests/nativeOnly.test.ts` fail if a web target is ever re-added.
- New phone build paths: EAS `apk` profile (`npm run build:apk`),
  `npm run build:aab` (Play), `npm run build:iphone`, a local
  `scripts/build-apk-local.sh`, and a manual GitHub Actions workflow
  (“Build mobile (APK + iOS)”) that produces a downloadable APK with no
  Expo account. Guide (Soomaali + English): `docs/BUILD_MOBILE.md`.
- The **GitHub Actions iOS job** now runs on an **Xcode 27** runner (Expo
  SDK 58 requires Xcode 26.4+; the previous `macos-14` image failed
  `xcodebuild` instantly with exit 66) and installs CocoaPods
  dependencies explicitly. Verified end-to-end: the Android APK and the
  unsigned iOS simulator build both complete and upload artifacts.
- In-app leftovers of the web build were removed: the referral message no
  longer links to a website, Settings data export uses the native share
  sheet only, and the Settings voice badge reflects only the tutor-server
  probe.

### Fixed

- **Supabase Preview check** failing on `main` with *"Remote migration
  versions not found in local migrations directory."* Three migrations
  had been applied remotely (`20261023042259`, `20261023042605`,
  `20261023111245`) and later committed under different timestamps
  (`…071500`, `…073000`, `…110000`); Supabase compares versions, not
  names. The files are renamed to their remote-applied versions (SQL
  verified statement-for-statement against the remote history), the
  duplicated deny policy was removed from `ai_usage_daily`, and
  `tests/migrations.test.ts` now pins the directory to the remote
  history so it cannot drift again unnoticed. **No database change** —
  the remote schema is untouched.

## [3.4.0] — 2026-10-22

Night mode, a progress screen that explains the streak, and a theme system the
compiler enforces.

### Added

- **Dark mode, everywhere.** A second palette ("night atlas") with the same
  keys as the daylight one, so no component branches on the theme. Settings →
  Appearance offers **System / Light / Dark**; `System` follows the device and
  updates live. The status bar, navigation background, tab bar, every card,
  chip, icon and modal follow along — there is no light-mode leftover.
- **`useTheme()` / `useThemedStyles()`.** StyleSheets are now built from the
  active palette and rebuilt only when it changes. The old static `colors`
  export is gone, so a screen that forgets the hook fails to compile rather
  than staying stubbornly light.
- **A detailed progress screen** (`/progress`, reachable from Profile →
  Momentum → Details): a six-week activity calendar with monthly labels, the
  current streak and active-day count, level progress, and a per-skill
  breakdown (reading, listening, writing, speaking) with sample counts. Skills
  without enough answers say **"Not enough yet"** instead of drawing a
  confident percentage from one tap. Empty accounts get an honest empty state.
- **Contrast tests** (`tests/theme.test.ts`, `tests/progressCalendar.test.ts`):
  WCAG AA ratios are computed for every ink/surface pair in both palettes,
  plus guards that no file imports the static palette and that every themed
  StyleSheet is actually used.

### Changed

- The **hero gradient** is slightly deeper (`#22705A` at its light end) and
  `onDarkMuted` is more opaque, because white text on the old green only
  reached 3.9:1. Muted text, warnings and tint inks were darkened for the same
  reason: the light theme now passes AA where it previously did not.
- **`userInterfaceStyle`** is `automatic`, so the OS stops forcing light
  chrome under a dark UI.
- Version **3.4.0** (versionCode 30400, iOS build 3.4.0).

## [3.3.0] — 2026-10-22

Release-candidate build: the profile learners control, and everything the
stores ask for before a first submission.

### Added

- **A profile that is really yours.** The Profile tab now opens a full editor
  (`/profile/edit`) with an emoji avatar and six colour themes, a display name,
  a one-line bio, a job, interest and goal chips, and a live preview of exactly
  what the tutor receives. Edits are held until you press Save, leaving with
  unsaved changes asks first, and the avatar shows up on Home, Profile and the
  editor — one `Avatar` component, one source of truth.
- **Profile completeness.** The Profile tab shows how much of the profile is
  filled in and links straight to what is missing, instead of an empty card.
- **Terms of Service** (`/terms`), written in the same plain voice as the
  privacy policy, linked from Settings and from a consent line on the last
  onboarding step. Both stores require a reachable terms page.
- **`npm run check:release`** — a pre-submission gate that fails on version
  drift, a version code that would go backwards, a missing package id, a store
  asset at the wrong size, an undeclared permission, a committed keystore, a
  secret in an `EXPO_PUBLIC_*` variable, or an `eas.json` that would upload
  straight to production.
- **Play Store artwork**: a 512×512 RGB store icon and a 1024×500 feature
  graphic, both generated by the same script as the app icon.
- **Android notification icon** (white silhouette, 96×96) plus a configured
  channel, so a reminder no longer arrives with a grey square.

### Changed

- **Store configuration is complete**: `app.zelvoca.babelish` on both
  platforms, `android.versionCode` derived from the version
  (major·10000 + minor·100 + patch), iOS microphone string and the
  encryption question answered, and only the two permissions the app uses
  (`RECORD_AUDIO`, `POST_NOTIFICATIONS`).
- **`eas.json`** with development, preview and production profiles and a submit
  profile that targets the *internal* track as a *draft* — nothing can publish
  by accident.
- The profile model lives in `src/lib/learnerProfile.ts` and is validated on
  every read and write, so a 3.1 blob (no avatar, no bio) or a hand-edited one
  can never put arbitrary text inside the avatar circle.

### Docs

- `docs/STORE_RELEASE.md` — the exact Play Console declarations (data safety,
  content rating, ads), paste-ready listing copy, screenshot list and the
  iOS notes.

### 3.3.0 additions (second pass)

- **First-run profile.** Onboarding gained a "Say hello" step: name, avatar and
  why you are learning, saved before the first lesson so the tutor's very first
  reply can use them. Skippable, like every other step.
- **Reset progress.** Settings → Data & storage can clear lessons, words, XP
  and the streak while keeping the account, profile and preferences — the reset
  also pushes the empty state to the server, so a sync cannot restore what was
  just cleared. The boundary is pinned by `tests/resetProgress.test.ts`.
- **Send a test reminder.** Proves the notification permission and channel work
  now, instead of waiting until 18:00 to discover they do not.
- **Send feedback.** Opens the learner's email app with version, platform and
  course pre-filled — no in-app tracking, no silent telemetry.

## [3.2.0] — 2026-10-22

### Added

- **A real brand mark.** Two speech bubbles — a parchment answer with a written
  line, a tangerine reply — replace the template icon. `scripts/brand/generate-icons.py`
  draws every size from one set of coordinates and the app palette, and the
  in-app `BrandMark` rebuilds the same drawing from views, so icon, splash and
  header cannot drift apart. Regenerated: iOS/store icon, Android adaptive
  foreground + gradient background + monochrome, splash mark, favicon.
- **A splash that belongs to the app.** The native splash (`expo-splash-screen`)
  now uses the same mark on the same forest plate, and hands off to an animated
  in-app splash: the mark settles, the wordmark rises, a hairline progress bar
  fills, then the plate fades onto the ready app. A minimum on-screen time stops
  a warm start from flashing a half-drawn frame. “Reduce motion” keeps the
  timing and drops the movement.
- **Settings, rebuilt as a settings screen.** A searchable, grouped screen
  (Account · Learning · Languages · Tutor & voice · Accessibility · Data &
  storage · About & help · Danger zone) with real switches and segmented
  choices, a language sheet, live tutor/voice status, data export, chat
  clearing, account deletion and an about section with version and privacy.
- **New preferences, each with a visible effect**: translations on/off under
  tutor replies, playback speed (slow / normal / fast) applied to every spoken
  line, “read replies aloud”, and reduced motion. Stored values are validated in
  one pure module (`src/lib/preferenceRules.ts`) so a blob from any version
  cannot reach the speech engine as a NaN rate.

### Changed

- The Profile tab is now about you — identity, level, streak, languages, plan —
  with a single entry point to Settings; reminder, offline pack, privacy and
  status moved to the new screen instead of being duplicated.

## [3.1.0] — 2026-10-22

### Added

- **A release gate for the tutor.** `npm run check:tutor` asks the deployed
  Function for `/api/ai/status` and then sends one real turn, so "deployed" and
  "working" stop being the same word. A wrong key, a retired free model or an
  empty reply fails with an actionable message instead of leaving learners on
  Coach mode. `npm run deploy:tutor` runs the gate automatically after every
  deploy (`SKIP_TUTOR_GATE=1` to skip).
- **A daily budget, honestly stated.** Tutor messages and voice transcriptions
  have separate per-learner allowances (30 / 12 by default) plus a server-wide
  chat budget (45), because free model endpoints are not infinite. When a cap is
  reached the Speak screen shows a dated note ("resets at 00:00 UTC") in its own
  strip — not a generic error, not a fake tutor turn — and lessons, review and
  the phrasebook keep working. Signed-in learners get a larger allowance than
  guests; usage is counted per UTC day in `public.ai_usage`.
- **Refunds for our failures.** A timeout, a 502 from the provider or an empty
  transcript does not consume the learner's allowance; only turns that actually
  produced something count.

- **One slot per turn, even for a bad answer.** If the model replies in the
  wrong script the server asks once more, in the same request, before giving
  up — so a wobbly answer costs one daily slot instead of two. The app no
  longer retries that case either; it would have been billed twice.
- **Clear this conversation.** A trash button in the Speak header forgets the
  current language/scenario chat on the device after a confirmation, and a
  fresh opening line is requested. Other conversations, lessons and progress
  are untouched. Restore stays deliberately device-local: the tutor transcript
  is never stored on a server.
- **Guest identity can no longer grow the database.** `X-Forwarded-For` is
  client-controlled, so it is normalised (first hop, strips ports, quoted
  values and `::ffff:`, validates IPv4/IPv6, ≤45 chars) and collapses to
  `unknown` instead of becoming an address-shaped key. The admin login throttle
  uses the same normaliser. Spoofing still buys another *guest* allowance —
  the server-wide daily budget is the real ceiling, and the docs say so.
- **A crash probe you can open.** `/dev-crash` throws on purpose in a
  development build, so the crash screen can be verified on a device instead of
  waiting for a real crash. Production builds redirect it home and throw
  nothing.

- **Accessibility pass (static).** Every tappable element in `src` now has an
  accessible name or an explicit decorative opt-out, every modal can be
  dismissed without its close button, the language picker is marked modal, the
  conversation list is a labelled region, and status changes (thinking, voice
  errors, the daily-limit note) are polite live regions. Chips and level
  filters gained hit slop to reach the 44 pt guideline. Two automated guards
  fail the suite if this regresses; device screen-reader checks are still open
  and listed in `docs/A11Y_3_1.md`.
- **Barge-in and one audio channel.** Opening the mic (chat or phrase practice)
  stops the tutor mid-sentence, so the reply never plays into the recording and
  the learner can answer immediately — the interrupt is a tap, not an
  always-listening microphone. Starting any line stops the previous one, and
  tapping the line that is playing turns its button into Stop.
- **A crash screen instead of a blank one.** Any unexpected render error now
  lands on a readable screen with Try again and Back to Learn, wired both
  inside the provider tree and as Expo Router's route-level boundary. It never
  clears storage, signs anyone out or touches progress — lessons and reviews
  are written as they finish, so the copy can honestly say nothing completed
  is lost. The one-line detail is redacted (`sk-…`, Bearer, JWT, long opaque
  keys) and clipped before display.
- **Answers grounded in the learner's current lesson.** Speak resolves the
  first unfinished lesson of the target language from the bundled curriculum
  and sends only its id. The proxy (or a local/browser adapter) looks that id
  up and adds the lesson's goal, up to eight vocabulary pairs, the notes
  already taught and three example lines to the system prompt — about 700
  characters, so the per-turn cost barely moves. An unknown id, or one from
  another language, adds nothing; client text never reaches the prompt.
- **Conversations survive a reload.** The Speak screen restores the last chat
  for the selected language and scenario instead of starting over — on web
  refresh, tab remount and app restart, and with no quota spent on a fresh
  greeting. History is stored per account on the device (`u:<id>` or `guest`),
  so two learners sharing a phone never read each other's chats; it is capped
  at 12 conversations of 40 messages, clipped to the server's 4 000-character
  limit, expires after 45 days, and is erased by “Delete account”. Storage is
  best-effort: offline or full storage just means the chat is not restored.
- **Stop a reply in progress.** The send button becomes Stop while the tutor is
  thinking; tapping it (or leaving the screen, or switching language/scenario)
  aborts the request. Cancellation is its own outcome — no error card, no
  retry against another runtime, and the server aborts the upstream provider
  call so the owner is not billed for an answer nobody will read. The daily
  slot stays spent: the model was already asked, and refund-on-cancel would be
  a free-inference loop.
- The voice path is cancellable too: stopping a transcription aborts the
  upload instead of waiting for a result that is no longer wanted.

### Changed

- `/api/ai/status` now reports `quota` (limits, used, reset time, and whether
  the store is database-backed or in-memory) alongside `chat`/`stt`.
- `QuotaExceeded` is its own error class, so a spent budget is never retried
  against another runtime and never dressed up as a connection problem.

### Fixed

- **Concurrent requests could overshoot a cap.** Counting was a read followed
  by an increment, so two simultaneous turns could both take the last slot.
  Each claim is now one conditional upsert (`insert … on conflict do update …
  where <cap> returning`), and the shared budget lives in a single row per day
  (`public.ai_usage_daily`) so the check and the increment cannot interleave.
  The in-memory fallback never awaits between read and write, so it is atomic
  per instance for the same reason.
- **Voice was blocked by the chat budget in the fallback path.** The daily
  budget covers chat spend only; a busy day of typing must not silence the
  microphone. The fallback now matches the database path.
- **Refunds were too generous.** A provider answer — even an unusable or
  silent one — was billed upstream, so refunding it made repeated junk replies
  or silent uploads a way to spend the server's provider quota for free.
  Refunds now apply only when no provider answer was produced (network error,
  timeout, 5xx).

## [3.0.3] — 2026-10-22

### Fixed

- **Voice selection never matched.** Browsers expose `{name, lang}` while the
  matcher expects `{identifier, language}`, so every browser voice looked
  unknown — the app announced "no X voice is installed" and spoke with the
  default voice. `toVoiceLike()` normalises the list, and the chosen voice is
  now actually attached to the utterance.
- **The opening tutor line had no label.** Only later turns carried the coach
  note, so the first card could be mistaken for a real model reply.
- **Coach copy** no longer says "no language model is running / set one up in
  Settings" — it says the tutor server is unavailable, matching the strip and
  the Profile row. A test now fails if any coach tip mentions Settings or a
  download.

## [3.0.2] — 2026-10-22

### Fixed

- **"Speech playback failed — try again." on Android Chrome.** The web speech
  path went through expo-speech, whose shim reports `interrupted` / `canceled`
  (normal when a new line replaces an old one) as errors. Web playback now uses
  the Web Speech API directly: replacement events are silent, real failures get
  specific advice (blocked audio, busy speaker, missing locale voice), the
  utterance is held against garbage collection, Chrome's long-speech pause is
  nudged, and a "nothing started" check catches blocked embeds.
- **The user's message text was invisible** on the dark green bubble — it used
  the body ink instead of the on-dark colour. The "Voice" chip had the same
  contrast bug.
- **Three stacked banners** (error, coach notice, voice help) covered half the
  Speak screen. Coach mode is now a one-line strip with a **Retry** action, the
  voice explanation only appears after tapping the mic and disappears on typing,
  and the offer to run Whisper in the browser is only made on desktop-sized
  browsers — not on a phone's data plan.
- The mic button now shows a muted icon when voice input is unavailable, instead
  of looking active and doing nothing.

### Added

- `npm run deploy:tutor` — one command that deploys the `api` Function with the
  model chain in its environment. The key is read from `AI_API_KEY`, never
  printed, and never enters the app bundle.

## [3.0.1] — 2026-10-22

### Changed

- **The learner never configures a model.** The `Settings → AI model` screen,
  the "OPEN-SOURCE AI / Models, not middlemen" copy and the Speak model bar are
  gone. The tutor is a server-side concern: the app probes its own backend and
  starts talking.
- Default mode is now `server`; nothing probes `localhost` or offers a download
  on first run. Local/LAN/browser adapters remain in code for self-hosters.
- The tutor server fronts a **fallback chain** (`AI_MODELS`,
  comma-separated). Defaults to OpenRouter's free Qwen3-Next endpoints, which
  document all 24 atlas languages; a retired free model moves to the next
  instead of failing the turn.
- `GET /api/ai/status` also reports `models[]` and `sttEnabled`.
- Guest access: `/api/ai/chat` and `/api/ai/stt` now work without a session
  under a tighter per-IP budget (6 chats + 2 transcriptions per minute), so
  demo mode has a real tutor. Every other `/api/*` route still requires a JWT.

### Fixed

- **"Microphone access is off — enable it in Settings to speak" is gone.** That
  message conflated four different failures and pointed at a screen browsers do
  not have. `src/lib/mic.ts` keeps the real cause and gives actionable advice:
  embedded frame → open in a tab; denied → address-bar lock icon; insecure
  origin → use HTTPS; no device; device busy; native denial → an Open-settings
  button that actually works.
- The mic button no longer disables itself silently when no speech model is
  configured — tapping explains the options, including one-tap browser Whisper.
- Gateway adapters tolerate a missing session (no Authorization header) and
  treat 401/403 as "coach mode" instead of an error mid-conversation.

## [3.0.0] — 2026-10-22

### Added

- **Open-source AI layer** (`src/lib/models/*`): replaceable adapters for Ollama,
  any OpenAI-compatible server, Babelish's self-hosted gateway and
  Transformers.js in the browser, plus a bundled offline coach. No paid API is
  required for any core feature and none is used by default.
- **Model catalogue with honest coverage**: Qwen2.5 (15 documented languages),
  Llama 3.2, Aya Expanse, Whisper large-v3-turbo/base, Kokoro-82M and Piper,
  each with licence, commercial-use flag, size and hardware notes. Unverified
  languages are blocked unless the learner opts in.
- **Settings → AI model**: runtime modes (auto · this device/LAN · app server ·
  in this browser · offline), engine check with real probes, per-language
  coverage card, server URLs and model ids, speech model picker, browser toggle,
  hardware/cost table and reset.
- **Tutor upgrades**: CEFR level chips, explanations and tips in the learner's
  native language, scenario role-play, strict JSON contract, target-script
  guard with one corrective retry.
- **Voice pipeline**: permission on demand → recording → Whisper (gateway, LAN
  or browser) → tutor → TTS with replay and 0.55× slow mode, with actionable
  error states and typing always available.
- **Real starter courses for 23 languages**: 4 chapters · 8 lessons · 66
  exercises each (1,518 exercises) covering choose, type, listen and speak,
  built from verified starter words. Spanish keeps its 5-chapter authored course.
- **Course tier labels** (`src/lib/curriculum/status.ts`) so a starter course is
  never presented as a complete CEFR path.
- **Rebuilt review screen**: due-card queue both ways, typed recall, Leitner box
  movement, real session stats and a weakest-skill recommendation.
- Tests for model config/adapters, the offline coach, course data and review
  maths (14 files, 105 tests), and `docs/AI_ARCHITECTURE.md`.

### Changed

- The gateway (`functions/api`) now defaults to a **self-hosted, keyless**
  OpenAI-compatible endpoint and reports 503 `ai-not-configured` unless the owner
  explicitly opts in. `AI_MODEL` defaults to `qwen2.5:1.5b`,
  `AI_STT_MODEL` to `whisper-large-v3-turbo`.
- Speak, Profile and the status rows name the runtime and model that actually
  answered; "Checking…" is shown until a probe resolves.
- Pronunciation chips are labelled **word match** and explicitly described as
  transcript accuracy, not acoustic scoring.
- App/package version bumped to 3.0.0.

## [2.0.0] — 2026-10-22

### Added

- **24-language atlas** (10 → 24): Italian, Dutch, Swedish, Polish, Ukrainian,
  Greek, Turkish, Hebrew, Persian, Bengali, Korean, Vietnamese, Thai, Indonesian
  join the original ten, each with dialects, script, difficulty and a greeting.
- **Starter packs for every language**: *First words* + *Numbers 1–10*, generated
  from curated word lists (22 words per language, 528 total), all offline.
- **Onboarding** — 3-step welcome with language search, daily goal and native
  language; migrated users skip it.
- **Words tab** — review practice, searchable phrasebook with native audio and
  save-to-review, plus 12 achievements and the XP ledger.
- **Daily goals** (5/10/15/20 min) with a real today-XP progress bar.
- **Multi-language tracking** with per-course progress in Home and Explore.
- **New design system** — warm atlas palette, typography, shadow scale, web
  max-width, floating tab bar and a raised Speak orb.
- **Home rebuild** — continue hero, stat tiles, daily plan, my languages, word of
  the day, weekly rhythm and featured-language rail.
- **Language page rebuild** — gradient hero, course progress, chapters, starter
  phrasebook preview and scenario rail.
- **Profile rebuild** — goal picker, my-languages management, free-plan card,
  supporter code and v2 status.
- **Working lesson speaking cards** with native reference audio.
- New primitives: `Card`, `SectionHeader`, `ProgressBar`, `StatTile`,
  `WeeklyBars`, `SegmentedControl`, `Pill`, `EmptyState`, `AuthHero`.
- Tests for the atlas, starter packs, XP ledger, achievements and language
  counting.
- `docs/RELEASE_2_0.md` and this changelog.

### Changed

- **Every lesson is free** — the free plan's 1-lesson/day limit and its paywall
  screen were removed; premium is now an optional supporter tier.
- Free-tier copy across Home, Explore, the language page and Profile.
- App/package version bumped to 2.0.0.
- The app forces the light "warm atlas" theme (`userInterfaceStyle: light`)
  to match the rendered UI.
- `BABELISH-BETA` now redeems correctly (previously it was rejected).
- Signed-in users now skip the auth stack and land on Home (or onboarding).

### Fixed

- Lesson speaking exercises no longer claim to be "locked until Phase 2".
- Supporter code redemption in Profile no longer fails silently.
- `forgot-password` and footer links use a readable primary colour instead of a
  12 %-opacity fill.
- Loading indicators are visible on the new parchment background.
- Bottom content no longer hides under the floating tab bar.
