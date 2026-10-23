# Babelish — Android APK + iPhone kaliya (Web ma jiro)

> **SOOMAALI marka hore, English hoos.**
> Babelish hadda waa **app taleefan oo kaliya**: Android (.apk / .aab) iyo
> iPhone (iOS). **Web/browser version lama rabo, waana laga saaray.**

---

## 🇸🇴 Soomaali

### Maxaa is beddelay?

| Wax | Kahor | Hadda |
|---|---|---|
| Web (Vercel, browser) | ✅ jiray | ❌ **waa la saaray** — `vercel.json`, `react-native-web`, `react-dom` ma jiraan |
| Android | ✅ | ✅ **APK** (si toos ah loo rakibo) + AAB (Play Store) |
| iPhone (iOS) | ⚠️ config kaliya | ✅ build profile diyaar ah (hoos ka fiiri shuruudaha Apple) |
| `app.json` platforms | android + ios + web | `["android", "ios"]` oo kaliya |

### Sida APK-ga loo helo — 3 doorasho

#### Doorasho 1 (ugu fudud, lacag la'aan, account la'aan): GitHub Actions

1. Fur GitHub repo-ga → tab-ka **Actions**
   _(Fiiro gaar ah: workflow-gan wuxuu soo muuqdaa marka isbeddelkan la
   merge-gareeyo `main` — GitHub wuxuu workflow-yada gacanta laga wado
   ka qaataa default branch-ka oo kaliya.)_
2. Dooro **“Build mobile (APK + iOS)”** → **Run workflow** → platform: `android`
3. Sug ilaa uu ka dhamaado (qiyaastii 15–30 daqiiqo)
4. Bogga hoose, **Artifacts → `babelish-android-apk`** soo deji
5. Faylka `.apk` u dir taleefanka (WhatsApp, USB, iwm) oo taabo si aad u rakibto.
   Haddii taleefanku diido: *Settings → Install unknown apps → Allow*

> APK-gan GitHub waa mid **debug-key lagu saxiixay**: taleefan kasta waa
> lagu rakibi karaa waana la wadaagi karaa, laakiin **Google Play lama
> gelin karo**. Play Store-ka waxaad u baahan tahay doorasho 2 (AAB).

#### Doorasho 2: EAS (Expo Cloud) — APK saxiixan / Play Store / iPhone dhab ah

```bash
npm install
npx eas-cli@latest login        # account Expo ah (bilaash)
npx eas-cli@latest init         # hal mar: wuxuu qoraa projectId

npm run build:apk               # → .apk (Android, si toos ah loo rakibo)
npm run build:aab               # → .aab (Google Play Store)
npm run build:iphone            # → iPhone build (Apple account ayaa loo baahan yahay)
npm run build:preview           # → Android APK + iOS, labadaba (internal)
```

Marka ugu horreysa, EAS wuxuu ku weydiinayaa “keystore ma kuu
samaynaa?” — **Yes** dheh. Furaha saxiixa waligaa GitHub ha gelin.

#### Doorasho 3: Kombiyuutarkaaga (Android Studio leh)

```bash
npm run build:apk:local         # → build-output/Babelish.apk
```

Waxaad u baahan tahay JDK 17 + Android SDK. Haddaadan lahayn, doorasho 1 isticmaal.

### iPhone — runta waa in la ogaado ⚠️

**iPhone-ku APK ma qaato.** Apple waxay u oggol tahay 2 waddo oo kaliya:

1. **App Store / TestFlight** — waxay u baahan tahay **Apple Developer
   account: $99/sannadkii**. Markaas: `npm run build:iphone`, kadib
   TestFlight ayaa dadka lagu casuumaa.
2. **Simulator** (Mac kaliya) — GitHub Actions dooro platform `ios`:
   wuxuu dhisayaa app simulator-ka Mac ka shaqeeya si loo hubiyo in
   code-ka iOS-ku sax yahay. **Taleefan dhab ah laguma rakibi karo**
   saxiix la'aan — tani waa xadka Apple, ma aha cilad code-ka ah.

Ma jirto waddo sharci ah oo “.ipa” saxiix la'aan iPhone caadi ah loogu
shubi karo sida APK-ga Android. Qof kuu sheega taas waa been.

### Hubi kahor intaadan dhisin

```bash
npm test                  # imtixaanada oo dhan
npx tsc --noEmit          # TypeScript
npm run check:release     # waa inuu yiraahdo "Clear to build"
npm run build:android     # JS bundle Android
npm run build:ios         # JS bundle iOS
```

