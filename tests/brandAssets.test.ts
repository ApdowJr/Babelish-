/**
 * Brand assets and splash configuration.
 *
 * Store icons fail late and loudly — a missing or mis-sized file is rejected
 * at build time, or worse, ships as a blurry placeholder. These checks read the
 * real files: PNG dimensions come from the IHDR header, so no image library is
 * needed, and app.json is parsed to prove the splash is actually configured.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assets = path.join(root, 'assets');

/** Width/height from a PNG's IHDR chunk (bytes 16–23). */
function pngSize(file: string): { width: number; height: number } {
  const buffer = readFileSync(file);
  const signature = buffer.subarray(0, 8).toString('hex');
  assert.equal(signature, '89504e470d0a1a0a', `${path.basename(file)} is not a PNG`);
  assert.equal(buffer.subarray(12, 16).toString('ascii'), 'IHDR');
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

const expected: [string, number][] = [
  ['icon.png', 1024],
  ['android-icon-background.png', 1024],
  ['android-icon-foreground.png', 1024],
  ['android-icon-monochrome.png', 1024],
  ['splash-icon.png', 512],
  ['favicon.png', 96],
];

test('every launcher asset exists at the size the stores expect', () => {
  for (const [name, size] of expected) {
    const file = path.join(assets, name);
    assert.ok(existsSync(file), `${name} is missing`);
    const { width, height } = pngSize(file);
    assert.equal(width, size, `${name} width`);
    assert.equal(height, size, `${name} height`);
  }
});

test('app.json points at the new assets and configures the splash', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8')) as {
    expo: {
      icon: string;
      version: string;
      android: { adaptiveIcon: Record<string, string> };
      web: { favicon: string; themeColor?: string };
      plugins: (string | [string, Record<string, unknown>])[];
    };
  };
  const { expo } = app;

  for (const candidate of [
    expo.icon,
    expo.android.adaptiveIcon.foregroundImage,
    expo.android.adaptiveIcon.backgroundImage,
    expo.android.adaptiveIcon.monochromeImage,
    expo.web.favicon,
  ]) {
    assert.ok(existsSync(path.join(root, candidate)), `${candidate} does not exist`);
  }

  const splash = expo.plugins.find(
    (plugin): plugin is [string, Record<string, unknown>] =>
      Array.isArray(plugin) && plugin[0] === 'expo-splash-screen'
  );
  assert.ok(splash, 'expo-splash-screen is not registered');
  assert.equal(splash[1].image, './assets/splash-icon.png');
  assert.equal(splash[1].backgroundColor, '#0B3A2C');
  assert.equal(typeof splash[1].imageWidth, 'number');
  assert.equal(expo.android.adaptiveIcon.backgroundColor, '#0B3A2C');
});

test('the icon generator is committed, so the assets are reproducible', () => {
  const script = path.join(root, 'scripts', 'brand', 'generate-icons.py');
  assert.ok(existsSync(script), 'scripts/brand/generate-icons.py is missing');
  const source = readFileSync(script, 'utf8');
  // The palette must match the app tokens, not drift into a second brand.
  assert.match(source, /FOREST_DARK = \(11, 58, 44\)/);
  assert.match(source, /TANGERINE = \(233, 118, 79\)/);
  assert.match(source, /PARCHMENT = \(247, 244, 237\)/);
});
