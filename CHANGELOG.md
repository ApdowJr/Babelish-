# Changelog

All notable changes to Babelish. The format follows Keep a Changelog and the
project uses semantic versioning.

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
