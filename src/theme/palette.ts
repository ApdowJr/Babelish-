/**
 * Babelish colour palettes — "warm atlas" in daylight, "night atlas" after dark.
 *
 * Both palettes have exactly the same keys, so a component never branches on
 * the theme; it reads `colors.surface` and gets parchment or deep slate. Only
 * three places are allowed to care which palette is active: the provider, the
 * status bar, and the theme picker in Settings.
 *
 * Rules that keep the dark palette honest:
 *   - Accents keep their meaning (sun = streak, sky = review, lilac = speaking)
 *     and only lose saturation; they never turn into a different hue.
 *   - `onDark*` stays light in both themes: it is text on the forest gradient,
 *     which is dark in both.
 *   - `white` is "the colour that contrasts with `primary`", not a literal.
 *     In dark mode it becomes near-black so a primary-filled chip keeps its
 *     legible label.
 */

export type Palette = {
  isDark: boolean;
  bg: string;
  bgSunken: string;
  surface: string;
  surfaceHigh: string;
  surfaceTint: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  primaryTint: string;
  gradientFrom: string;
  gradientMid: string;
  gradientTo: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  sun: string;
  sunSoft: string;
  sky: string;
  skySoft: string;
  mint: string;
  mintSoft: string;
  lilac: string;
  lilacSoft: string;
  /* Ink for glyphs sitting on the *Soft discs (avatars, badge initials). */
  mintInk: string;
  accentInk: string;
  sunInk: string;
  skyInk: string;
  lilacInk: string;
  text: string;
  textMuted: string;
  textFaint: string;
  onDark: string;
  onDarkMuted: string;
  onDarkFaint: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  white: string;
  black: string;
};

/** Parchment, forest ink, tangerine — the 2.0 palette, unchanged. */
export const lightPalette: Palette = {
  isDark: false,
  bg: '#F7F4ED',
  bgSunken: '#F0ECE2',
  surface: '#FFFFFF',
  surfaceHigh: '#EDF1EA',
  surfaceTint: '#F3F0E7',
  border: '#E4E4D9',
  borderStrong: '#D3D6C8',

  primary: '#0F4C3A',
  primaryPressed: '#0A382B',
  primarySoft: 'rgba(15, 76, 58, 0.10)',
  primaryTint: '#DCEBE3',
  gradientFrom: '#0B3A2C',
  gradientMid: '#1C6852',
  gradientTo: '#22705A',

  accent: '#E9764F',
  accentPressed: '#D2613C',
  accentSoft: 'rgba(233, 118, 79, 0.14)',
  sun: '#F2C14E',
  sunSoft: 'rgba(242, 193, 78, 0.20)',
  sky: '#4E9FC4',
  skySoft: 'rgba(78, 159, 196, 0.14)',
  mint: '#2E8B6F',
  mintSoft: 'rgba(46, 139, 111, 0.14)',
  lilac: '#8C7BC6',
  lilacSoft: 'rgba(140, 123, 198, 0.14)',
  mintInk: '#23704D',
  accentInk: '#AE4321',
  sunInk: '#8A6412',
  skyInk: '#2C6C8B',
  lilacInk: '#5F4E96',

  text: '#15231D',
  textMuted: '#525F57',
  textFaint: '#67736B',
  onDark: '#F4F8F3',
  onDarkMuted: 'rgba(244, 248, 243, 0.86)',
  onDarkFaint: 'rgba(244, 248, 243, 0.60)',

  danger: '#B84242',
  dangerSoft: 'rgba(184, 66, 66, 0.12)',
  success: '#287A55',
  successSoft: 'rgba(40, 122, 85, 0.12)',
  warning: '#96601B',
  warningSoft: 'rgba(150, 96, 27, 0.11)',

  white: '#FFFFFF',
  black: '#15231D',
};

/**
 * Night atlas. The canvas moves to a green-black slate (not pure black: it is
 * a reading app, and #0B0F0D with a hint of forest keeps the parchment feel
 * without the glare). Surfaces lift in three steps so cards still separate.
 *
 * Contrast checked against WCAG AA for body text:
 *   text  #ECF2EC on bg #101512 → ~14.6:1
 *   muted #A8B3AC on bg         → ~7.6:1
 *   faint #7E8A83 on bg         → ~4.6:1 (icons and 11 px labels only)
 */
export const darkPalette: Palette = {
  isDark: true,
  bg: '#101512',
  bgSunken: '#0B0F0D',
  surface: '#181E1A',
  surfaceHigh: '#1F2722',
  surfaceTint: '#1B231E',
  border: '#2A342E',
  borderStrong: '#3A463F',

  // The brand green has to get *lighter* on a dark canvas to stay a brand.
  primary: '#5FBF9B',
  primaryPressed: '#7FD3B2',
  primarySoft: 'rgba(95, 191, 155, 0.14)',
  primaryTint: '#1D3A2F',
  gradientFrom: '#0B2A21',
  gradientMid: '#14483A',
  gradientTo: '#1F6B55',

  accent: '#F08A63',
  accentPressed: '#F5A183',
  accentSoft: 'rgba(240, 138, 99, 0.16)',
  sun: '#F5C968',
  sunSoft: 'rgba(245, 201, 104, 0.16)',
  sky: '#72B8D8',
  skySoft: 'rgba(114, 184, 216, 0.16)',
  mint: '#5FBF9B',
  mintSoft: 'rgba(95, 191, 155, 0.16)',
  lilac: '#A995D9',
  lilacSoft: 'rgba(169, 149, 217, 0.16)',
  mintInk: '#8AD9B4',
  accentInk: '#F6A98C',
  sunInk: '#F3CE7C',
  skyInk: '#9CCFE5',
  lilacInk: '#C5B5EC',

  text: '#ECF2EC',
  textMuted: '#A8B3AC',
  textFaint: '#7E8A83',
  onDark: '#F4F8F3',
  onDarkMuted: 'rgba(244, 248, 243, 0.86)',
  onDarkFaint: 'rgba(244, 248, 243, 0.62)',

  danger: '#E8837F',
  dangerSoft: 'rgba(232, 131, 127, 0.16)',
  success: '#6FC79A',
  successSoft: 'rgba(111, 199, 154, 0.16)',
  warning: '#E0AE68',
  warningSoft: 'rgba(224, 174, 104, 0.16)',

  // "Contrast with primary": a filled primary chip needs dark text at night.
  white: '#0D1512',
  black: '#0B0F0D',
};

export const palettes = { light: lightPalette, dark: darkPalette } as const;

/** What the learner picked. `system` follows the OS and updates live. */
export type ThemeMode = 'system' | 'light' | 'dark';

/** Picker order in Settings: the safe default first, then the two explicit ones. */
export const THEME_MODES: readonly ThemeMode[] = ['system', 'light', 'dark'] as const;

export function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Resolves the effective palette from the stored mode + OS scheme. */
export function resolvePalette(mode: ThemeMode, systemScheme: 'light' | 'dark' | null): Palette {
  if (mode === 'light') return lightPalette;
  if (mode === 'dark') return darkPalette;
  return systemScheme === 'dark' ? darkPalette : lightPalette;
}
