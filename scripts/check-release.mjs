#!/usr/bin/env node
/**
 * Pre-submission gate — the things a store rejects you for, checked locally.
 *
 * Run before every build you intend to upload:  npm run check:release
 *
 * It does not replace a real build. It catches the failures that are cheap to
 * fix now and expensive to discover after a 20-minute cloud build:
 *
 *   version / versionCode drift · missing package id · unused or undeclared
 *   permissions · store artwork at the wrong size · a committed signing key ·
 *   a secret in an EXPO_PUBLIC_* variable · missing legal routes · an eas.json
 *   that would upload to production instead of internal testing.
 *
 * Exit codes: 0 = clear to build, 1 = blockers, 2 = warnings only.
 */
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, file), 'utf8');

const blockers = [];
const warnings = [];
const pass = [];

const block = (msg) => blockers.push(msg);
const warn = (msg) => warnings.push(msg);
const ok = (msg) => pass.push(msg);

// ── versions ────────────────────────────────────────────────────────────────
let app;
let pkg;
try {
  app = JSON.parse(read('app.json')).expo;
  pkg = JSON.parse(read('package.json'));
} catch (error) {
  console.error(`✘ Cannot read app.json / package.json: ${error.message}`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) block(`package.json version "${pkg.version}" is not semver`);
if (app.version !== pkg.version) {
  block(`version drift: app.json ${app.version} ≠ package.json ${pkg.version}`);
} else {
  ok(`version ${app.version} is consistent`);
}

const [major, minor, patch] = app.version.split('.').map(Number);
const expectedCode = major * 10000 + minor * 100 + patch;
if (app.android?.versionCode !== expectedCode) {
  block(`android.versionCode is ${app.android?.versionCode}, expected ${expectedCode} for ${app.version}`);
} else {
  ok(`versionCode ${expectedCode} matches the version`);
}

// ── identifiers ─────────────────────────────────────────────────────────────
const ids = [['android.package', app.android?.package], ['ios.bundleIdentifier', app.ios?.bundleIdentifier]];
for (const [name, value] of ids) {
  if (!value) block(`${name} is missing — the store cannot accept the build`);
  else if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(value)) block(`${name} "${value}" is not reverse-DNS`);
}
if (ids.every(([, value]) => value)) ok('package identifiers are set');

// ── permissions ─────────────────────────────────────────────────────────────
const permissions = app.android?.permissions ?? [];
const allowed = new Set(['RECORD_AUDIO', 'POST_NOTIFICATIONS', 'VIBRATE', 'INTERNET']);
for (const permission of permissions) {
  if (!allowed.has(permission)) {
    warn(`android.permissions includes ${permission} — Play asks you to justify each one`);
  }
}
if (!permissions.includes('RECORD_AUDIO')) {
  warn('RECORD_AUDIO is not declared, but the Speak tab records audio');
}
if (permissions.length > 0) ok(`${permissions.length} Android permission(s) declared`);

if (!app.ios?.infoPlist?.NSMicrophoneUsageDescription) {
  block('iOS NSMicrophoneUsageDescription is missing — App Review rejects the build');
} else {
  ok('iOS microphone string is present');
}
if (app.ios?.infoPlist?.ITSAppUsesNonExemptEncryption === undefined) {
  warn('ITSAppUsesNonExemptEncryption is not set; every submission will ask the same question');
}

// ── assets ──────────────────────────────────────────────────────────────────
const png = (file) => {
  const full = path.join(root, file);
  if (!existsSync(full)) return null;
  const buffer = readFileSync(full);
  if (buffer.subarray(1, 4).toString('ascii') !== 'PNG') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), buffer };
};

