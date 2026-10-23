# Babelish landing page

The public front page: what the app is, what it refuses to fake, and one
button that installs it.

Plain HTML, CSS and JavaScript. No framework, no build step, no web fonts, no
analytics, no requests to any host except `api.github.com` (to check that the
APK link is alive). That is a deliberate constraint — the app promises no
trackers, and its landing page should not be the exception.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Copy lives in `data-i18n` attributes, not in two places |
| `styles.css` | Both palettes (copied from `src/theme/palette.ts`), layout, the phone mock-ups |
| `app.js` | English/Somali switching, theme toggle, the honest-APK check |
| `theme-boot.js` | Applies a saved theme before first paint (keeps the CSP strict) |
| `vercel.json` | CSP, security headers, asset caching |
| `assets/` | Icon and feature graphic, copied from `assets/` |

## Preview

```bash
python3 -m http.server 8080 --directory site
# http://localhost:8080
```

## Deploy

Vercel → New Project → this repository → **Root Directory `site`**, framework
preset **Other**, no build command. Any other static host works by uploading
the folder as-is.

## The download button

It points at:

```
https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk
```

`.github/workflows/android-apk.yml` builds that file from source on a `v*` tag
and attaches it to the release:

```bash
git tag v3.4.0 && git push origin v3.4.0
```

Until a release exists, `app.js` says so and sends the buttons to the releases
page. It never shows a download that goes nowhere.

**Signing:** the workflow APK is signed with the generated debug keystore. It
side-loads fine; it is not the Play Store artifact (that is `eas.json` →
`app-bundle`, signed with your release key).

## Editing the copy

Every translatable string is an element with `data-i18n="section.key"` in
`index.html` and two entries — English and Somali — in `site/app.js`. A
missing translation is caught by `tests/landingPage.test.ts`, which also
checks that the two dictionaries have identical keys, that every `#anchor`
resolves, that the page loads nothing from a third party, and that the CSP
still forbids inline script.

Add a sentence: put it in the HTML with a new key, then add the key to both
dictionaries. `npm test` will tell you what you forgot.
