/**
 * The landing page and the APK pipeline.
 *
 * Static HTML has no compiler to catch a typo, so these tests are the compiler:
 * a translation key that exists in English but not Somali ships as an English
 * sentence on a Somali page, an `href="#download"` with no matching id is a
 * dead button, and a download link with nothing behind it wastes the visitor's
 * time. All of it is checked here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const html = read('site/index.html');
const css = read('site/styles.css');
const js = read('site/app.js');
const app = JSON.parse(read('app.json')).expo;

/* ---------- helpers ---------- */

/** Pulls `en: { … }` / `so: { … }` out of the script by brace matching. */
function dictionary(lang: 'en' | 'so'): string {
  const marker = `    ${lang}: {`;
  const start = js.indexOf(marker);
  assert.ok(start >= 0, `no ${lang} dictionary in site/app.js`);
  const open = js.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < js.length; i += 1) {
    if (js[i] === '{') depth += 1;
    else if (js[i] === '}') {
      depth -= 1;
      if (depth === 0) return js.slice(open, i + 1);
    }
  }
  throw new Error(`unbalanced ${lang} dictionary`);
}

function keysOf(block: string): string[] {
  return [...block.matchAll(/^\s*'([A-Za-z0-9_.]+)':/gm)].map((m) => m[1]).sort();
}

const en = keysOf(dictionary('en'));
const so = keysOf(dictionary('so'));

/* ---------- translations ---------- */

test('the page has a real translation dictionary for both languages', () => {
  assert.ok(en.length > 60, `only ${en.length} English strings`);
  assert.deepEqual(so, en, 'Somali and English must cover exactly the same keys');
});

