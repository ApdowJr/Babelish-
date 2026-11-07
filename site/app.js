/* ==========================================================================
   Babelish landing page — behaviour
   --------------------------------------------------------------------------
   Small jobs, no dependencies, no network calls except an optional check
   that the APK link actually has something behind it:

     1. language   English / Somali, remembered in localStorage
     2. theme      light / dark, following the OS until the learner chooses
     3. honesty    if no APK is published, say so instead of handing out a
                   dead download link
     4. motion     scroll reveals, count-up stats, 3D tilt zones, the
                   how-it-works auto-advance — all IntersectionObserver /
                   class toggles, all skipped under prefers-reduced-motion

   The deployed site runs a strict CSP (style-src 'self'), so this script
   never writes inline styles: every visual state is a class or an
   attribute the stylesheet reacts to. With JavaScript off the page is the
   English version, the CSS still follows the OS colour scheme, and every
   link works.
   ========================================================================== */

(function () {
  'use strict';

  var REPO = 'ApdowJr/Babelish-';
  var APK_URL = 'https://github.com/' + REPO + '/releases/latest/download/babelish.apk';
  var RELEASES_URL = 'https://github.com/' + REPO + '/releases';
  var LANG_KEY = 'babelish-lang';
  var THEME_KEY = 'babelish-theme';

  /* ---------- copy ---------- */

  var strings = {
    en: {
      'a11y.skip': 'Skip to content',
      'a11y.theme': 'Switch theme',
      'a11y.menu': 'Menu',
      'a11y.buildCommands': 'Commands for building the Android APK',
      'a11y.demoGroup': 'Choose a demo screen',
      'a11y.demo1': '01: Pick a language',
      'a11y.demo2': '02: Practise out loud',
      'a11y.demo3': '03: Track your progress',
      'nav.features': 'Features',
      'nav.how': 'How it works',
      'nav.download': 'Download',
      'nav.faq': 'FAQ',
      'nav.get': 'Get the app',
      'hero.badge': 'Free · no ads · open source',
      'hero.title': 'Learn to <em>actually speak</em> a new language.',
      'hero.lede':
        'Babelish is a free language tutor for Android — 25 languages, real lessons, voice practice from the first day, and a coach that keeps teaching when the internet does not.',
      'hero.cta': 'Download for Android',
      'hero.secondary': 'See how it works',
      'hero.meta': 'APK · Android 7+',
      'hero.releases': 'all releases',
      'hero.notPublished':
        'No APK has been published yet — the release build is one workflow run away. See “Where is the Play Store listing?” below.',
      'hero.point1': 'No account needed to start',
      'hero.point2': 'Works offline',
      'hero.point3': 'Voice practice on demand',
      'hero.mock':
        "Illustrative previews inspired by Babelish. The app's appearance may differ.",
      'stats.languages': 'languages',
      'stats.chapters': 'chapters',
      'stats.lessons': 'lessons',
      'stats.exercises': 'exercises',
      'stats.words': 'starter words',
      'stats.note': 'All bundled with the app. Every lesson is playable on the free plan, offline.',
      'features.eyebrow': 'WHY BABELISH',
      'features.title': 'A tutor that tells you the truth',
      'features.lede':
        'No fake “AI” badges, no invented fluency scores, no streak guilt. The app shows what it can do and says so when it cannot.',
      'f1.title': 'A tutor, not a phrasebook',
      'f1.body':
        'Conversations in your target language, corrected gently. Your tutor knows your goals, your job and what you struggle with — because you told it.',
      'f2.title': 'Speak from the first day',
      'f2.body':
        'Say a phrase and see which words match when speech recognition is available. The score compares text; it does not claim to measure your pronunciation.',
      'f3.title': 'Works without a connection',
      'f3.body':
        'Courses, review and the phrasebook are bundled with the app. Lessons still open offline; voice playback uses the voices available on your device.',
      'f4.title': 'Honest by design',
      'f4.body':
        'When the model is unreachable the app says “bundled coach”, not “AI”. When there is not enough data for a skill it says “not enough yet” instead of drawing a bar.',
      'f5.title': 'Your data stays yours',
      'f5.body':
        'No ads, no third-party analytics, no brokers. Progress lives on your device, syncs only when you sign in, and can be exported or deleted in two taps.',
      'f6.title': 'Dark mode that is actually dark',
      'f6.body':
        'A full night palette for every screen, with contrast checked against WCAG AA — not a filter over the day theme.',
      'caps.label': 'Everything in one app',
      'caps.1t': 'Full starter courses',
      'caps.1s': '25 languages, offline',
      'caps.2t': 'Word-by-word scoring',
      'caps.2s': 'no invented fluency',
      'caps.3t': 'Slow playback',
      'caps.3s': 'when a phrase will not stick',
      'caps.4t': 'Phrasebook',
      'caps.4s': 'real situations, ready',
      'caps.5t': 'Spaced review',
      'caps.5s': 'the words that matter',
      'caps.6t': 'Streak calendar',
      'caps.6s': 'a mirror, not a debt',
      'caps.7t': 'Data export',
      'caps.7s': 'yours, in two taps',
      'caps.8t': 'Open tutor',
      'caps.8s': 'host it yourself',
      'how.eyebrow': 'HOW IT WORKS',
      'how.title': 'Three taps to a conversation',
      'how.hint': 'Choose a step to explore how Babelish works.',
      'how.pause': 'Pause demo',
      'how.play': 'Play demo',
      'how.s1.title': 'Pick a language',
      'how.s1.body':
        'Twenty-five languages, from Spanish to Somali, with starter courses and a phrasebook for real situations.',
      'how.s2.title': 'Practise out loud',
      'how.s2.body':
        'Short exercises, then the Speak tab: listen, repeat, and read the word-by-word match. Slow playback when a phrase will not stick.',
      'how.s3.title': 'Watch the streak grow',
      'how.s3.body':
        'A six-week calendar that shows the days you actually practised, and which skill is holding you back — with the sample count behind every number.',
      'how.quote':
        '“Missing a day never costs you anything. The streak is a mirror, not a debt.”',
      'how.quoteBy': '— the design note behind the streak',
      'how.cta': 'Get it on your phone',
      'dl.eyebrow': 'GET BABELISH',
      'dl.title': 'Install the Android app',
      'dl.body':
        'One signed APK, built from this repository by its own workflow. No account, no subscription, no ads.',
      'dl.cta': 'Download the APK',
      'dl.secondary': 'Release notes',
      'dl.step1': 'Tap the download and open the file.',
      'dl.step2': 'Android asks once: allow installs from this source (your browser).',
      'dl.step3': 'Open Babelish. Pick a language and start.',
      'dl.version': 'Version',
      'dl.platform': 'Platform',
      'dl.size': 'Size',
      'dl.price': 'Price',
      'dl.free': 'Free',
      'dl.helpTitle': '“App not installed as package appears to be invalid”?',
      'dl.helpBody': "That is Android's installer talking, not the app. In this order:",
      'dl.help1':
        'Uninstall an older Babelish first (Settings → Apps → Babelish → Uninstall) — a copy signed by a different key can never be replaced.',
      'dl.help2':
        'Download again. A partial download is the most common cause; the file is about 48 MB.',
      'dl.help3':
        'Open the file from Chrome or Files, not from inside a ZIP viewer or a chat preview.',
      'dl.helpChecksum':
        'The release also publishes babelish.apk.sha256, so you can check the download: sha256sum babelish.apk.',
      'dl.buildTitle': 'Prefer to build it yourself?',
      'dl.buildBody':
        "The APK is produced by the repository's own GitHub Actions workflow, from the same commit as the tag. No binaries are committed.",
      'dl.buildLink': 'Watch the Android build workflow',
      'faq.eyebrow': 'QUESTIONS',
      'faq.title': 'Straight answers',
      'faq.q1': 'Is it really free?',
      'faq.a1':
        'Yes. No ads, no subscription, no “premium” wall in front of the lessons. The tutor server runs on open-weight models with free endpoints, and everything else — courses, review, phrasebook, voices — runs on your device.',
      'faq.q2': 'Do I need an account?',
      'faq.a2':
        'No. A guest profile keeps your progress on the device. Signing in is only for syncing between devices and keeping your streak if you lose the phone.',
      'faq.q3': 'What happens to my microphone audio?',
      'faq.a3':
        'When you start voice practice, the microphone records until you stop it. If speech recognition is configured, audio is sent for transcription; word matches compare the transcript with the target phrase.',
      'faq.q4': 'Which languages are included?',
      'faq.a4':
        'Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Polish, Russian, Ukrainian, Greek, Turkish, Arabic, Hebrew, Persian, Hindi, Bengali, Mandarin, Japanese, Korean, Vietnamese, Thai, Indonesian, Swahili and Somali.',
      'faq.q5': 'Where is the Play Store listing?',
      'faq.a5':
        'Not live yet. The store package, version code, permissions and artwork are ready, but publishing needs a signed build and a review. Until then the APK here is the same app, signed with a test key and installed directly.',
      'faq.q6': 'Is it safe to install an APK?',
      'faq.a6':
        'This one is built in public by GitHub Actions from the source in this repository — you can read the workflow and the commit it ran on. Android will still warn you, because any app from outside the Play Store does.',
      'faq.stuck': 'Still stuck?',
      'faq.stuckCta': 'See the download help',
      'close.title': 'Your first conversation is one tap away.',
      'close.body': 'Free, offline-friendly, and honest about what it can do.',
      'close.cta': 'Download for Android',
      'footer.tagline': 'A free language tutor you can host yourself. Built in the open.',
      'footer.app': 'App',
      'footer.legal': 'Legal',
      'footer.privacy': 'Privacy policy',
      'footer.terms': 'Terms of service',
      'footer.source': 'Source',
      'footer.releases': 'Releases',
      'footer.docs': 'Documentation',
      'footer.rights': 'Babelish',
      'footer.made': 'no trackers on this page',
      'footer.note': 'This page loads no fonts, scripts or analytics from third parties.',
    },

    so: {
      'a11y.skip': 'U bood nuxurka',
      'a11y.theme': 'Beddel muuqaalka',
      'a11y.menu': 'Liiska',
      'a11y.buildCommands': 'Amarrada lagu dhisayo APK-ga Android',
      'a11y.demoGroup': 'Dooro shaashadda tusaalaha',
      'a11y.demo1': '01: Dooro luqad',
      'a11y.demo2': '02: Ku tababar cod',
      'a11y.demo3': '03: La soco horumarka',
      'nav.features': 'Astaamaha',
      'nav.how': 'Sida ay u shaqeyso',
      'nav.download': 'Soo dejiso',
      'nav.faq': "Su'aalo",
      'nav.get': 'Hel abka',
      'hero.badge': 'Bilaash · xayeysiis ma leh · furan',
      'hero.title': 'Baro inaad <em>dhab ahaan u hadasho</em> luqad cusub.',
      'hero.lede':
        'Babelish waa macalin luqadeed bilaash ah oo Android — 25 luqadood, casharro dhab ah, tababar cod maalinta koowaad, iyo tababare sii wada waxbaridda xitaa marka internet-ku maqan yahay.',
      'hero.cta': 'Soo dejiso Android',
      'hero.secondary': 'Arag sida ay u shaqeyso',
      'hero.meta': 'APK · Android 7+',
      'hero.releases': 'dhammaan sii-dejinta',
      'hero.notPublished':
        'Weli APK lama daabicin — dhiska sii-dejinta waa hal socod-checklist uun. Hoos ka eeg “Meesha liiska Play Store?”.',
      'hero.point1': 'Akoon looma baahna inaad bilowdo',
      'hero.point2': 'Waxay shaqaysaa offline',
      'hero.point3': 'Tababar cod markaad rabto',
      'hero.mock':
        'Kuwani waa tusaalooyin laga sameeyay Babelish; muuqaalka abka dhabta ah wuu ka duwanaan karaa.',
      'stats.languages': 'luqado',
      'stats.chapters': 'cutubyo',
      'stats.lessons': 'casharro',
      'stats.exercises': 'layliyo',
      'stats.words': 'erey bilow',
      'stats.note':
        'Dhammaan waxay la socdaan abka. Cashar kastaa waa lagu ciyaari karaa qorshaha bilaashka, offline.',
      'features.eyebrow': 'SABABTA BABELISH',
      'features.title': 'Macalin kuu sheega runta',
      'features.lede':
        'Ma jiro calaamad “AI” khiyaano ah, ma jiro dhibco faseexnimo la alifay, mana jiro dembi streak. Abku wuxuu muujiyaa waxa uu qaban karo oo wuxuu yiraahdaa marka uusan awoodin.',
      'f1.title': 'Macalin, ma aha buug weedho',
      'f1.body':
        'Wada-hadal luqadda bartilmaameedka, si tartiib ah loo saxay. Macalinkaagu wuu garanayaa yoolalkaaga, shaqadaada iyo waxa ku adag — maxaa yeelay adigaa u sheegay.',
      'f2.title': 'Hadal maalinta koowaad',
      'f2.body':
        'Dheh weedha oo arag ereyada iswaafaqay marka aqoonsiga codku shaqaynayo. Dhibcuhu qoraalka ayay isbarbardhigaan, mana cabbiraan ku dhawaaqista.',
      'f3.title': "Waxay shaqaysaa internet la'aan",
      'f3.body':
        'Koorsooyinka, dib-u-eegista iyo buugga weedhuhu waxay ku jiraan abka. Casharradu internet la’aan way furmaan; codkuna wuxuu ku xiran yahay codadka aaladdaada.',
      'f4.title': 'Daacad naqshad ahaan',
      'f4.body':
        'Marka model-ku aan la gaadhi karin abku wuxuu yiraahdaa “tababare ku jira”, ma aha “AI”. Marka xog ku filan aanay jirin wuxuu yiraahdaa “weli kuma filna” halkii uu xariiq sawiri lahaa.',
      'f5.title': 'Xogtaadu adigaa iska leh',
      'f5.body':
        'Xayeysiis ma leh, analytics shirkad saddexaad ma leh, dilaaliin ma leh. Horumarku wuxuu ku nool yahay aaladdaada, wuxuu isku darayaa kaliya markaad gasho, waana la dhoofin karaa ama la tirtiri karaa laba taabo.',
      'f6.title': 'Muuqaal mugdi oo run ahaan mugdi ah',
      'f6.body':
        'Palette habeen buuxa shaashad kasta, oo isbarbardhigga lagu hubiyay WCAG AA — ma aha filter lagu saaray muuqaalka maalinta.',
      'caps.label': 'Dhammaan hal ab oo gudahiis',
      'caps.1t': 'Koorsooyin bilow buuxda',
      'caps.1s': '25 luqadood, offline',
      'caps.2t': 'Dhibco eray-eray',
      'caps.2s': 'ma jiro faseexnimo la alifay',
      'caps.3t': 'Daahfurtid tartiib ah',
      'caps.3s': 'marka weedhu ku adag tahay',
      'caps.4t': 'Buuggii weedhaha',
      'caps.4s': 'xaalado dhab ah, diyaar',
      'caps.5t': 'Dib-u-eegis joogto ah',
      'caps.5s': 'erayga muhiimka ah',
      'caps.6t': 'Kalandar streak',
      'caps.6s': 'muraayad, ma aha deyn',
      'caps.7t': 'Dhoofinta xogta',
      'caps.7s': 'adigaaga, laba taabo',
      'caps.8t': 'Macalin furan',
      'caps.8s': 'adigu martigeli',
      'how.eyebrow': 'SIDA AY U SHAQEYSO',
      'how.title': 'Saddex taabo ilaa wada-hadal',
      'how.hint': 'Dooro tallaabo si aad u aragto sida Babelish u shaqayso.',
      'how.pause': 'Jooji tusaalaha',
      'how.play': 'Dib u bilow tusaalaha',
      'how.s1.title': 'Dooro luqad',
      'how.s1.body':
        'Shan iyo labaatan luqadood, laga bilaabo Isbaanish ilaa Soomaali, oo leh koorsooyin bilow ah iyo buug weedho xaalado dhab ah.',
      'how.s2.title': 'Ku tababar cod dheer',
      'how.s2.body':
        'Layliyo gaagaaban, ka dib tababarka Speak: dhegayso, ku celi, oo akhri iswaafaqa eray kasta. Daahfur tartiib marka weedhu ku adag tahay.',
      'how.s3.title': 'Daawasho streak-ka oo koraya',
      'how.s3.body':
        'Kalandar lix toddobaad ah oo muujinaya maalmaha aad dhab ahaan tababartay, iyo awoodda ku hakinaysa — iyo tirada muunadaha ka dambeeya lambar kasta.',
      'how.quote':
        '“Maalin seegista waligeed waxba kuguma kacdo. Streak-ku waa muraayad, ma aha deyn.”',
      'how.quoteBy': '— qoraalka naqshadeynta streak-ka',
      'how.cta': 'Ku hel taleefankaaga',
      'dl.eyebrow': 'HEL BABELISH',
      'dl.title': 'Ku rakib abka Android',
      'dl.body':
        'Hal APK la saxeexay oo laga dhisay kaydkan iyada oo adeegsanaysa workflow-giisa. Akoon ma leh, rukhsad ma leh, xayeysiis ma leh.',
      'dl.cta': 'Soo dejiso APK',
      'dl.secondary': 'Qoraalka sii-dejinta',
      'dl.step1': 'Taabo soo-dejinta oo fur faylka.',
      'dl.step2': 'Android hal mar ayuu weyddiinayaa: u ogolow rakibaadda ishaan (browser-kaaga).',
      'dl.step3': 'Fur Babelish. Dooro luqad oo bilow.',
      'dl.version': 'Nooca',
      'dl.platform': 'Madal',
      'dl.size': 'Cabbirka',
      'dl.price': 'Qiimaha',
      'dl.free': 'Bilaash',
      'dl.helpTitle': '“App not installed as package appears to be invalid”?',
      'dl.helpBody': 'Waa installer-ka Android oo hadlaya, ma aha app-ka. Sidan u raac:',
      'dl.help1':
        'Marka hore ka saar Babelish-kii hore (Settings → Apps → Babelish → Uninstall) — nuqul fure kale lagu saxeexay waligeed lama beddeli karo.',
      'dl.help2': 'Mar kale soo deji. Soo-dejin aan dhammaad lahayn ayaa sababta ugu badan; faylku waa ~48 MB.',
      'dl.help3': 'Fur faylka Chrome ama Files, ma aha ZIP viewer ama chat preview.',
      'dl.helpChecksum':
        'Release-ka waxaa sidoo kale ku jira babelish.apk.sha256, si aad u hubiso soo-dejinta: sha256sum babelish.apk.',
      'dl.buildTitle': 'Ma jeceshahay inaad adigu dhisto?',
      'dl.buildBody':
        'APK waxaa soo saara workflow-ga GitHub Actions ee kaydka, isla commit-ka tag-ga. Binary-yo lama kaydiyo.',
      'dl.buildLink': 'Daawasho workflow-ga dhiska Android',
      'faq.eyebrow': "SU'AALO",
      'faq.title': 'Jawaabo toos ah',
      'faq.q1': 'Runtii ma bilaash baa?',
      'faq.a1':
        'Haa. Xayeysiis ma leh, rukhsad ma leh, derbi “premium” hortiisa casharrada ma leh. Server-ka macalinka wuxuu ku shaqeeyaa model-biyo furan oo leh dhammaad bilaash, wax kasta oo kale — casharro, dib-u-eegis, buug weedho, codad — waxay ku shaqeeyaan aaladdaada.',
      'faq.q2': 'Ma u baahanahay akoon?',
      'faq.a2':
        'Maya. Profayl marti ah ayaa horumarkaaga ku haynaya aaladda. Gelista waxay u tahay kaliya isku-dubaridka aaladaha iyo in streak-gaagu sii socdo haddii taleefankaagu lumo.',
      'faq.q3': 'Maxaa ku dhacaya codka makarafoonkayga?',
      'faq.a3':
        'Markaad bilowdo tababarka codka, makarafoonku wuu duubayaa ilaa aad joojiso. Haddii aqoonsiga codka la habeeyey, codka waxaa loo diraa qoraal-u-rogid; ereyada ayaa la isbarbardhigaa.',
      'faq.q4': 'Luqaddee ayaa ku jira?',
      'faq.a4':
        'Isbaanish, Faransiis, Jarmal, Talyaani, Boortaqiis, Hollandays, Iswiidhish, Boolish, Ruush, Yukreeniyaan, Giriig, Turkiga, Carabi, Cibraani, Faarisi, Hindi, Bengal, Shiinaha Mandarin, Jabbaan, Kuuriya, Fiyetnaam, Tayaland, Indoneesiya, Sawaaxili iyo Soomaali.',
      'faq.q5': 'Meesha liiska Play Store?',
      'faq.a5':
        'Weli ma socoto. Xirmada dukaanka, koodhka nooca, ogolaanshaha iyo sawirrada waa diyaar, laakiin daabacaaddu waxay u baahan tahay dhis la saxeexay iyo dib-u-eegis. Intaas ka hor, APK-ga halkan waa isla abkaas, lagu saxeexay fure tijaabo oo si toos ah loo rakibay.',
      'faq.q6': 'Ma ammaan baa in la rakibo APK?',
      'faq.a6':
        'Kanu waxaa si furan u dhisay GitHub Actions isagoo ka socda koodhka kaydkan — waad akhriyi kartaa workflow-ga iyo commit-ka uu ku socday. Android weli wuu ku digayaa, sababtoo ah ab kasta oo ka baxsan Play Store wuu digaa.',
      'faq.stuck': 'Weli dhibaato ma leedahay?',
      'faq.stuckCta': 'Eeg caawimaha soo-dejinta',
      'close.title': 'Wada-hadalkaaga koowaad waa hal taabo.',
      'close.body': 'Bilaash, offline-saaxiib, oo daacad ah waxa uu qaban karo.',
      'close.cta': 'Soo dejiso Android',
      'footer.tagline': 'Macalin luqadeed bilaash ah oo adigu martigelin karto. Loo dhisay si furan.',
      'footer.app': 'Abka',
      'footer.legal': 'Sharciga',
      'footer.privacy': 'Xeerka asturnaanta',
      'footer.terms': 'Shuruudaha adeegga',
      'footer.source': 'Isha',
      'footer.releases': 'Sii-dejinta',
      'footer.docs': 'Dukumeenti',
      'footer.rights': 'Babelish',
      'footer.made': 'wax raadraac ah boggan kuma jiraan',
      'footer.note':
        'Boggan kama soo dejisanayso font, script ama analytics shirkad saddexaad.',
    },
  };

  var META = {
    en: {
      title: 'Babelish — learn 25 languages free, with a tutor you can host yourself',
      description:
        'Babelish is a free language tutor for 25 languages on Android: real lessons, voice practice, an honest coach that keeps working offline. Download the Android APK.',
    },
    so: {
      title: 'Babelish — baro 25 luqadood bilaash, macalin adigu martigelin karto',
      description:
        'Babelish waa macalin luqadeed bilaash ah oo 25 luqadood, Android: casharro dhab ah, tababar cod, tababare daacad ah oo offline shaqeeya. Soo dejiso APK-ga Android.',
    },
  };

  var $ = function (selector, root) {
    return (root || document).querySelector(selector);
  };
  var $$ = function (selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  };

  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
      return value;
    } catch (error) {
      return null; // private mode, disabled storage — the page still works
    }
  }

  function prefersReducedMotion() {
    return !!(
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  function finePointer() {
    return !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);
  }

  /* ---------- language ---------- */

  // Legal pages share this script but have their own English copy and metadata.
  var landingPage = !!$('#apk-link');
  var lang = store(LANG_KEY);
  if (!strings[lang]) lang = (navigator.language || 'en').toLowerCase().indexOf('so') === 0 ? 'so' : 'en';

  function applyLanguage(next) {
    lang = strings[next] ? next : 'en';
    store(LANG_KEY, lang);

    var copy = strings[lang];
    $$('[data-i18n]').forEach(function (node) {
      var value = copy[node.getAttribute('data-i18n')];
      if (value === undefined) return;
      if (value.indexOf('<') !== -1) node.innerHTML = value; // our own strings only
      else node.textContent = value;
    });

    $$('[data-i18n-aria-label]').forEach(function (node) {
      var value = copy[node.getAttribute('data-i18n-aria-label')];
      if (value) node.setAttribute('aria-label', value);
    });

    $$('.lang-btn').forEach(function (button) {
      var on = button.getAttribute('data-lang') === lang;
      button.classList.toggle('is-on', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    document.documentElement.lang = lang;
    document.title = META[lang].title;
    var description = $('meta[name="description"]');
    if (description) description.setAttribute('content', META[lang].description);
  }

  $$('.lang-btn').forEach(function (button) {
    button.addEventListener('click', function () {
      applyLanguage(button.getAttribute('data-lang'));
    });
  });

  if (landingPage) applyLanguage(lang);

  /* ---------- theme ---------- */

  function currentTheme() {
    var explicit = document.documentElement.getAttribute('data-theme');
    if (explicit === 'light' || explicit === 'dark') return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    store(THEME_KEY, theme);
    $$('meta[name="theme-color"]').forEach(function (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#080B1F' : '#F4F6FE');
      meta.removeAttribute('media');
    });
    var toggle = $('#theme-toggle');
    if (toggle) toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
  }

  // A stored choice wins; otherwise the CSS media query is already in charge,
  // so we only write the attribute when the learner actually picks a side.
  var savedTheme = store(THEME_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') applyTheme(savedTheme);

  var toggle = $('#theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
    toggle.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
    // If the visitor has not chosen a theme, keep the toggle's state in sync
    // with an OS theme change as well as the CSS media query.
    if (window.matchMedia) {
      var colourScheme = window.matchMedia('(prefers-color-scheme: dark)');
      if (colourScheme.addEventListener) {
        colourScheme.addEventListener('change', function () {
          if (!store(THEME_KEY)) {
            toggle.setAttribute('aria-pressed', currentTheme() === 'dark' ? 'true' : 'false');
          }
        });
      }
    }
  }

  /* ---------- scroll progress + sticky header edge ----------
     The progress bar itself is a CSS scroll-driven animation; JS only marks
     the header state. */

  var header = $('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- mobile menu ---------- */

  var menuBtn = $('#menu-btn');
  if (menuBtn && header) {
    function closeMenu() {
      menuBtn.setAttribute('aria-expanded', 'false');
      header.classList.remove('menu-open');
    }
    menuBtn.addEventListener('click', function () {
      var open = menuBtn.getAttribute('aria-expanded') === 'true';
      menuBtn.setAttribute('aria-expanded', open ? 'false' : 'true');
      header.classList.toggle('menu-open', !open);
    });
    $$('#nav-links a').forEach(function (link) {
      link.addEventListener('click', closeMenu);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menuBtn.focus();
      }
    });
    document.addEventListener('click', function (event) {
      if (!header.contains(event.target)) closeMenu();
    });
  }

  /* ---------- scroll reveals ----------
     theme-boot.js marked <html> with .js before first paint, so [data-reveal]
     elements start hidden only when this script is present. Without
     IntersectionObserver — or with reduced motion — everything shows at once. */

  var revealEls = $$('[data-reveal]');
  if (revealEls.length) {
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      revealEls.forEach(function (el) {
        el.classList.add('is-in');
      });
    } else {
      var revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in');
              revealObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
      );
      revealEls.forEach(function (el) {
        revealObserver.observe(el);
      });
    }
  }

  /* ---------- count-up stats ---------- */

  function countUp(node) {
    var target = parseInt(node.textContent.replace(/[^0-9]/g, ''), 10);
    if (!target || prefersReducedMotion() || !window.requestAnimationFrame) return;
    var duration = 1200;
    var start = null;
    node.textContent = '0';
    window.requestAnimationFrame(function frame(timestamp) {
      if (start === null) start = timestamp;
      var t = Math.min(1, (timestamp - start) / duration);
      var eased = 1 - Math.pow(1 - t, 3);
      node.textContent = Math.round(target * eased).toLocaleString('en-US');
      if (t < 1) window.requestAnimationFrame(frame);
    });
  }

  var stats = $$('.stat b');
  if (stats.length && 'IntersectionObserver' in window && !prefersReducedMotion()) {
    var statObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            statObserver.unobserve(entry.target);
            countUp(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    stats.forEach(function (el) {
      statObserver.observe(el);
    });
  }

  /* ---------- active nav highlight ---------- */

  var navLinks = $$('.nav-links a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    var linkById = {};
    navLinks.forEach(function (a) {
      var id = (a.getAttribute('href') || '').slice(1);
      if (id) linkById[id] = a;
    });
    var sections = Object.keys(linkById)
      .map(function (id) {
        return document.getElementById(id);
      })
      .filter(Boolean);
    if (sections.length) {
      var navObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            navLinks.forEach(function (a) {
              a.classList.remove('is-active');
            });
            linkById[entry.target.id].classList.add('is-active');
          });
        },
        { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
      );
      sections.forEach(function (section) {
        navObserver.observe(section);
      });
    }
  }

  /* ---------- hero 3D tilt (zone-based, CSP-safe) ----------
     The pointer position maps to one of nine zones; the stylesheet holds the
     per-zone transform and a springy transition does the smoothing. No inline
     styles are written (the deployed CSP forbids them). */

  var tilt = $('#hero-tilt');
  if (tilt && finePointer() && !prefersReducedMotion()) {
    var heroEl = tilt.closest('.hero');
    var last = '';
    heroEl.addEventListener(
      'pointermove',
      function (event) {
        var rect = heroEl.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width; // 0..1
        var y = (event.clientY - rect.top) / rect.height;
        var zone =
          (y < 1 / 3 ? 't' : y < 2 / 3 ? 'm' : 'b') +
          (x < 1 / 3 ? 'l' : x < 2 / 3 ? 'c' : 'r');
        if (zone === last) return;
        last = zone;
        tilt.setAttribute('data-tilt', zone);
      },
      { passive: true }
    );
    heroEl.addEventListener('pointerleave', function () {
      last = '';
      tilt.removeAttribute('data-tilt');
    });
  }

  /* ---------- how-it-works: interactive screens ----------
     One state drives both the descriptive steps and the controls by the phone.
     A visible pause button gives visitors control; the timer and its progress
     bar pause together on hover, keyboard focus, an off-screen section, or a
     hidden tab. Reduced-motion visitors get manual navigation only. */

  var steps = $$('.how-step');
  var demoSteps = $$('.demo-step');
  var screens = $$('.how-stage .screen');
  var howSection = $('#how');
  var demoRegion = $('.how-grid');
  var demoControl = $('#demo-control');
  if (steps.length && screens.length) {
    var STEP_MS = 5600;
    var current = 0;
    var timer = null;
    var remaining = STEP_MS;
    var startedAt = 0;
    var userPaused = false;
    var hovered = false;
    var focused = false;
    var inView = !('IntersectionObserver' in window) || !howSection;

    function currentBar() {
      return steps[current].querySelector('.step-progress i');
    }

    function updateControl() {
      if (!demoControl) return;
      var key = userPaused ? 'how.play' : 'how.pause';
      demoControl.setAttribute('data-i18n', key);
      demoControl.textContent = strings[lang][key];
      demoControl.hidden = prefersReducedMotion();
    }

    function setStep(index) {
      current = index;
      remaining = STEP_MS;
      steps.forEach(function (button, j) {
        var on = j === index;
        button.disabled = false;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
        var bar = button.querySelector('.step-progress i');
        if (bar) {
          bar.classList.remove('is-running', 'is-paused');
          if (on && !prefersReducedMotion()) {
            void button.offsetWidth; // restart the CSS animation for this step
            bar.classList.add('is-running', 'is-paused');
          }
        }
      });
      demoSteps.forEach(function (button, j) {
        var on = j === index;
        button.classList.toggle('is-on', on);
        button.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      screens.forEach(function (screen, j) {
        screen.classList.toggle('is-active', j === index);
      });
    }

    function stopAuto() {
      if (timer !== null) {
        window.clearTimeout(timer);
        timer = null;
        remaining = Math.max(0, remaining - (Date.now() - startedAt));
      }
      var bar = currentBar();
      if (bar) bar.classList.add('is-paused');
    }

    function startAuto() {
      if (timer !== null || prefersReducedMotion() || userPaused || hovered || focused || !inView || document.hidden) return;
      var bar = currentBar();
      if (bar) bar.classList.remove('is-paused');
      startedAt = Date.now();
      timer = window.setTimeout(function () {
        timer = null;
        setStep((current + 1) % steps.length);
        startAuto();
      }, remaining);
    }

    function syncAuto() {
      if (prefersReducedMotion() || userPaused || hovered || focused || !inView || document.hidden) stopAuto();
      else startAuto();
    }

    steps.concat(demoSteps).forEach(function (button) {
      button.addEventListener('click', function () {
        var next = parseInt(button.getAttribute('data-step'), 10);
        if (!Number.isFinite(next) || next < 0 || next >= steps.length) return;
        stopAuto();
        setStep(next);
        syncAuto();
      });
    });

    if (demoControl) {
      demoControl.addEventListener('click', function () {
        userPaused = !userPaused;
        updateControl();
        syncAuto();
      });
    }

    if (demoRegion) {
      // Touchscreens can synthesise a sticky mouseenter, so hover pause is
      // registered only on devices that genuinely support hovering.
      if (window.matchMedia && window.matchMedia('(hover: hover)').matches) {
        demoRegion.addEventListener('mouseenter', function () {
          hovered = true;
          syncAuto();
        });
        demoRegion.addEventListener('mouseleave', function () {
          hovered = false;
          syncAuto();
        });
      }
      demoRegion.addEventListener('focusin', function () {
        focused = true;
        syncAuto();
      });
      demoRegion.addEventListener('focusout', function (event) {
        focused = demoRegion.contains(event.relatedTarget);
        syncAuto();
      });
    }

    document.addEventListener('visibilitychange', syncAuto);
    if ('IntersectionObserver' in window && howSection) {
      var demoObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.target === howSection) {
            inView = entry.isIntersecting;
            syncAuto();
          }
        });
      }, { threshold: 0.01 });
      demoObserver.observe(howSection);
    }
    if (window.matchMedia) {
      var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionPreference.addEventListener) {
        motionPreference.addEventListener('change', function () {
          stopAuto();
          setStep(current);
          updateControl();
          syncAuto();
        });
      }
    }

    setStep(0);
    updateControl();
    syncAuto();
  }

  /* ---------- honest download button ---------- */

  var note = $('#apk-note');
  var size = $('#apk-size');
  var metaSize = $('#meta-size');

  function prettySize(bytes) {
    if (!bytes || bytes < 1024) return null;
    var mb = bytes / (1024 * 1024);
    return '~' + Math.round(mb) + ' MB';
  }

  function markUnpublished() {
    if (note) note.hidden = false;
    $$('a[href="' + APK_URL + '"]').forEach(function (link) {
      link.setAttribute('href', RELEASES_URL);
    });
    if (size) size.textContent = '';
    if (metaSize) metaSize.textContent = '—';
  }

  // api.github.com sends CORS headers; the download URL does not. If the
  // network is unavailable we leave the page exactly as it is (optimistic,
  // because a working link is the common case once a release exists).
  if (landingPage && window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (response) {
        // A 404 means there is no latest release. A rate limit or temporary
        // GitHub failure says nothing about whether the APK exists.
        if (response.status === 404) markUnpublished();
        if (!response.ok) return null;
        return response.json();
      })
      .then(function (release) {
        if (!release) return;
        var asset = (release.assets || []).filter(function (candidate) {
          return candidate.name === 'babelish.apk';
        })[0];
        if (!asset) {
          markUnpublished();
          return;
        }
        var label = prettySize(asset.size);
        if (label) {
          if (size) size.textContent = label;
          if (metaSize) metaSize.textContent = label;
        }
      })
      .catch(function () {
        /* offline or rate-limited: keep the optimistic page */
      });
  }

  /* ---------- footer year ---------- */

  var year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
})();