### Privacy URL (Play Store / App Store ay u baahan yihiin)

Bakhaarada (stores) waxay u baahan yihiin bog **privacy policy** oo
internet ka furan — xitaa haddii app-ku web lahayn. Qoraalku wuxuu ku
jiraa `docs/PRIVACY.md`; ka hor intaadan store-ka gelin, ku daabac
meel bilaash ah (tusaale GitHub Pages) oo URL-kaas ku qor store-ka.
Ha isticmaalin URL duug ah oo web-app ah oo aan hadda jirin.

---

## 🇬🇧 English

Babelish is **native-only**: Android (`.apk` direct-install, `.aab` for
Google Play) and iPhone (iOS). The web target was removed at the owner's
request — `app.json` declares `platforms: ["android", "ios"]`, and
`npm run check:release` fails if web dependencies, scripts, a `web`
section, or `vercel.json` ever come back (see `tests/nativeOnly.test.ts`).

### Get the APK

| Path | Command / clicks | Result | Needs |
|---|---|---|---|
| **GitHub Actions** (easiest) | Actions → “Build mobile (APK + iOS)” → Run workflow _(appears once this change is merged to `main` — manual workflows only run from the default branch)_ | Downloadable `.apk` artifact, debug-signed, installs on any Android phone | Nothing — no Expo/Apple account |
| **EAS Cloud** | `npm run build:apk` | Signed `.apk` | Free Expo account |
| **EAS Cloud** | `npm run build:aab` | `.aab` for Google Play | Free Expo account |
| **Local** | `npm run build:apk:local` | `build-output/Babelish.apk` | JDK 17 + Android SDK |

GitHub-Actions workflow: `.github/workflows/build-mobile.yml`
(expo prebuild + `./gradlew assembleRelease`).
Local wrapper: `scripts/build-apk-local.sh`.
EAS profiles: `eas.json` — `development`, **`apk`**, `preview`,
`production` (Android `app-bundle` + iOS device build).

### iPhone

There is no “APK for iPhone”. Apple's only paths are:

- **TestFlight / App Store** — Apple Developer Program (**$99/year**),
  bundle id `app.zelvoca.babelish` is already set. `npm run build:iphone`
  produces the build; distribute via TestFlight.
- **Simulator** — `npm run build:iphone` alternatives: the GitHub Actions
  `ios` job builds an unsigned simulator `.app` (`iphonesimulator`,
  `CODE_SIGNING_ALLOWED=NO`) proving the native iOS code compiles. It
  cannot be installed on a physical iPhone — that is Apple's rule, not
  a Babelish limitation.

### What was removed (web)

- `vercel.json` (web deployment), `assets/favicon.png`
- Dependencies: `react-native-web`, `react-dom`, `@expo/metro-runtime`
- Scripts: `web`, `build:web` → replaced by `build:android`,
  `build:ios`, `build:apk`, `build:apk:local`, `build:aab`,
  `build:iphone`, `build:preview`
- `app.json`: `web` section gone, `platforms: ["android", "ios"]` added
- CI: web export gone; **both** Android and iOS JS-bundle exports must pass
- In-app: referral message no longer links to a website; Settings data
  export uses the native share sheet; Settings voice badge reflects only
  the tutor-server probe (no browser speech engine exists any more)

### Notes for maintainers

- Pure helpers that mention “browser/web” internally (`src/lib/mic.ts`,
  `src/lib/speech.ts`, `src/lib/models/browser.ts`, …) are **unreachable
  on native** — every entry point first checks `Platform.OS`/`window` and
  falls through to the tutor server or the offline coach. They were left
  in place deliberately: deleting them would mean rewriting the voice/AI
  routing and its tests for zero behaviour change on phones. The web
  *target* is gone; those dead branches simply never execute in the APK/IPA.
- Auth deep links still parse `https://…` callback URLs **as text**
  (`src/lib/authLinks.ts`) because Supabase email links can arrive in
  that shape; the app itself opens them via the `babelish://` scheme.
  Parsing a URL string is not a web build.
- The Supabase backend (Auth, PostgreSQL, `babelish-ai` Edge Function)
  is unchanged. “No web” means no browser version of the **app** — the
  phone still talks to Supabase over HTTPS, as any native app does.
- Store listings still need a public privacy URL (both stores require
  one even for native-only apps). Publish `docs/PRIVACY.md` somewhere
  public (e.g. GitHub Pages) before submitting; see
  `docs/STORE_RELEASE.md`.
