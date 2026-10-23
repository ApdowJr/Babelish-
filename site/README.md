# Babelish landing page

The public front page: what the app is, what it refuses to fake, the privacy
policy and terms the stores ask for, and one button that installs it.

Plain HTML, CSS and JavaScript. No framework, no build step, no web fonts, no
analytics, no requests to any host except `api.github.com` (to check that the
APK link is alive). That is deliberate — the app promises no trackers, and its
landing page should not be the exception.

**This is not a web version of the app.** Babelish is native-only (Android +
iPhone); this folder is a static page that explains it. Nothing here imports
`react-native-web`, and `expo export --platform web` stays refused.

## Files

| File | What it is |
|---|---|
| `index.html` | The page. Copy lives in `data-i18n` attributes, not in two places |
| `privacy.html` | The privacy policy — the same text as the app's Settings → Privacy policy |
| `terms.html` | The terms of service |
| `styles.css` | Both palettes, layout, the phone mock-ups, the legal pages |
| `app.js` | English/Somali switching, theme toggle, the honest-APK check |
| `theme-boot.js` | Applies a saved theme before first paint (keeps the CSP strict) |
| `vercel.json` | CSP, security headers, asset caching |
| `assets/` | Byte-identical copies of the icon and store feature graphic |

## Brand

The page wears the mascot's violet — `#3A2FB8` by day, `#A99CFF` at night —
sampled from `assets/icon.png`, with every text pair checked against WCAG AA.
The phone mock-ups keep the **app's own forest palette**, because they show what
actually opens on the phone.

`site/assets/icon.png` and `site/assets/feature-graphic.png` must stay identical
to `assets/icon.png` and `assets/store/feature-graphic.png`; a test fails if they
drift:

```bash
cp assets/icon.png site/assets/icon.png
cp assets/store/feature-graphic.png site/assets/feature-graphic.png
```

## Preview

```bash
python3 -m http.server 8080 --directory site
# http://localhost:8080
```

## Deploy

Vercel → New Project → this repository → **Root Directory `site`**, framework
preset **Other**, no build command. Any other static host works by uploading
the folder as-is. (`site/vercel.json` is only read when the root directory is
`site`; the repository-root `vercel.json` stays the web kill-switch.)

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
`index.html` and two entries — English and Somali — in `site/app.js`. A missing
translation is caught by `tests/landingPage.test.ts`, which also checks that the
two dictionaries have identical keys, that every `#anchor` resolves, that the
page loads nothing from a third party, that the CSP still forbids inline script,
that the catalogue numbers match the README, and that `privacy.html` /
`terms.html` still contain every section the app's own legal screens have.

Add a sentence: put it in the HTML with a new key, then add the key to both
dictionaries. `npm test` will tell you what you forgot.
