# Babelish — Android APK + iPhone kaliya (Web ma jiro)

> **SOOMAALI marka hore, English hoos.**
> Babelish hadda waa **app taleefan oo kaliya**: Android (.apk / .aab) iyo
> iPhone (iOS). **Web/browser version lama rabo, waana laga saaray.**
> Vercel waxaa ku jira oo keliya bog **static ah oo download & sharci ah** —
> cashirrada iyo account-ga app-ku browser-ka kuma shaqeeyaan.

---

## 🇸🇴 Soomaali

### Maxaa is beddelay?

| Wax | Kahor | Hadda |
|---|---|---|
| Web app (browser) | ✅ jiray | ❌ **waa la saaray** — `react-native-web`, `react-dom` ma jiraan. Vercel hadda wuxuu u adeegaa oo keliya faylasha static ah ee `website/` (download + Privacy/Terms), ma aha app browser ku shaqeeya |
| Android | ✅ | ✅ **APK** (si toos ah loo rakibo) + AAB (Play Store) |
| iPhone (iOS) | ⚠️ config kaliya | ✅ build profile diyaar ah (hoos ka fiiri shuruudaha Apple) |
| `app.json` platforms | android + ios + web | `["android", "ios"]` oo kaliya |

### Bogga Vercel — download & sharci kaliya

Milkiiluhu wuxuu oggolaaday in Vercel mar kale deployment sameeyo, laakiin
**kaliya** bog static ah:

- Faylashu waxay ku jiraan `website/`: `index.html`, `website/privacy.html`,
  `website/terms.html`, CSS iyo sawirrada astaanta.
- `vercel.json` wuxuu Vercel u dejiyaa Framework Preset **Other**
  (`framework: null`), `installCommand: ""`, `buildCommand: ""` iyo
  `outputDirectory: "website"`. Sidaas darteed Vercel ma wadi karo
  `package.json`-ka `build` script-kiisa Android, mana dhisi karo Expo web.
- Bogga hore wuxuu dadka u diraa APK-ga GitHub Actions iyo macluumaad run ah
  oo iPhone ah. Ma laha lesson player, account login, form ama JavaScript.
- URL-yada dadweynaha ee production waa
  `https://babelish.vercel.app/privacy` iyo
  `https://babelish.vercel.app/terms`.

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
internet ka furan — xitaa haddii app-ku web app lahayn. Nuqulka rasmiga ah
wuxuu ku jiraa `docs/PRIVACY.md`, nuqulka static ee dadweynuhuna waa
`website/privacy.html`. Store-ka ku qor URL-ka production ee la xaqiijiyay:
`https://babelish.vercel.app/privacy` (Terms:
`https://babelish.vercel.app/terms`). Ha isticmaalin PR preview URL
ku-meelgaar ah, hana u malayn in boggaas app-ku browser-ka ku shaqeeyo —
waa sharci/download kaliya.

---

## 🇬🇧 English

Babelish is **native-only**: Android (`.apk` direct-install, `.aab` for
Google Play) and iPhone (iOS). The Expo web target was removed at the owner's
request — `app.json` declares `platforms: ["android", "ios"]`, and
`npm run check:release` fails if web dependencies, scripts, or a `web`
section ever comes back, or if `vercel.json` points anywhere besides the
exact static download/legal contract below (see `tests/nativeOnly.test.ts`).

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

### Static Vercel download/legal page

The owner later approved one narrow exception to “no Vercel deployment”: a
**static download/legal page**. It is not a web version of Babelish and it
cannot run lessons or accounts.

- Source/output directory: `website/` (`index.html`, `website/privacy.html`,
  `website/terms.html`, CSS, and brand images only; no JavaScript).
- `vercel.json` is pinned to Framework Preset **Other** (`framework: null`),
  `installCommand: ""`, `buildCommand: ""`, `outputDirectory: "website"`,
  clean URLs, Git deployments enabled, and a fixed set of security headers.
  Empty install/build commands stop Vercel from falling back to
  `package.json`'s Android `build` script.
- The home page links Android users to the real GitHub Actions APK artifact
  and says plainly that a physical iPhone still needs Apple Developer +
  TestFlight/App Store. It must never present the unsigned simulator build as
  an iPhone download.
- Verified production legal URLs are
  `https://babelish.vercel.app/privacy` and
  `https://babelish.vercel.app/terms`. Store consoles should use those,
  never an ephemeral PR preview URL.

### What was removed (web)

- The Vercel **Expo web build config** and `assets/favicon.png`. A temporary
  disable-only kill switch was used during the native-only conversion; it has
  now been replaced by the exact static download/legal contract above. Vercel
  still never builds or exports the Expo app for a browser.
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
  one even for native-only apps). The source policy is `docs/PRIVACY.md`;
  the public static copy is `website/privacy.html`, served at
  `https://babelish.vercel.app/privacy` (terms:
  `https://babelish.vercel.app/terms`). When legal copy changes, update
  the in-app route, docs, and static page together; see
  `docs/STORE_RELEASE.md`.
