/**
 * The dark palette's honesty.
 *
 * A theme is easy to "add" and easy to get wrong: a colour that looked fine on
 * parchment turns into grey-on-grey at night. These tests compute real WCAG
 * contrast ratios from the two palettes, so a future tweak that quietly kills
 * legibility fails here instead of in a review screenshot nobody zooms into.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import {
  THEME_MODES,
  darkPalette,
  isThemeMode,
  lightPalette,
  resolvePalette,
  type Palette,
} from '../src/theme/palette';
import { DEFAULT_PREFERENCES, normalizePreferences } from '../src/lib/preferenceRules';

// Tests are compiled to a scratch dir, so anchor on the repo we run from.
const root = process.cwd();

/* ---------- colour maths ---------- */

type RGB = [number, number, number];

function parse(color: string): { rgb: RGB; alpha: number } {
  const hex = color.trim();
  if (hex.startsWith('#')) {
    const body = hex.slice(1);
    const full =
      body.length === 3
        ? body
            .split('')
            .map((c) => c + c)
            .join('')
        : body;
    return {
      rgb: [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as RGB,
      alpha: 1,
    };
  }
  const m = hex.match(/rgba?\(([^)]+)\)/);
  assert.ok(m, `unparseable colour: ${color}`);
  const parts = m[1].split(',').map((p) => Number(p.trim()));
  return { rgb: [parts[0], parts[1], parts[2]] as RGB, alpha: parts.length > 3 ? parts[3] : 1 };
}

/** Flattens a translucent colour onto its backdrop — that is what the eye sees. */
function flatten(color: string, backdrop: string): RGB {
  const fg = parse(color);
  if (fg.alpha >= 1) return fg.rgb;
  const bg = parse(backdrop);
  return fg.rgb.map((c, i) => Math.round(c * fg.alpha + bg.rgb[i] * (1 - fg.alpha))) as RGB;
}

function luminance(rgb: RGB): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** A palette entry as it appears on screen, translucent values already laid down. */
function show(palette: Palette, key: keyof Palette, base: keyof Palette = 'surface'): RGB {
  const value = palette[key] as string;
  return parse(value).alpha >= 1 ? parse(value).rgb : flatten(value, palette[base] as string);
}

function ratioOf(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function contrast(fg: string, bg: string): number {
  return ratioOf(flatten(fg, bg), parse(bg).rgb);
}

/* ---------- the pairs that actually appear in the UI ---------- */

/**
 * Body-size text (and anything a learner must read to act). WCAG AA = 4.5.
 * `bg` is the app canvas; `surface` is a card; the *Soft pairs are the tinted
 * chips and avatar discs.
 */
const TEXT_PAIRS: [keyof Palette, keyof Palette][] = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surfaceHigh'],
  ['textMuted', 'bg'],
  ['textMuted', 'surface'],
  ['textFaint', 'bg'],
  ['textFaint', 'surface'],
  ['primary', 'bg'],
  ['primary', 'surface'],
  ['primary', 'surfaceHigh'],
  ['danger', 'bg'],
  ['success', 'bg'],
  ['warning', 'bg'],
  ['accentInk', 'bg'],
  ['mintInk', 'bg'],
  ['sunInk', 'bg'],
  ['skyInk', 'bg'],
  ['lilacInk', 'bg'],
  ['accentInk', 'accentSoft'],
  ['mintInk', 'mintSoft'],
  ['sunInk', 'sunSoft'],
  ['skyInk', 'skySoft'],
  ['lilacInk', 'lilacSoft'],
];

