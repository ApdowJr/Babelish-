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
| `assets/` | Byte-identical copies of the icon and store feature graphic, plus small derivatives used in the markup |

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

The master is 1024 px and 540 KB; no page loads it. The markup uses four
derivatives, regenerated from the master whenever it changes:

| File | Pixels | Used for |
|---|---|---|
| `favicon-32.png` | 32² | browser tab |
| `icon-128.png` | 128² | header and footer mark (34 px / 28 px) |
| `icon-192.png` | 192² | the 96 px icon in the download card |
| `apple-touch-icon.png` | 180² | home-screen bookmark on iOS |

```bash
python3 - <<'PY'
from PIL import Image
src = Image.open('assets/icon.png').convert('RGB')
for name, px in [('favicon-32.png', 32), ('icon-128.png', 128),
                 ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
    src.resize((px, px), Image.LANCZOS).save(f'site/assets/{name}', optimize=True)
PY
```

## Metadata that waits for a domain

`index.html` deliberately has **no** `canonical`, `og:url` or `og:image`: all
three must be absolute URLs, and the site does not own a host yet. A relative
`og:image` is ignored by every crawler, so shipping one would only look like it
works. Once a domain exists, add these to `<head>`:

```html
<link rel="canonical" href="https://YOUR-DOMAIN/" />
<meta property="og:url" content="https://YOUR-DOMAIN/" />
<meta property="og:image" content="https://YOUR-DOMAIN/assets/feature-graphic.png" />
```

`site/assets/feature-graphic.png` is kept for exactly that.

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