test('every element that asks for a translation has one', () => {
  const wanted = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((m) => m[1]);
  const aria = [...html.matchAll(/data-i18n-aria-label="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(wanted.length > 40, 'expected most copy to be translatable');
  const missing = [...wanted, ...aria].filter((key) => !en.includes(key));
  assert.deepEqual([...new Set(missing)], [], 'keys used in HTML but missing from the dictionary');
});

/** Splits a dictionary block into key → first quoted string. */
function entriesOf(block: string): Map<string, string> {
  const keys = [...block.matchAll(/^\s*'([A-Za-z0-9_.]+)':/gm)];
  const map = new Map<string, string>();
  for (let i = 0; i < keys.length; i += 1) {
    const from = keys[i].index! + keys[i][0].length;
    const to = i + 1 < keys.length ? keys[i + 1].index! : block.length;
    const value = block.slice(from, to).match(/['"]((?:[^'"\\]|\\.)*)['"]/)?.[1] ?? '';
    map.set(keys[i][1], value);
  }
  return map;
}

test('no dictionary value is left empty or untranslated', () => {
  const english = entriesOf(dictionary('en'));
  const somali = entriesOf(dictionary('so'));
  assert.equal(somali.size, so.length, 'every key must have a string value');

  for (const [key, value] of somali) {
    assert.ok(value.trim().length > 0, `so.${key} is empty`);
  }

  // A handful of nouns and the product name are the same in both languages;
  // a dictionary copied across wholesale is not.
  const identical = [...somali].filter(([key, value]) => english.get(key) === value);
  assert.ok(
    identical.length < en.length / 3,
    `${identical.length} of ${en.length} Somali strings are identical to English`
  );
});

/* ---------- links and structure ---------- */

test('every in-page link points at an element that exists', () => {
  const targets = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  const ids = new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  const dead = [...new Set(targets)].filter((id) => !ids.has(id));
  assert.deepEqual(dead, [], 'these anchors have no matching id');
  assert.ok(targets.length > 10);
});

test('the download button points at the release asset, not a placeholder', () => {
  const apk = 'https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk';
  assert.ok(html.includes(`href="${apk}"`), 'the hero/download buttons must use the APK url');
  // app.js builds it as REPO + path, so check both halves rather than the
  // concatenated literal.
  assert.ok(js.includes("REPO = 'ApdowJr/Babelish-'"), 'the script must know the repository');
  assert.ok(
    js.includes("'/releases/latest/download/babelish.apk'"),
    'the script must be able to check that same url'
  );
  assert.ok(js.includes("'/releases'"), 'and fall back to the releases page');
});

test('the page is strict-CSP friendly: no inline script or style', () => {
  assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'inline <script> would need unsafe-inline');
  assert.ok(!/\sstyle="/i.test(html), 'inline style attributes would need unsafe-inline');
  assert.ok(!/<style[\s>]/i.test(html), 'no <style> blocks');
  const csp = JSON.parse(read('site/vercel.json')).headers
    .flatMap((header: { headers: { key: string; value: string }[] }) => header.headers)
    .find((header: { key: string }) => header.key === 'Content-Security-Policy')?.value;
  assert.ok(csp, 'site/vercel.json should ship a CSP');
  assert.ok(!csp.includes('unsafe-inline'), 'the CSP must not need unsafe-inline');
  assert.ok(csp.includes("script-src 'self'"));
  assert.ok(csp.includes('https://api.github.com'), 'the APK probe needs connect-src');
});

test('the page loads nothing from third parties', () => {
  const external = [
    ...html.matchAll(/(?:src|href)="(https?:\/\/[^"]+)"/g),
  ].map((m) => new URL(m[1]).host);
  const allowed = new Set(['github.com', 'zelvoca.app', 'www.w3.org']);
  for (const host of external) {
    assert.ok(allowed.has(host), `${host} is not an allowed external host`);
  }
  for (const tracker of ['googleapis', 'googletagmanager', 'google-analytics', 'facebook.net', 'hotjar']) {
    assert.ok(!html.toLowerCase().includes(tracker), `${tracker} would be a tracker`);
    assert.ok(!js.toLowerCase().includes(tracker), `${tracker} would be a tracker`);
  }
  assert.ok(!/<script[^>]+src="https?:/i.test(html), 'no remote scripts');
  assert.ok(!/@import\s+url\(/i.test(css), 'no remote stylesheets');
});

test('the document declares a language and real metadata', () => {
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]{20,}<\/title>/);
  assert.match(html, /name="description"\s+content="[^"]{60,}"/);
  assert.match(html, /property="og:image"/);
});

test('the page says which version it is describing', () => {
  const shown = html.match(/id="meta-version">([^<]+)</)?.[1]?.trim();
  assert.equal(shown, app.version, 'the landing page version drifted from app.json');
});

test('the page does not claim a release that has not happened', () => {
  assert.match(html, /id="apk-note"/);
  assert.ok(js.includes('markUnpublished'), 'the dead-link guard must exist');
  assert.ok(js.includes('api.github.com'), 'and it must ask GitHub, not guess');
});

/* ---------- theme ---------- */

test('the landing page has both palettes and follows the device', () => {
  assert.match(css, /html\[data-theme='dark'\]\s*\{/);
  assert.match(css, /@media \(prefers-color-scheme: dark\)/);
  // The page wears the mascot's brand, sampled from the launcher icon.
  assert.ok(css.includes('#3a2fb8'), 'the brand violet, from assets/icon.png');
  assert.ok(css.includes('#0d0a1c'), 'the night canvas');
  assert.ok(css.includes('#f6f4fb'), 'the daylight canvas');
  assert.ok(js.includes('prefers-color-scheme'), 'the toggle must know the OS state');
  assert.ok(js.includes("'babelish-theme'"), 'and remember an explicit choice');
  // No flash: the saved choice is applied in <head>, before the stylesheet.
  const head = html.slice(0, html.indexOf('styles.css'));
  assert.ok(head.includes('theme-boot.js'), 'theme must be applied before first paint');
  assert.ok(read('site/theme-boot.js').includes('babelish-theme'));
});

test('the browser chrome matches the page, on every page', () => {
  // Without this the address bar stays the old forest green over a violet
  // header on mobile — the first thing a visitor sees.
  for (const page of ['site/index.html', 'site/privacy.html', 'site/terms.html']) {
    const markup = read(page);
    assert.match(
      markup,
      /<meta name="theme-color" content="#F6F4FB" media="\(prefers-color-scheme: light\)" \/>/,
      `${page} needs a daylight theme-color`
    );
    assert.match(
      markup,
      /<meta name="theme-color" content="#0D0A1C" media="\(prefers-color-scheme: dark\)" \/>/,
      `${page} needs a night theme-color`
    );
  }
  const boot = read('site/theme-boot.js');
  assert.ok(boot.includes('#F6F4FB') && boot.includes('#0D0A1C'));
  assert.ok(js.includes('#F6F4FB') && js.includes('#0D0A1C'), 'the toggle must repaint it');
  for (const [file, source] of [
    ['site/app.js', js],
    ['site/theme-boot.js', boot],
  ] as const) {
    assert.ok(!source.includes('#0B3A2C'), `${file} still paints the old forest chrome`);
  }
});

test('the stylesheet has no dead or undefined custom properties', () => {
  const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+):/gm)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...used].filter((name) => !defined.has(name)), [], 'undefined variables');
  assert.deepEqual([...defined].filter((name) => !used.has(name)), [], 'unused variables');
});

test('reduced motion is respected', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
});

test('the site uses the app artwork that actually ships', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  for (const [siteFile, appFile] of [
    ['site/assets/icon.png', 'assets/icon.png'],
    ['site/assets/feature-graphic.png', 'assets/store/feature-graphic.png'],
  ] as const) {
    const siteBytes = readFileSync(path.join(root, siteFile));
    const appBytes = readFileSync(path.join(root, appFile));
    assert.ok(
      siteBytes.equals(appBytes),
      `${siteFile} is stale — copy ${appFile} into site/assets/`
    );
  }
  // And the page must not describe a palette the icon does not use.
  assert.ok(html.includes('assets/icon.png'));
});

test('the catalogue numbers on the page match the catalogue', () => {
  const apps = [...html.matchAll(/<div class="stat"><b>([\d,]+)<\/b>/g)].map((m) =>
    Number(m[1].replace(/,/g, ''))
  );
  assert.deepEqual(apps, [25, 101, 212, 1744, 550], 'languages · chapters · lessons · exercises · words');
  // The README advertises the same numbers; if the curriculum grows, both move.
  const readme = read('README.md');
  for (const value of ['25 languages', '101 chapters', '212 lessons', '1,744 exercises', '550 starter words']) {
    assert.ok(readme.includes(value), `README no longer says “${value}”`);
  }
});

