/**
 * Native-only invariant — Babelish is an Android APK + iPhone app, NOT a
 * web app (owner request: "Apk ubadal kaliy android iyo iPhone haku
 * shaqeyo web lama rabo" — convert to APK only, work on Android and
 * iPhone, no web).
 *
 * These tests read the real config files so the web target cannot creep
 * back in through a dependency, a script, a deployment file, or CI.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

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

test('no web deployment happens: vercel.json is a disable-only kill switch', () => {
  // The Vercel GitHub App is still connected to this repo. With no
  // vercel.json it auto-detects a web build and fails every PR (that
  // was the PR #34 "Vercel: FAILURE" check). Vercel's documented fix is
  // git.deploymentEnabled: false — "To turn off automatic deployments
  // for all branches, set the property value to false" — so no
  // deployment is ever created. The file must contain NOTHING else:
  // any build/framework/output key would mean a web app is back.
  const vercel = JSON.parse(read('vercel.json')) as Record<string, unknown>;
  assert.deepEqual(vercel, {
    $schema: 'https://openapi.vercel.sh/vercel.json',
    git: { deploymentEnabled: false },
  });
  assert.ok(!existsSync(path.join(root, 'assets/favicon.png')), 'web favicon must stay removed');
  const ignore = read('.gitignore');
  assert.ok(!ignore.includes('web-build/'), '.gitignore should not mention web builds');
  for (const bin of ['*.apk', '*.aab', '*.ipa']) {
    assert.ok(ignore.includes(bin), `${bin} binaries must be gitignored, not committed`);
  }
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
});