for (const [name, palette] of [
  ['light', lightPalette],
  ['dark', darkPalette],
] as const) {
  for (const [fg, bg] of TEXT_PAIRS) {
    test(`${name}: ${String(fg)} reads on ${String(bg)} (AA 4.5:1)`, () => {
      // A *Soft backdrop is translucent: lay it on the card first, then check
      // the ink against what actually reaches the eye.
      const backdrop: keyof Palette = String(bg).endsWith('Soft') ? 'surface' : bg;
      const ratio = ratioOf(show(palette, fg, backdrop), show(palette, bg, backdrop));
      assert.ok(
        ratio >= 4.5,
        `${name} ${String(fg)} on ${String(bg)} = ${ratio.toFixed(2)}:1, below 4.5:1`
      );
    });
  }

  test(`${name}: the label on a filled primary button is legible`, () => {
    // `white` is defined as "the colour that contrasts with primary", so this
    // also guards the semantic: in dark mode it is near-black, not white.
    const ratio = contrast(palette.white, palette.primary);
    assert.ok(ratio >= 4.5, `${name} white on primary = ${ratio.toFixed(2)}:1`);
  });

  test(`${name}: hero text stays legible across the whole gradient`, () => {
    for (const stop of ['gradientFrom', 'gradientMid', 'gradientTo'] as const) {
      const bg = parse(palette[stop]).rgb;
      const strong = ratioOf(flatten(palette.onDark, palette[stop]), bg);
      const muted = ratioOf(flatten(palette.onDarkMuted, palette[stop]), bg);
      assert.ok(strong >= 4.5, `${name} onDark on ${stop} = ${strong.toFixed(2)}:1`);
      // Secondary hero copy sits at caption size, so it still needs 4.5.
      assert.ok(muted >= 4.5, `${name} onDarkMuted on ${stop} = ${muted.toFixed(2)}:1`);
    }
  });

  test(`${name}: interactive outlines are visible against their surface (3:1)`, () => {
    // 3:1 is the non-text threshold: focus rings, selected-state borders and
    // progress fills are graphics, not prose. Hairline card borders are
    // decorative and deliberately excluded.
    for (const [fg, bg] of [
      ['primary', 'surface'],
      ['primary', 'surfaceHigh'],
      ['text', 'surface'],
    ] as const) {
      const ratio = contrast(palette[fg], palette[bg]);
      assert.ok(ratio >= 3, `${name} ${fg} on ${bg} = ${ratio.toFixed(2)}:1`);
    }
  });
}

/* ---------- both palettes are the same shape ---------- */

test('both palettes define exactly the same keys', () => {
  assert.deepEqual(Object.keys(lightPalette).sort(), Object.keys(darkPalette).sort());
});

