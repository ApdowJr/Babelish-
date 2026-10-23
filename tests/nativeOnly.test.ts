/**
 * Native-only invariant — Babelish is an Android APK + iPhone app, NOT a
 * web app (owner request: "Apk ubadal kaliy android iyo iPhone haku
 * shaqeyo web lama rabo" — convert to APK only, work on Android and
 * iPhone, no web).
 *
 * These tests read the real config files so the Expo web target cannot creep
 * back in through a dependency, a script, a deployment file, or CI. The one
 * approved public web surface is the committed static download/legal site in
 * `website/`; it contains no app bundle, routes, scripts, or lesson player.
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

test('app.json targets exactly Android + iOS and declares no web section', () => {
  const app = JSON.parse(read('app.json')) as {
    expo: { platforms?: string[]; web?: unknown; icon: string };
  };
  assert.deepEqual(app.expo.platforms, ['android', 'ios']);
  assert.equal(app.expo.web, undefined, 'web target must stay removed');
  assert.ok(!JSON.stringify(app.expo).includes('favicon'), 'no web favicon config');
});

test('package.json has no web dependencies or web scripts', () => {
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
  for (const [name, cmd] of Object.entries(pkg.scripts)) {
    assert.ok(!/--web\b|--platform web\b/.test(cmd), `script "${name}" targets web: ${cmd}`);
  }
});

test('the phone build scripts exist (APK, AAB, iPhone)', () => {
  const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
  assert.match(pkg.scripts['build:apk'] ?? '', /eas-cli.*build.*--platform android.*--profile apk/);
  assert.match(pkg.scripts['build:aab'] ?? '', /--platform android.*--profile production/);
  assert.match(pkg.scripts['build:iphone'] ?? '', /--platform ios.*--profile production/);
  assert.equal(pkg.scripts['build:android'], 'expo export --platform android');
  assert.equal(pkg.scripts['build:ios'], 'expo export --platform ios');
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

test('the Vercel output is only static download/legal files with honest platform copy', () => {
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

  const app = JSON.parse(read('app.json')) as { expo: { version: string } };
  assert.ok(index.includes(app.expo.version), 'download page version drifted from app.json');
  assert.ok(
    index.includes('https://github.com/ApdowJr/Babelish-/actions/runs/39998390132'),
    'Android card must link the real successful APK run'
  );
  assert.ok(index.includes('babelish-android-apk'), 'Android instructions must name the real artifact');
  assert.ok(index.includes('not a web app'), 'landing page must say it is not a web app');
  assert.ok(
    index.includes('cannot be installed on a physical iPhone'),
    'iPhone copy must not pretend the simulator build installs on a real device'
  );
  assert.ok(index.includes('Apple Developer Program ($99/year)'), 'iPhone cost must stay explicit');
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

test('CI bundles Android + iOS and never the web platform', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.ok(!ci.includes('build:web'), 'CI must not build the web target');
  assert.ok(!/--platform web/.test(ci), 'CI must not export the web platform');
  assert.ok(ci.includes('build:android'), 'CI must bundle Android');
  assert.ok(ci.includes('build:ios'), 'CI must bundle iOS');
});

test('the manual "Build mobile" workflow really builds an APK and an iOS app', () => {
  const workflow = read('.github/workflows/build-mobile.yml');
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /expo prebuild --platform android/);
  assert.match(workflow, /gradlew assembleRelease/, 'Android job must produce a real release APK');
  assert.match(workflow, /upload-artifact/, 'APK must be downloadable from the run');
  assert.match(workflow, /babelish-android-apk/);
  assert.match(workflow, /expo prebuild --platform ios/);
  // Expo SDK 58 needs Xcode 26.4+; old macOS images fail xcodebuild
  // instantly (exit 66). The job must stay on an Xcode 27 runner.
  assert.match(workflow, /runs-on: xcode-27/, 'iOS job must use the Xcode 27 runner (SDK 58)');
  assert.ok(!workflow.includes('macos-14'), 'macos-14 ships an Xcode too old for SDK 58');
  assert.match(workflow, /pod install/, 'pods must be installed explicitly if prebuild skips them');
  assert.match(workflow, /iphonesimulator/, 'iOS job must be honest: unsigned = simulator build');
  assert.match(workflow, /CODE_SIGNING_ALLOWED=NO/);
  // The workflow must say the quiet part out loud: no fake iPhone installs.
  assert.match(workflow, /Apple Developer|Apple account/i);
});

test('the referral message does not send people to a website', () => {
  const profile = read('src/app/(tabs)/profile.tsx');
  assert.ok(!profile.includes('vercel.app'), 'invite must not link the removed web app');
  assert.ok(!profile.includes("Platform.OS === 'web'"), 'invite must use the native share sheet');
  assert.match(profile, /Share\.share/);
});

test('the build guide documents APK + the honest iPhone limits in Somali and English', () => {
  const guide = read('docs/BUILD_MOBILE.md');
  assert.match(guide, /Soomaali/);
  assert.match(guide, /build:apk/);
  assert.match(guide, /TestFlight/);
  assert.match(guide, /Apple Developer/);
  assert.match(guide, /\$99/, 'guide must state the Apple Developer cost honestly');
  assert.match(guide, /GitHub Actions/);
  assert.match(guide, /website\/privacy\.html/, 'guide must identify the static public privacy copy');
  assert.match(guide, /static download\/legal/i, 'guide must keep the Vercel exception narrow');
  assert.ok(!guide.includes('deploymentEnabled: false'), 'guide must not describe the removed kill switch as current');
});
