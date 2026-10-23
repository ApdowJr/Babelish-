/**
 * Store-release invariants.
 *
 * These are the mistakes that cost a day at submission time: a version code
 * that goes backwards, a missing package id, a permission the app never uses
 * (Play asks you to justify each), a store graphic at the wrong size, or a
 * credential accidentally committed. Everything here reads the real files.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

type AppJson = {
  expo: {
    version: string;
    name: string;
    slug: string;
    ios: { bundleIdentifier?: string; buildNumber?: string; infoPlist?: Record<string, unknown> };
    android: {
      package?: string;
      versionCode?: number;
      permissions?: string[];
      adaptiveIcon?: Record<string, string>;
    };
    plugins: (string | [string, Record<string, unknown>])[];
  };
};

const app = JSON.parse(read('app.json')) as AppJson;
const pkg = JSON.parse(read('package.json')) as { version: string };

test('the app version and package.json agree, and are semver', () => {
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
  assert.equal(app.expo.version, pkg.version, 'app.json and package.json versions differ');
});

test('the Android version code can only move forward', () => {
  const { versionCode } = app.expo.android;
  assert.equal(typeof versionCode, 'number');
  const [major, minor, patch] = app.expo.version.split('.').map(Number);
  // MAJOR*10000 + MINOR*100 + PATCH — playing store rejections safe.
  assert.equal(versionCode, major * 10000 + minor * 100 + patch);
  assert.ok(versionCode! > 0 && versionCode! < 2_100_000_000, 'Play rejects codes above 2.1e9');
});

test('both stores have a reverse-DNS identifier', () => {
  for (const id of [app.expo.android.package, app.expo.ios.bundleIdentifier]) {
    assert.equal(typeof id, 'string');
    assert.match(id!, /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, `${id} is not reverse-DNS`);
    assert.equal(id, 'app.zelvoca.babelish');
  }
});

test('iOS declares the microphone and the encryption question', () => {
  const plist = app.expo.ios.infoPlist ?? {};
  assert.match(String(plist.NSMicrophoneUsageDescription), /microphone/i);
  // Without this, every App Store submission asks the same question again.
  assert.equal(plist.ITSAppUsesNonExemptEncryption, false);
  // The app has no ads and no tracking SDK, so it must not declare tracking.
  assert.equal(plist.NSUserTrackingUsageDescription, undefined);
});

test('Android requests only permissions the app uses', () => {
  const permissions = app.expo.android.permissions ?? [];
  // RECORD_AUDIO for the mic, POST_NOTIFICATIONS for the reminder.
  assert.deepEqual([...permissions].sort(), ['POST_NOTIFICATIONS', 'RECORD_AUDIO']);
  for (const unused of ['CAMERA', 'ACCESS_FINE_LOCATION', 'READ_CONTACTS', 'READ_SMS']) {
    assert.ok(
      !permissions.some((permission) => permission.includes(unused)),
      `${unused} would need a justification in the Play listing`
    );
  }
});

test('Play artwork exists at the sizes the console enforces', () => {
  const checks: [string, number, number][] = [
    ['assets/store/play-icon-512.png', 512, 512],
    ['assets/store/feature-graphic.png', 1024, 500],
    ['assets/notification-icon.png', 96, 96],
  ];
  for (const [file, width, height] of checks) {
    const full = path.join(root, file);
    assert.ok(existsSync(full), `${file} is missing`);
    const buffer = readFileSync(full);
    assert.equal(buffer.subarray(1, 4).toString('ascii'), 'PNG', `${file} must be a PNG`);
    assert.equal(buffer.readUInt32BE(16), width, `${file} width`);
    assert.equal(buffer.readUInt32BE(20), height, `${file} height`);
    // Play rejects a store icon with an alpha channel.
    if (file.endsWith('play-icon-512.png')) {
      const colourType = buffer[25];
      assert.equal(colourType, 2, 'store icon must be RGB (no alpha)');
    }
  }
});

test('eas.json defines the three profiles and submits to internal first', () => {
  const eas = JSON.parse(read('eas.json')) as {
    build: Record<string, { android?: { buildType?: string } }>;
    submit: Record<string, { android?: { track?: string; releaseStatus?: string } }>;
  };
  for (const profile of ['development', 'preview', 'production']) {
    assert.ok(eas.build[profile], `missing build profile ${profile}`);
  }
  assert.equal(eas.build.production.android?.buildType, 'app-bundle', 'Play needs an AAB');
  assert.equal(eas.submit.production.android?.track, 'internal');
  assert.equal(eas.submit.production.android?.releaseStatus, 'draft');
});

test('signing credentials and secrets are gitignored', () => {
  const ignore = read('.gitignore');
  for (const pattern of ['secrets/', '*.keystore', '*.jks', '.env']) {
    assert.ok(ignore.split('\n').some((line) => line.trim() === pattern), `${pattern} not ignored`);
  }
});

test('no server secret is referenced from browser-exposed config', () => {
  const publicVars = read('.env.example')
    .split('\n')
    .filter((line) => line.trim().startsWith('EXPO_PUBLIC_'));
  for (const line of publicVars) {
    assert.ok(
      !/KEY=.+sk-|SECRET=|PASSWORD=/i.test(line),
      `EXPO_PUBLIC_* is bundled into the app: ${line}`
    );
  }
});

test('the legal pages the stores require exist as routes', () => {
  assert.ok(existsSync(path.join(root, 'src/app/privacy.tsx')), 'privacy route missing');
  assert.ok(existsSync(path.join(root, 'src/app/terms.tsx')), 'terms route missing');
  const terms = read('src/app/terms.tsx');
  assert.match(terms, /Last updated/);
  assert.match(terms, /delete your account/i);
});

test('the release gate script passes on the current tree', async () => {
  const { spawnSync } = await import('node:child_process');
  const run = spawnSync(process.execPath, ['scripts/check-release.mjs'], {
    cwd: root,
    encoding: 'utf8',
  });
  // 0 = clear, 2 = warnings only. 1 means a blocker exists and CI must fail.
  assert.notEqual(run.status, 1, `check:release reported blockers:\n${run.stdout}${run.stderr}`);
});

test('the Android notification channel matches between code and config', () => {
  const source = read('src/lib/notifications.ts');
  const channel = source.match(/CHANNEL_ID = '([^']+)'/)?.[1];
  assert.ok(channel, 'CHANNEL_ID is not exported as a literal');
  const plugin = app.expo.plugins.find(
    (entry): entry is [string, Record<string, unknown>] =>
      Array.isArray(entry) && entry[0] === 'expo-notifications'
  );
  assert.ok(plugin, 'expo-notifications is not configured in app.json');
  assert.equal(plugin[1].defaultChannel, channel, 'a mismatch would hide the reminder');
  assert.equal(plugin[1].icon, './assets/notification-icon.png');
  assert.equal(plugin[1].color, '#0F4C3A');
});

test('eas.json configures public Supabase env vars for all cloud build profiles', () => {
  const eas = JSON.parse(read('eas.json')) as {
    build: Record<string, { env?: Record<string, string> }>;
  };
  for (const profile of ['development', 'preview', 'production']) {
    const env = eas.build[profile]?.env ?? {};
    assert.match(env.EXPO_PUBLIC_SUPABASE_URL ?? '', /^https:\/\/[a-z0-9]+\.supabase\.co$/);
    assert.match(env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '', /^sb_publishable_/);
  }
});

test('STORE_RELEASE.md matches app version, live privacy URL, and 25-language catalog', () => {
  const storeDoc = read('docs/STORE_RELEASE.md');
  assert.ok(storeDoc.includes(`\`${app.expo.version}\``), 'STORE_RELEASE.md version drifted from app.json');
  assert.ok(storeDoc.includes('https://babelish.vercel.app/privacy'), 'STORE_RELEASE.md missing live privacy URL');
  assert.ok(storeDoc.includes('25 LANGUAGES, REAL COURSES'), 'STORE_RELEASE.md language count drifted');
  assert.ok(!storeDoc.includes('Urdu'), 'STORE_RELEASE.md must not list unshipped languages');
});

test('ReviewScreen logs review_completed and LessonScreen resets state on routeKey changes', () => {
  const reviewSrc = read('src/app/review.tsx');
  assert.ok(
    reviewSrc.includes("logEvent('review_completed')"),
    'ReviewScreen must log review_completed so XP, streak, and badges update'
  );
  const lessonSrc = read('src/app/lesson/[id].tsx');
  assert.ok(
    lessonSrc.includes('if (activeKey !== routeKey)'),
    'LessonScreen must reset player state when advancing to nextLessonId'
  );
  assert.ok(
    lessonSrc.includes("exercise.type !== 'speak' && answered === null"),
    'LessonScreen advance() must not deadlock on speak exercises'
  );
});
