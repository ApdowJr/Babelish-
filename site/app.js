/* ==========================================================================
   Babelish landing page — behaviour
   --------------------------------------------------------------------------
   Three small jobs, no dependencies, no network calls except an optional
   check that the APK link actually has something behind it:

     1. language   English / Somali, remembered in localStorage
     2. theme      light / dark, following the OS until the learner chooses
     3. honesty    if no APK is published, say so instead of handing out a
                   dead download link

   Everything is progressive: with JavaScript off the page is the English
   version, the CSS still follows the OS colour scheme, and every link works.
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
      'nav.features': 'Features',
      'nav.how': 'How it works',
      'nav.download': 'Download',
      'nav.faq': 'FAQ',
      'nav.get': 'Get the app',
      'hero.badge': 'Free · no ads · open source',
      'hero.title': 'Learn to <em>actually speak</em> a new language.',
      'hero.lede':
        'Babelish is a free language tutor for Android and iPhone — 25 languages, real lessons, voice practice from the first day, and a coach that keeps teaching when the internet does not.',
      'hero.cta': 'Download for Android',
      'hero.secondary': 'See how it works',
      'hero.meta': 'APK · Android 7+ ·',
      'hero.releases': 'all releases',
      'hero.iphone':
        'iPhone build: the project compiles for iOS, but Apple will only install it through TestFlight or the App Store — those need an Apple Developer account.',
      'hero.notPublished':
        'No APK has been published yet — the release build is one workflow run away. See “Where is the Play Store listing?” below.',
      'hero.point1': 'No account needed to start',
      'hero.point2': 'Works offline',
      'hero.point3': 'No recordings stored',
      'hero.mock':
        "Screens rebuilt from the app's own design tokens. Capture store screenshots from a real device — these are illustrations, not recordings of a session.",
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
        'Tap the orb, say the phrase, and see exactly which words matched — per word, not a made-up “fluency” number. Audio is transcribed on demand and never stored.',
      'f3.title': 'Works without a connection',
      'f3.body':
        'Courses, review, the phrasebook and device voices ship inside the app. On a plane, in a blackout, on a slow network — the lessons still open.',
      'f4.title': 'Honest by design',
      'f4.body':
        'When the model is unreachable the app says “bundled coach”, not “AI”. When there is not enough data for a skill it says “not enough yet” instead of drawing a bar.',
      'f5.title': 'Your data stays yours',
      'f5.body':
        'No ads, no third-party analytics, no brokers. Progress lives on your device, syncs only when you sign in, and can be exported or deleted in two taps.',
      'f6.title': 'Dark mode that is actually dark',
      'f6.body':
        'A full night palette for every screen, with contrast checked against WCAG AA — not a filter over the day theme.',
      'how.eyebrow': 'HOW IT WORKS',
      'how.title': 'Three taps to a conversation',
      'how.s1.title': 'Pick a language',
      'how.s1.body':
        'Twenty-four from Spanish to Swahili, each with a complete starter course and a phrasebook for real situations.',
      'how.s2.title': 'Practise out loud',
      'how.s2.body':
        'Short exercises, then the Speak tab: listen, repeat, and read the word-by-word match. Slow playback when a phrase will not stick.',
      'how.s3.title': 'Watch the streak grow',
      'how.s3.body':
        'A six-week calendar that shows the days you actually practised, and which skill is holding you back — with the sample count behind every number.',
      'how.quote':
        '“Missing a day never costs you anything. The streak is a mirror, not a debt.”',
      'how.quoteBy': '— the design note behind the streak',
      'dl.eyebrow': 'GET BABELISH',
      'dl.title': 'Install the Android app',
      'dl.body':
        'One signed APK, built from this repository by its own workflow, plus an iPhone build for anyone with an Apple Developer account. No account, no subscription, no ads.',
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
        'It is transcribed when you ask for a score and then discarded. Recordings are never saved to the device and never stored on a server. The microphone is only on while you are holding the button.',
      'faq.q4': 'Which languages are included?',
      'faq.a4':
        'Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Polish, Russian, Ukrainian, Greek, Turkish, Arabic, Hebrew, Persian, Hindi, Bengali, Mandarin, Japanese, Korean, Vietnamese, Thai, Indonesian, Swahili and Somali.',
      'faq.q7': 'Can I install it on an iPhone?',
      'faq.a7':
        'The app compiles for iOS, but Apple does not allow installing an app outside TestFlight or the App Store. Both need an Apple Developer account (US$99 a year), so for now the iPhone build is for testing — Android is the platform you can install today.',
      'faq.q5': 'Where is the Play Store listing?',
      'faq.a5':
        'Not live yet. The store package, version code, permissions and artwork are ready, but publishing needs a signed build and a review. Until then the APK here is the same app, signed with a test key and installed directly.',
      'faq.q6': 'Is it safe to install an APK?',
      'faq.a6':
        'This one is built in public by GitHub Actions from the source in this repository — you can read the workflow and the commit it ran on. Android will still warn you, because any app from outside the Play Store does.',
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
      'nav.features': 'Astaamaha',
      'nav.how': 'Sida ay u shaqeyso',
      'nav.download': 'Soo dejiso',
      'nav.faq': "Su'aalo",
      'nav.get': 'Hel abka',
      'hero.badge': 'Bilaash · xayeysiis ma leh · furan',
      'hero.title': 'Baro inaad <em>dhab ahaan u hadasho</em> luqad cusub.',
      'hero.lede':
        'Babelish waa macalin luqadeed bilaash ah oo Android iyo iPhone — 25 luqadood, casharro dhab ah, tababar cod maalinta koowaad, iyo tababare sii wada waxbaridda xitaa marka internet-ku maqan yahay.',
      'hero.cta': 'Soo dejiso Android',
      'hero.secondary': 'Arag sida ay u shaqeyso',
      'hero.meta': 'APK · Android 7+ ·',
      'hero.releases': 'dhammaan sii-dejinta',
      'hero.iphone':
        'Dhiska iPhone: mashruucu wuu u soo baxaa iOS, laakiin Apple waxay u ogolaataa kaliya TestFlight ama App Store — labaduba waxay u baahan yihiin akoon Apple Developer.',
      'hero.notPublished':
        'Weli APK lama daabicin — dhiska sii-dejinta waa hal socod-checklist uun. Hoos ka eeg “Meesha liiska Play Store?”.',
      'hero.point1': 'Akoon looma baahna inaad bilowdo',
      'hero.point2': 'Waxay shaqaysaa offline',
      'hero.point3': 'Ma kaydiyo duubitaanno',
      'hero.mock':
        'Shaashadaha waxaa laga dhisay calaamadaha naqshadda abka. Sawirrada dukaanka ka qaado taleefan dhab ah — kuwani waa tusaale, ma aha duubitaan.',
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
        'Taabo wareega, dheh weedha, oo arag erey kasta oo iswaafaqay — erey kasta, ma aha lambar “faseexnimo” la alifay. Codka waxaa la qoraa marka loo baahdo oo waligiis lama kaydiyo.',
      'f3.title': "Waxay shaqaysaa internet la'aan",
      'f3.body':
        'Casharrada, dib-u-eegista, buugga weedhaha iyo codadka aaladda waxay ku jiraan abka. Diyaarad, mugdi, ama internet gaabis ah — casharradu weli way furmaan.',
      'f4.title': 'Daacad naqshad ahaan',
      'f4.body':
        'Marka model-ku aan la gaadhi karin abku wuxuu yiraahdaa “tababare ku jira”, ma aha “AI”. Marka xog ku filan aanay jirin wuxuu yiraahdaa “weli kuma filna” halkii uu xariiq sawiri lahaa.',
      'f5.title': 'Xogtaadu adigaa iska leh',
      'f5.body':
        'Xayeysiis ma leh, analytics shirkad saddexaad ma leh, dilaaliin ma leh. Horumarku wuxuu ku nool yahay aaladdaada, wuxuu isku darayaa kaliya markaad gasho, waana la dhoofin karaa ama la tirtiri karaa laba taabo.',
      'f6.title': 'Muuqaal mugdi oo run ahaan mugdi ah',
      'f6.body':
        'Palette habeen buuxa shaashad kasta, oo isbarbardhigga lagu hubiyay WCAG AA — ma aha filter lagu saaray muuqaalka maalinta.',
      'how.eyebrow': 'SIDA AY U SHAQEYSO',
      'how.title': 'Saddex taabo ilaa wada-hadal',
      'how.s1.title': 'Dooro luqad',
      'how.s1.body':
        'Labaatan iyo afar luqadood laga bilaabo Isbaanish ilaa Sawaaxili, mid kastaa leh koorso bilow buuxda iyo buug weedho xaalado dhab ah.',
      'how.s2.title': 'Ku tababar cod dheer',
      'how.s2.body':
        'Layliyo gaagaaban, ka dib tababarka Speak: dhegayso, ku celi, oo akhri iswaafaqa eray kasta. Daahfur tartiib marka weedhu ku adag tahay.',
      'how.s3.title': 'Daawasho streak-ka oo koraya',
      'how.s3.body':
        'Kalandar lix toddobaad ah oo muujinaya maalmaha aad dhab ahaan tababartay, iyo awoodda ku hakinaysa — iyo tirada muunadaha ka dambeeya lambar kasta.',
      'how.quote':
        '“Maalin seegista waligeed waxba kuguma kacdo. Streak-ku waa muraayad, ma aha deyn.”',
      'how.quoteBy': '— qoraalka naqshadeynta streak-ka',
      'dl.eyebrow': 'HEL BABELISH',
      'dl.title': 'Ku rakib abka Android',
      'dl.body':
        'Hal APK la saxeexay oo laga dhisay kaydkan iyada oo adeegsanaysa workflow-giisa, iyo dhis iPhone oo loogu talagalay cid kasta oo leh akoon Apple Developer. Akoon ma leh, rukhsad ma leh, xayeysiis ma leh.',
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
        'Waa la qoraa markaad dhibco codsato, ka dibna waa la tuuraa. Duubitaannada waligood lama kaydiyo aaladda, lamana kaydiyo server. Makarafoonku wuxuu shaqeeyaa kaliya intaad badhanka hayso.',
      'faq.q4': 'Luqaddee ayaa ku jira?',
      'faq.a4':
        'Isbaanish, Faransiis, Jarmal, Talyaani, Boortaqiis, Hollandays, Iswiidhish, Boolish, Ruush, Yukreeniyaan, Giriig, Turkiga, Carabi, Cibraani, Faarisi, Hindi, Bengal, Shiinaha Mandarin, Jabbaan, Kuuriya, Fiyetnaam, Tayaland, Indoneesiya, Sawaaxili iyo Soomaali.',
      'faq.q7': 'Ma ku rakibi karaa iPhone?',
      'faq.a7':
        'Abku wuu u soo baxaa iOS, laakiin Apple ma ogola in ab lagu rakibo TestFlight ama App Store ka baxsan. Labaduba waxay u baahan yihiin akoon Apple Developer (US$99 sannadkii), marka hadda dhiska iPhone waa tijaabo — Android waa tan aad maanta rakibi karto.',
      'faq.q5': 'Meesha liiska Play Store?',
      'faq.a5':
        'Weli ma socoto. Xirmada dukaanka, koodhka nooca, ogolaanshaha iyo sawirrada waa diyaar, laakiin daabacaaddu waxay u baahan tahay dhis la saxeexay iyo dib-u-eegis. Intaas ka hor, APK-ga halkan waa isla abkaas, lagu saxeexay fure tijaabo oo si toos ah loo rakibay.',
      'faq.q6': 'Ma ammaan baa in la rakibo APK?',
      'faq.a6':
        'Kanu waxaa si furan u dhisay GitHub Actions isagoo ka socda koodhka kaydkan — waad akhriyi kartaa workflow-ga iyo commit-ka uu ku socday. Android weli wuu ku digayaa, sababtoo ah ab kasta oo ka baxsan Play Store wuu digaa.',
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
        'Babelish is a free language tutor for 25 languages on Android and iPhone: real lessons, voice practice, an honest coach that keeps working offline. Download the Android APK.',
    },
    so: {
      title: 'Babelish — baro 25 luqadood bilaash, macalin adigu martigelin karto',
      description:
        'Babelish waa macalin luqadeed bilaash ah oo 25 luqadood, Android iyo iPhone: casharro dhab ah, tababar cod, tababare daacad ah oo offline shaqeeya. Soo dejiso APK-ga Android.',
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

  /* ---------- language ---------- */

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

  applyLanguage(lang);

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
    var meta = $('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#101512' : '#0B3A2C');
    var toggle = $('#theme-toggle');
    if (toggle) {
      toggle.setAttribute(
        'aria-label',
        (strings[lang]['a11y.theme'] || 'Switch theme') + ' — ' + theme
      );
    }
  }

  // A stored choice wins; otherwise the CSS media query is already in charge,
  // so we only write the attribute when the learner actually picks a side.
  var savedTheme = store(THEME_KEY);
  if (savedTheme === 'light' || savedTheme === 'dark') applyTheme(savedTheme);

  var toggle = $('#theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
    });
  }

  /* ---------- sticky header edge ---------- */

  var header = $('.site-header');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('is-stuck', window.scrollY > 8);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
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
  if (window.fetch) {
    fetch('https://api.github.com/repos/' + REPO + '/releases/latest', {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (response) {
        if (!response.ok) {
          markUnpublished();
          return null;
        }
        return response.json();
      })
      .then(function (release) {
        if (!release) return;
        var asset = (release.assets || []).filter(function (candidate) {
          return /\.apk$/i.test(candidate.name);
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