test('every palette value is a colour string, and only `isDark` is a boolean', () => {
  for (const palette of [lightPalette, darkPalette]) {
    for (const [key, value] of Object.entries(palette)) {
      if (key === 'isDark') {
        assert.equal(typeof value, 'boolean');
      } else {
        assert.equal(typeof value, 'string', `${key} must be a colour string`);
        assert.match(value as string, /^(#[0-9A-Fa-f]{6}|rgba?\()/, `${key} is not a colour`);
      }
    }
  }
});

test('the dark palette is actually dark and the light one actually light', () => {
  assert.equal(lightPalette.isDark, false);
  assert.equal(darkPalette.isDark, true);
  assert.ok(luminance(parse(lightPalette.bg).rgb) > luminance(parse(darkPalette.bg).rgb));
  // Surfaces lift off the canvas in both themes, or cards would vanish.
  for (const palette of [lightPalette, darkPalette]) {
    assert.notEqual(palette.surface, palette.bg);
    assert.notEqual(palette.surfaceHigh, palette.surface);
  }
});

test('accents keep their hue family at night instead of drifting', () => {
  // sky stays bluer than it is red, lilac stays purple, sun stays warm.
  const channel = (hex: string, i: number) => parse(hex).rgb[i];
  for (const p of [lightPalette, darkPalette]) {
    assert.ok(channel(p.sky, 2) > channel(p.sky, 0), 'sky should be blue-dominant');
    assert.ok(channel(p.lilac, 0) > channel(p.lilac, 1), 'lilac should be red/blue over green');
    assert.ok(channel(p.sun, 0) > channel(p.sun, 2), 'sun should be warm');
  }
});

/* ---------- resolution rules ---------- */

test('an explicit mode ignores the OS, `system` follows it', () => {
  assert.equal(resolvePalette('light', 'dark'), lightPalette);
  assert.equal(resolvePalette('dark', 'light'), darkPalette);
  assert.equal(resolvePalette('system', 'dark'), darkPalette);
  assert.equal(resolvePalette('system', 'light'), lightPalette);
  // A device that reports nothing (web SSR) must not become night by accident.
  assert.equal(resolvePalette('system', null), lightPalette);
});

test('only the three documented modes are accepted from storage', () => {
  assert.deepEqual([...THEME_MODES], ['system', 'light', 'dark']);
  for (const mode of THEME_MODES) assert.ok(isThemeMode(mode));
  for (const junk of ['Dark', 'auto', '', null, undefined, 3, {}, ['dark']]) {
    assert.equal(isThemeMode(junk), false, `${String(junk)} should be rejected`);
  }
});

test('a stored preferences blob without themeMode falls back to system', () => {
  assert.equal(DEFAULT_PREFERENCES.themeMode, 'system');
  const validate = { isKnownLanguage: (id: string) => id === 'es' };
  const legacy = normalizePreferences({ dailyGoalMinutes: 15 }, DEFAULT_PREFERENCES, validate);
  assert.equal(legacy.themeMode, 'system');
  // And a corrupted value is repaired rather than trusted.
  const junk = normalizePreferences({ themeMode: 'neon' }, DEFAULT_PREFERENCES, validate);
  assert.equal(junk.themeMode, 'system');
  const chosen = normalizePreferences({ themeMode: 'dark' }, DEFAULT_PREFERENCES, validate);
  assert.equal(chosen.themeMode, 'dark');
});

/* ---------- no screen can quietly stay light ---------- */

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(entry) ? [full] : [];
  });
}

test('nothing imports the old static `colors` export', () => {
  const offenders: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, file);
    if (rel.startsWith('src/theme/')) continue;
    const source = readFileSync(file, 'utf8');
    const importMatch = source.match(/import\s*\{([^}]*)\}\s*from\s*'@\/theme\/tokens'/);
    if (importMatch && /\bcolors\b/.test(importMatch[1])) offenders.push(rel);
  }
  assert.deepEqual(offenders, [], `these files still import the static palette: ${offenders.join(', ')}`);
});

test('every file that builds a themed StyleSheet also applies it', () => {
  // `createStyles` without the hook would render an empty style object, which
  // type-checks but looks like an unstyled app. Cheap guard against that.
  const offenders: string[] = [];
  for (const file of walk(path.join(root, 'src'))) {
    const rel = path.relative(root, file);
    if (rel.startsWith('src/theme/')) continue;
    if (!file.endsWith('.tsx')) continue;
    const source = readFileSync(file, 'utf8');
    if (source.includes('createStyles = (c: Palette)') && !source.includes('useThemedStyles(createStyles)')) {
      offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, []);
});

test('the theme provider wraps the app once, inside preferences', () => {
  const layout = readFileSync(path.join(root, 'src/app/_layout.tsx'), 'utf8');
  assert.match(layout, /<PreferencesProvider>[\s\S]*<ThemeProvider>[\s\S]*<LearningProvider>/);
  assert.equal((layout.match(/<ThemeProvider>/g) ?? []).length, 1);
  assert.ok(layout.includes('useTheme()'), 'the layout should theme its status bar');
});

test('the app is allowed to follow the system appearance', () => {
  const app = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
  assert.equal(app.userInterfaceStyle, 'automatic');
  // A pinned "light" would make the OS draw dark-native surfaces under our UI.
  assert.equal(app.backgroundColor, undefined, 'a fixed background colour fights dark mode');
});
