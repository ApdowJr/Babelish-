# Babelish — website (`site/`)

The public front page. Static HTML, CSS and JavaScript: no framework, no build
step, no web fonts, no analytics, no requests to any host except `api.github.com`
(to confirm the APK link is alive).

**This is not a web version of the app.** Babelish is native-only by decision
(see `docs/BUILD_MOBILE.md`); `site/` explains the app and hands out the
installer. Nothing here uses `react-native-web`, and `expo export --platform web`
remains refused.

## What it contains

| Page | Purpose |
|---|---|
| `index.html` | Hero, features, how it works, download, FAQ |
| `privacy.html` | The privacy policy — the same text as Settings → Privacy policy, so the stores have a real URL |
| `terms.html` | The terms of service |

Copy is bilingual (English / Somali). Every string is an element with
`data-i18n="key"` plus two dictionary entries in `app.js`; a missing or
untranslated key fails `tests/landingPage.test.ts`.

## Brand

The page uses the mascot's violet (`#3A2FB8` daylight, `#A99CFF` at night),
sampled from `assets/icon.png`, with every text pair checked against WCAG AA.
The phone mock-ups inside the page deliberately keep the **app's own forest
palette**, because they are meant to look like what opens on the phone.

`site/assets/` holds byte-identical copies of `assets/icon.png` and
`assets/store/feature-graphic.png`; a test fails if they drift. The 540 KB
master is never served to a page: the markup uses 32/128/180/192 px derivatives
generated from it (`site/README.md` has the one-liner). A test also fails if a
page starts downloading the master for a 34 px mark.

`index.html` ships no `canonical`, `og:url` or `og:image` on purpose — all three
need an absolute URL and the project does not own a host yet. Add them with the
real origin after the first deploy; a test keeps them out until then, so the
page never points a crawler at a domain that is not serving anything.

## Deploy

Any static host works. On Vercel:

1. New Project → import this repository.
2. **Root Directory:** `site` · **Framework preset:** Other · no build command.
3. `site/vercel.json` supplies the CSP and cache headers (it is only read when
   the root directory is `site`; the repository-root `vercel.json` remains the
   web kill-switch).

Preview locally:

```bash
python3 -m http.server 8080 --directory site
```

## The download button

```
https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk
```

`.github/workflows/android-apk.yml` builds that file from source when a `v*` tag
is pushed and attaches it to the release:

```bash
git tag v3.4.0 && git push origin v3.4.0
```

The page asks the GitHub API whether the asset exists; if it does not, a note
appears and the buttons fall back to the releases page. It never shows a
download that goes nowhere.

**Signing:** the workflow APK is signed with the generated debug keystore. It
installs by side-loading; it is not the Play artifact (`eas.json` →
`app-bundle`).
