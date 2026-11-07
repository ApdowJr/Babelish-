/**
 * Native-only, Android-only invariant — Babelish is an Android APK, NOT a
 * web app and NOT an iPhone app (owner decision: "Android kaliya waa,
 * remove all iphone resources" — Android only, no iPhone build any more).
 *
 * These tests read the real config files so the Expo web target or a
 * revived iOS target cannot creep back in through a dependency, a script,
 * a deployment file, or CI. The one approved public web surface is the
 * committed static download/legal site in `website/`; it contains no app
 * bundle, routes, scripts, or lesson player — and no iPhone promise.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');
const listFiles = (relativeDir: string): string[] => {
  const base = path.join(root, relativeDir);
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory()
        ? walk(full)
        : [path.relative(base, full).split(path.sep).join('/')];
    });
  return walk(base).sort();
};

test('app.json targets Android only and declares no web or iOS section', () => {
  const app = JSON.parse(read('app.json')) as {
    expo: { platforms?: string[]; web?: unknown; ios?: unknown; icon: string };
  };
  assert.deepEqual(app.expo.platforms, ['android']);
  assert.equal(app.expo.web, undefined, 'web target must stay removed');
  assert.equal(app.expo.ios, undefined, 'the iOS section must stay removed (Android only)');
  assert.ok(!JSON.stringify(app.expo).includes('favicon'), 'no web favicon config');
});

test('package.json has no web dependencies, no web scripts, and no iOS scripts', () => {
  const pkg = JSON.parse(read('package.json')) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const webDep of ['react-native-web', 'react-dom', '@expo/metro-runtime']) {
    assert.equal(deps[webDep], undefined, `${webDep} is web-only and must not return`);
  }
  assert.equal(pkg.scripts['web'], undefined, 'no "web" script');
  assert.equal(pkg.scripts['build:web'], undefined, 'no "build:web" script');
  assert.equal(pkg.scripts['ios'], undefined, 'no "ios" start script (Android only)');
  assert.equal(pkg.scripts['build:ios'], undefined, 'no "build:ios" script (Android only)');
  assert.equal(pkg.scripts['build:iphone'], undefined, 'no "build:iphone" script (Android only)');
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    assert.ok(!/--web\b|--platform web\b/.test(cmd), `script "${name}" targets web: ${cmd}`);
    assert.ok(!/--platform ios\b|--platform all\b/.test(cmd), `script "${name}" targets iOS/all: ${cmd}`);
  }
});

test('the phone build scripts exist (APK, AAB) and nothing iOS', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['build:apk'] ?? '', /eas-cli.*build.*--platform android.*--profile apk/);
  assert.match(pkg.scripts['build:aab'] ?? '', /--platform android.*--profile production/);
  assert.equal(pkg.scripts['build:android'], 'expo export --platform android');
  assert.ok(existsSync(path.join(root, 'scripts/build-apk-local.sh')), 'local APK script missing');
});

test('Vercel deploys only the static download/legal site, never the Expo app', () => {
  // The owner approved a static download/legal page after the native-only
  // conversion, not a browser version of Babelish. Keep the config exact:
  // Framework Preset Other (`null`), empty install/build commands so Vercel
  // cannot fall back to package.json's Android export, and output limited to
  // committed static files under website/.
  const vercel = JSON.parse(read('vercel.json')) as Record<string, unknown>;
  assert.deepEqual(vercel, {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    framework: null,
    installCommand: '',
    buildCommand: '',
    outputDirectory: 'website',
    cleanUrls: true,
    trailingSlash: false,
    git: { deploymentEnabled: true },
    headers: [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; object-src 'none'; base-uri 'self'; form-action 'none'",
          },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=()' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ],
  });
  assert.ok(!existsSync(path.join(root, 'assets/favicon.png')), 'Expo web favicon must stay removed');
  const ignore = read('.gitignore');
  assert.ok(!ignore.includes('web-build/'), '.gitignore should not mention Expo web builds');
  for (const bin of ['*.apk', '*.aab', '*.ipa']) {
    assert.ok(ignore.includes(bin), `${bin} binaries must be gitignored, not committed`);
  }
});

test('the Vercel output is only static download/legal files with honest Android-only copy', () => {
  assert.deepEqual(listFiles('website'), [
    '404.html',
    'feature-graphic.png',
    'icon.png',
    'index.html',
    'privacy.html',
    'robots.txt',
    'styles.css',
    'terms.html',
  ]);

  const index = read('website/index.html');
  const privacy = read('website/privacy.html');
  const terms = read('website/terms.html');
  const notFound = read('website/404.html');
  const styles = read('website/styles.css');
  const allSiteText = [index, privacy, terms, notFound, styles, read('website/robots.txt')].join('\n');

  for (const forbidden of [
    /<script\b/i,
    /<iframe\b/i,
    /<form\b/i,
    /_expo\b/i,
    /expo\s+export/i,
    /react-native-web/i,
    /localhost/i,
    /127\.0\.0\.1/,
  ]) {
    assert.ok(!forbidden.test(allSiteText), `static site must not contain ${forbidden}`);
  }

  // Android only: the public site must not promise, hint at, or link an
  // iPhone build, a simulator run, or an Apple-account path.
  for (const forbidden of [/iphone/i, /testflight/i, /app store/i, /apple developer/i]) {
    assert.ok(!forbidden.test(allSiteText), `static site must not mention ${forbidden} (Android only)`);
  }

  const app = JSON.parse(read('app.json')) as { expo: { version: string } };
  assert.ok(index.includes(app.expo.version), 'download page version drifted from app.json');
  assert.ok(
    index.includes('https://github.com/ApdowJr/Babelish-/releases/latest/download/babelish.apk'),
    'Android card must link the release APK itself, not an Actions artifact'
  );
  // The download must be the APK itself, never an artifact (a ZIP behind a
  // login) — that is how "package appears to be invalid" happens.
  assert.ok(!index.includes('/actions/runs/'), 'the download must be the APK itself, not an Actions run');
  assert.ok(index.includes('babelish.apk.sha256'), 'the published checksum must be findable');
  assert.ok(
    index.includes('package appears to be invalid'),
    'the page must answer the install error people actually hit'
  );
  assert.ok(index.includes('not a web app'), 'landing page must say it is not a web app');
  assert.ok(index.includes('Android kaliya'), 'the page must say Android only, in Somali');
  assert.ok(index.includes('for Android'), 'the English summary must say the app is for Android');
  assert.ok(index.includes('href="/privacy"') && index.includes('href="/terms"'), 'legal links missing');

  for (const heading of [
    'The short version',
    'What lives only on your device',
    'What syncs when you sign in',
    'Microphone audio',
    'AI tutor content',
    'Children',
    'Your rights',
  ]) {
    assert.ok(privacy.includes(heading), `static privacy is missing: ${heading}`);
    assert.ok(read('src/app/privacy.tsx').includes(heading), `app privacy heading drifted: ${heading}`);
  }
  assert.ok(privacy.includes('Operators &amp; subprocessors'), 'static privacy subprocessors missing');
  assert.ok(privacy.includes('Last updated: 2026-10-23'), 'static privacy date drifted');
  assert.ok(privacy.includes('JSON via the system share sheet'), 'static privacy must describe the native export');
  assert.ok(!privacy.includes('JSON download on web'), 'static privacy must not revive a web download claim');

  for (const heading of [
    'The short version',
    'Your account',
    'Acceptable use',
    'The AI tutor is a learning aid',
    'Free service, honest limits',
    'Your content, our software',
    'Availability and liability',
    'Ending it',
    'Privacy',
    'Contact',
  ]) {
    assert.ok(terms.includes(heading), `static terms is missing: ${heading}`);
    assert.ok(read('src/app/terms.tsx').includes(heading), `app terms heading drifted: ${heading}`);
  }
  assert.ok(terms.includes('Last updated: 2026-10-23'), 'static terms date drifted');
  assert.ok(terms.includes('support@zelvoca.app'), 'static terms support contact missing');
  assert.equal(read('website/robots.txt').trim(), 'User-agent: *\nAllow: /');
});

test('CI bundles Android only and never the web or iOS platform', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.ok(!ci.includes('build:web'), 'CI must not build the web target');
  assert.ok(!ci.includes('build:ios'), 'CI must not build the iOS target (Android only)');
  assert.ok(!/--platform web/.test(ci), 'CI must not export the web platform');
  assert.ok(!/--platform ios/.test(ci), 'CI must not export the iOS platform');
  assert.ok(ci.includes('build:android'), 'CI must bundle Android');
});

test('the manual "Build mobile" workflow really builds an APK and nothing iOS', () => {
  const workflow = read('.github/workflows/build-mobile.yml');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /expo prebuild --platform android/);
  assert.match(workflow, /gradlew assembleRelease/, 'Android job must produce a real release APK');
  assert.match(workflow, /upload-artifact/, 'APK must be downloadable from the run');
  assert.match(workflow, /babelish-android-apk/);
  // Android only: no iOS job, no simulator build, no Apple runner.
  assert.ok(!workflow.includes('--platform ios'), 'workflow must not prebuild iOS');
  assert.ok(!/iphonesimulator/.test(workflow), 'workflow must not build a simulator app');
  assert.ok(!/runs-on: xcode/.test(workflow), 'workflow must not use an Xcode runner');
});

test('the referral message does not send people to a website', () => {
  const profile = read('src/app/(tabs)/profile.tsx');
  assert.ok(!profile.includes('vercel.app'), 'invite must not link the removed web app');
  assert.ok(!profile.includes("Platform.OS === 'web'"), 'invite must use the native share sheet');
  assert.match(profile, /Share\.share/);
});

test('the build guide documents the Android APK and the Android-only decision, in Somali and English', () => {
  const guide = read('docs/BUILD_MOBILE.md');
  assert.match(guide, /Soomaali/);
  assert.match(guide, /build:apk/);
  assert.match(guide, /Android only|Android kaliya/i);
  assert.match(guide, /GitHub Actions/);
  assert.match(guide, /website\/privacy\.html/, 'guide must identify the static public privacy copy');
  assert.match(guide, /static download\/legal/i, 'guide must keep the Vercel exception narrow');
  assert.ok(!guide.includes('deploymentEnabled: false'), 'guide must not describe the removed kill switch as current');
  // The iPhone build paths (TestFlight, Apple account, $99) are gone.
  assert.ok(!guide.includes('TestFlight'), 'guide must not document the removed TestFlight path');
  assert.ok(!guide.includes('npm run build:iphone'), 'guide must not reference the removed iPhone script');
});
