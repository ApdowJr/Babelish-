/**
 * Release-version tests.
 *
 * Root cause these guard: the app version lived in THREE places —
 * package.json, app.json and a hardcoded "Nativa v1.0.0" string in the
 * Profile footer. A release bump that touches only one of them ships a
 * binary whose store version disagrees with what the learner sees on
 * screen, and support tickets become impossible to triage ("which version
 * are you on?").
 *
 * The footer now reads app.json at runtime through expo-constants, so these
 * tests assert the single source of truth stays single, and that no
 * hardcoded version literal creeps back into the UI.
 *
 * Paths resolve from process.cwd(): scripts/test.mjs runs each compiled test
 * file with cwd set to the repo root.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?(\+[0-9A-Za-z-.]+)?$/;

/** A baked-in version string in UI copy, e.g. `Nativa v1.0.0`. */
const HARDCODED_VERSION = /Nativa v\d+\.\d+\.\d+/;

function readJson(file: string): Record<string, any> {
  return JSON.parse(readFileSync(path.join(process.cwd(), file), 'utf8')) as Record<string, any>;
}

function readSource(file: string): string {
  return readFileSync(path.join(process.cwd(), file), 'utf8');
}

/** Every .ts/.tsx file under a directory, recursively. */
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsFiles(full));
    else if (/\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

test('package.json and app.json declare the same app version', () => {
  const pkg = readJson('package.json');
  const app = readJson('app.json');
  assert.equal(typeof pkg.version, 'string', 'package.json needs a version');
  assert.equal(typeof app.expo?.version, 'string', 'app.json needs expo.version');
  assert.equal(
    app.expo.version,
    pkg.version,
    'store version (app.json) must match package.json — bump both together'
  );
});

test('the app version is valid semver', () => {
  const { version } = readJson('package.json');
  assert.match(String(version), SEMVER, `"${version}" is not valid semver`);
});

test('the Profile footer reads the version instead of hardcoding it', () => {
  const source = readSource('src/app/(tabs)/profile.tsx');
  assert.equal(
    HARDCODED_VERSION.test(source),
    false,
    'Profile footer hardcodes a version string — render APP_VERSION instead'
  );
  assert.match(source, /APP_VERSION/, 'footer should render APP_VERSION');
  assert.match(
    source,
    /Constants\.expoConfig\?\.version/,
    'APP_VERSION should come from Constants.expoConfig?.version (app.json at runtime)'
  );
});

test('no screen or component hardcodes a stale version literal', () => {
  const roots = ['src/app', 'src/components'];
  const hits: string[] = [];
  for (const root of roots) {
    for (const file of tsFiles(path.join(process.cwd(), root))) {
      if (HARDCODED_VERSION.test(readFileSync(file, 'utf8'))) {
        hits.push(path.relative(process.cwd(), file));
      }
    }
  }
  assert.deepEqual(hits, [], `stale hardcoded version literal(s): ${hits.join(', ')}`);
});