const required = [
  ['assets/icon.png', 1024, 1024],
  ['assets/android-icon-foreground.png', 1024, 1024],
  ['assets/android-icon-background.png', 1024, 1024],
  ['assets/android-icon-monochrome.png', 1024, 1024],
  ['assets/splash-icon.png', 512, 512],
  ['assets/favicon.png', 96, 96],
  ['assets/store/play-icon-512.png', 512, 512],
  ['assets/store/feature-graphic.png', 1024, 500],
  ['assets/notification-icon.png', 96, 96],
];
for (const [file, width, height] of required) {
  const info = png(file);
  if (!info) block(`${file} is missing or is not a PNG`);
  else if (info.width !== width || info.height !== height) {
    block(`${file} is ${info.width}×${info.height}, expected ${width}×${height}`);
  }
}
if (blockers.length === 0) ok(`${required.length} store assets are present and correctly sized`);

const playIcon = png('assets/store/play-icon-512.png');
if (playIcon && playIcon.buffer[25] !== 2) {
  block('the Play icon must be RGB without an alpha channel');
}

// ── credentials ─────────────────────────────────────────────────────────────
const ignore = read('.gitignore')
  .split('\n')
  .map((line) => line.trim());
for (const pattern of ['secrets/', '*.keystore', '*.jks']) {
  if (!ignore.includes(pattern)) block(`${pattern} is not in .gitignore — a signing key could be committed`);
}
for (const file of ['secrets/play-service-account.json', 'android-keystore.jks', 'release.keystore']) {
  if (existsSync(path.join(root, file))) block(`${file} exists in the working tree — move it out of the repo`);
}
ok('signing files are ignored');

const envExample = existsSync(path.join(root, '.env.example')) ? read('.env.example') : '';
for (const line of envExample.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed.startsWith('EXPO_PUBLIC_')) continue;
  if (/sk-[a-z0-9]|SECRET=.+[A-Za-z0-9]{8}|PASSWORD=.+[A-Za-z0-9]{8}/i.test(trimmed)) {
    block(`EXPO_PUBLIC_* is bundled into the app, never put a secret there: ${trimmed.slice(0, 40)}…`);
  }
}

// ── legal + eas ─────────────────────────────────────────────────────────────
for (const route of ['src/app/privacy.tsx', 'src/app/terms.tsx']) {
  if (!existsSync(path.join(root, route))) block(`${route} is missing — both stores need reachable legal pages`);
}
if (!existsSync(path.join(root, 'src/app/privacy.tsx')) || !existsSync(path.join(root, 'src/app/terms.tsx'))) {
  // already reported above
} else {
  ok('privacy and terms routes exist');
}

let eas = null;
try {
  eas = JSON.parse(read('eas.json'));
} catch {
  block('eas.json is missing or is not valid JSON');
}
if (eas) {
  if (!eas.build?.production?.android?.buildType) {
    block('eas.json has no production Android build type (Play needs an .aab)');
  } else if (eas.build.production.android.buildType !== 'app-bundle') {
    block(`production buildType is ${eas.build.production.android.buildType}; Play needs app-bundle`);
  }
  if (eas.submit?.production?.android?.track === 'production') {
    warn('submit targets the production track — use internal first, then promote');
  }
  if (eas.submit?.production?.android?.releaseStatus !== 'draft') {
    warn('submissions are not drafts; a mistyped command could publish straight to testers');
  }
  ok('eas.json build/submit profiles are present');
}

// ── report ──────────────────────────────────────────────────────────────────
const line = '─'.repeat(64);
console.log(`\nBabelish release check — ${app.name} ${app.version}\n${line}`);
for (const message of pass) console.log(`  ✓ ${message}`);
for (const message of warnings) console.log(`  ! ${message}`);
for (const message of blockers) console.log(`  ✘ ${message}`);
console.log(line);

if (blockers.length > 0) {
  console.log(`\n✘ ${blockers.length} blocker(s) — fix these before building.\n`);
  process.exit(1);
}
if (warnings.length > 0) {
  console.log(`\n! ${warnings.length} warning(s), nothing blocking. Clear to build.\n`);
  process.exit(2);
}
console.log('\n✓ Clear to build. Next: npx eas-cli build --platform android --profile production\n');