test('the legal pages the stores need are published here', () => {
  for (const file of ['site/privacy.html', 'site/terms.html']) {
    assert.ok(existsSync(path.join(root, file)), `${file} missing — stores need a URL`);
  }
  assert.ok(html.includes('href="privacy.html"'));
  assert.ok(html.includes('href="terms.html"'));

  // Keep the page honest: every section heading in the app's policy must be
  // reachable on the website copy, or the two documents have drifted.
  const appPrivacy = read('src/app/privacy.tsx');
  const appHeadings = [...appPrivacy.matchAll(/<Text style=\{styles\.h2\}>([^<]+)<\/Text>/g)].map(
    (m) => m[1].trim()
  );
  assert.ok(appHeadings.length >= 6, 'expected the app policy to have sections');
  // HTML escapes “&” as &amp;; compare decoded text so the check is about
  // the words, not the entity.
  const decode = (value: string) => value.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ');
  const web = decode(read('site/privacy.html'));
  for (const heading of appHeadings) {
    assert.ok(web.includes(heading), `site/privacy.html is missing the “${heading}” section`);
  }

  const appTerms = read('src/app/terms.tsx');
  const termHeadings = [...appTerms.matchAll(/<Text style=\{styles\.h2\}>([^<]+)<\/Text>/g)].map(
    (m) => m[1].trim()
  );
  const termsWeb = decode(read('site/terms.html'));
  for (const heading of termHeadings) {
    assert.ok(termsWeb.includes(heading), `site/terms.html is missing the “${heading}” section`);
  }
});

test('the site stays a site: it never promises a web app', () => {
  // The app is native-only by owner decision. The marketing page may be a
  // website, but nothing on it may suggest you can *use* Babelish in a browser.
  const copy = (read('site/index.html') + read('site/app.js')).toLowerCase();
  for (const claim of ['use it in your browser', 'open the web app', 'play in your browser', 'web version']) {
    assert.ok(!copy.includes(claim), `“${claim}” contradicts the native-only decision`);
  }
  const app = JSON.parse(read('app.json')).expo;
  assert.deepEqual(app.platforms, ['android', 'ios']);
});

/* ---------- the APK pipeline ---------- */

const workflow = read('.github/workflows/android-apk.yml');

test('a workflow builds the APK from source', () => {
  assert.match(workflow, /assembleRelease/);
  assert.match(workflow, /expo prebuild --platform android/);
  assert.match(workflow, /uses: actions\/upload-artifact/);
  assert.match(workflow, /babelish\.apk/);
  assert.match(workflow, /npm ci/);
});

test('the workflow only publishes on a version tag', () => {
  assert.match(workflow, /tags: \['v\*'\]/);
  assert.match(workflow, /if: startsWith\(github\.ref, 'refs\/tags\/v'\)/);
  assert.match(workflow, /gh release (upload|create)/);
  // It must not run on every PR — the repo already has build-mobile.yml for
  // on-demand builds, and two APK jobs per PR is wasted CI.
  assert.ok(!/pull_request:/.test(workflow), 'tag/dispatch only');
});

test('the APK is trimmed to the architectures phones actually use', () => {
  assert.match(workflow, /reactNativeArchitectures=armeabi-v7a,arm64-v8a/);
  assert.match(workflow, /secrets\/|keystore/i, 'and signing material stays out of the repo');
});

test('the workflow does not pretend to be the Play Store build', () => {
  // Play needs an AAB signed with the real key; this is a side-loadable APK.
  assert.ok(!/buildType.*app-bundle/.test(workflow));
  assert.match(workflow, /debug keystore|EAS production build/);
});

/* ---------- assets and config ---------- */

test('the page files it references are in the repository', () => {
  for (const file of [
    'site/index.html',
    'site/styles.css',
    'site/app.js',
    'site/theme-boot.js',
    'site/vercel.json',
    'site/assets/icon.png',
    'site/assets/feature-graphic.png',
    'site/privacy.html',
    'site/terms.html',
  ]) {
    assert.ok(existsSync(path.join(root, file)), `${file} is missing`);
  }
});

test('the app declares the pieces dark mode needs on Android', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(
    pkg.dependencies['expo-system-ui'],
    'without expo-system-ui the navigation bar ignores userInterfaceStyle'
  );
  assert.equal(app.userInterfaceStyle, 'automatic');
  assert.equal(
    app.android?.edgeToEdgeEnabled,
    undefined,
    'Android 16 enforces edge-to-edge; the flag is obsolete and warns during prebuild'
  );
});

test('nothing in the site folder looks like a credential', () => {
  for (const file of ['site/app.js', 'site/index.html']) {
    const source = read(file);
    assert.ok(!/sk-[A-Za-z0-9]{16,}/.test(source), `${file} contains something key-shaped`);
    assert.ok(!/AIza[0-9A-Za-z_-]{20,}/.test(source));
  }
});
