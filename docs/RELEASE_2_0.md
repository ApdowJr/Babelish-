# Babelish 2.0 — release notes

**Theme:** the whole atlas, free.

Babelish 2.0 turns the 10-language beta into a 24-language learning app and
removes the last paywall from the core experience. The visual language was
rebuilt from the tokens up, and the product gained the screens a learner needs
between lessons: a daily goal, a phrasebook, a word bank and badges.

---

## 1. Product changes

### 24 languages, all playable

`src/data/languages.ts` now defines 24 languages with:

- native name, flag, approximate native-speaker count
- BCP-47 TTS locale (so the voice matches the language)
- script + reading direction (`rtl` for Arabic, Hebrew and Persian)
- language family, difficulty tier and region tags
- dialects actually taught, culture blurb and a greeting

Every language ships **two bundled chapters** — *First words* (12 essentials)
and *Numbers 1–10* — built deterministically from `src/data/starters.ts`.
Spanish keeps its hand-authored 5-chapter CEFR course (20 lessons, 160
exercises). Totals ship at **51 chapters · 66 lessons · 666 exercises**.

### Free forever

`FREE_DAILY_SCENARIOS` is now `null` and `scenarioAllowance()` returns `null` for
every plan. The lesson paywall screen was deleted. "Premium" is now an optional
**supporter** tier (badge + family seats at launch) and no learning surface reads
it. All copy in Home, Explore, the language page check-in and Profile says the
same thing.

### First-run onboarding

`src/app/onboarding.tsx` — three steps, animated, accessible:

1. **Welcome** — value props, language mosaic, free-forever badge.
2. **What do you want to learn?** — searchable grid of all 24 languages.
3. **A habit that fits your day** — daily goal (5/10/15/20 min), native language,
   and a first-phrase preview.

Stored in `PreferencesProvider` (`onboarded`). Existing 1.x users are migrated to
`onboarded: true` automatically, so nobody sees the tour twice.

### Words tab (new)

A library split into three segments:

- **Practice** — due / in-review / mastered tiles, the full word bank sorted by
  next review, per-word audio and Leitner box dots, plus a plain-language
  explanation of the boxes.
- **Phrasebook** — all 24 languages, 528 starter words plus every curriculum
  vocabulary item, filterable by category and searchable in native script,
  English or transliteration. Play audio or save straight into the review queue.
- **Badges** — level/league card with weekly XP, 12 achievements with visible
  progress, this week's activity chart, and the published XP table.

### Daily goal + multi-language

`PreferencesProvider` gained `dailyGoalMinutes` and `activeLanguageIds`.
`src/lib/xp.ts` now records a `daily` counter alongside lifetime/weekly, so the
Home goal bar reflects real XP earned today (and rolls over at local midnight).
"Add another" on Home/Explore adds a language to *My languages*; progress is
computed per language with `src/lib/catalog.ts`.

### Home rebuild

Greeting + avatar, continue hero, streak/XP/words tiles, daily goal, adaptive
plan, my-languages rail, word of the day with audio + save, weekly rhythm/league,
featured-language rail, and the free-forever card.

### Lesson speaking cards

The old "arrives in Phase 2" placeholder was replaced with a working speaking
card: the phrase, transliteration, the native voice and a *Hear it* button.
Spoken exercises are already ungraded in the player; the card now actually helps.

---

## 2. Design system

`src/theme/tokens.ts` was replaced with a "warm atlas" palette and scale:

- parchment canvas, forest ink, tangerine/sun/sky/lilac accents with fixed meaning
- display typography up to 38 px with tighter tracking
- `shadows.card / raised / hero / floating`
- `layout.maxContentWidth = 620` — the whole app centres on desktop web
- radii raised to 12–30 px

New reusable primitives: `SectionHeader`, `Card`, `ProgressBar`/`ProgressDots`,
`StatTile`, `WeeklyBars`, `SegmentedControl`, `Pill`, `EmptyState`, `AuthHero`.
`Screen` gained `tabBarSpace` and edge-to-edge options and now clamps content
width on web.

Navigation: the tab bar floats above the content with a raised gradient **Speak**
orb; tabs are Home · Explore · Speak · Words · You.

---

## 3. Tests and quality

- `tests/starterPacks.test.ts` — 24 unique languages, complete 22-word packs, no
  duplicate targets/meanings, transliteration for every non-Latin word, search
  behaviour and AI script-guard markers.
- `tests/progress.test.ts` — daily/weekly/lifetime XP, ISO week rollover, lesson
  XP rules, achievements, language counting.
- `tests/freePlan.test.ts` — pins the free promise: no allowance, 50 lessons in a
  row allowed, replays never blocked, supporter codes and referral hashing.

Gates run clean at release: `npm test`, `npx tsc --noEmit`, `npm run
check:functions`, `npx expo lint`, and a web bundle (`expo start --web`).

---

## 4. Upgrade notes

- No database migration is required. Preferences, analytics and subscription
  blobs are backward compatible; new fields fall back to defaults.
- Existing users skip onboarding (migration keyed on the presence of stored
  preferences).
- The `BABELISH-BETA` supporter code now resolves (it previously did not);
  `ZELVOCA-*` codes remain valid.
- All 2.0 content ships inside the binary — no remote fetch, so the release works
  offline and in demo mode.
