# Babelish brand

## The mark

Two speech bubbles: a large parchment bubble carrying a written line, answered
by a smaller tangerine bubble. It says what the product is — a conversation with
a tutor — without a flag, a globe or a letterform, and it survives at 48 px
because the silhouette is two offset rounded shapes.

Palette, taken from `src/theme/tokens.ts` so the icon cannot drift from the UI:

| Colour | Hex | Used for |
|---|---|---|
| Deep forest | `#0B3A2C` | plate, splash background |
| Forest | `#1C6852` | gradient middle |
| Mint | `#2E8B6F` | gradient end |
| Parchment | `#F7F4ED` | the answering bubble, splash mark |
| Tangerine | `#E9764F` | the reply bubble, the accent line |

## Where it lives

- `src/components/BrandMark.tsx` — the mark rebuilt from views (crisp at any
  size, no image load, works on light and dark surfaces via `tone`).
- `src/components/Logo.tsx` — mark + wordmark lockup.
- `src/components/AnimatedSplash.tsx` — the animated first second of the app.
- `assets/` — the raster assets the stores need.

## Regenerating the assets

```bash
python3 scripts/brand/generate-icons.py
```

Requires Pillow (`pip install pillow`). The script is the source of truth: it
draws at 4× and downsamples, and writes every file the config references.

| File | Size | Used by |
|---|---|---|
| `icon.png` | 1024 | iOS / store / fallback |
| `android-icon-background.png` | 1024 | adaptive background (gradient) |
| `android-icon-foreground.png` | 1024 | adaptive foreground, inside the 66 % safe circle |
| `android-icon-monochrome.png` | 1024 | Android themed icons |
| `splash-icon.png` | 512 | native splash (transparent mark) |
| `favicon.png` | 96 | web |

## Splash hand-off

`app.json` registers `expo-splash-screen` with `backgroundColor: #0B3A2C` and
the same mark. The native splash stays up (`SplashScreen.preventAutoHideAsync()`)
until `AnimatedSplash` has painted, then hides — so the learner sees one
continuous frame instead of a white flash. The overlay is decorative and
disappears the moment auth and preferences are ready (minimum 900 ms), honouring
the "Reduce motion" setting.

## Rules of thumb

- Do not hand-edit a PNG. Change the script and re-run it.
- Do not add a second accent colour to the mark; the app already spent tangerine
  on "the learner's turn".
- Keep the mark inside the adaptive-icon safe circle (62–64 % of the canvas);
  launchers crop to a circle, squircle or rounded square.
