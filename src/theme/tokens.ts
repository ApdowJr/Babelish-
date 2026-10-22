/**
 * Static, theme-independent tokens — spacing, radii, type, shadows, layout.
 *
 * Colours live in `palette.ts` (both themes) and reach components through
 * `useTheme()` / `useThemedStyles()` in `theme.tsx`. Only the gradient presets
 * below are fixed, because a brand gradient is the same brand in both themes.
 */
import { lightPalette } from './palette';

export type { Palette } from './palette';
export { darkPalette, lightPalette, resolvePalette } from './palette';

/**
 * There is deliberately no `colors` export here.
 *
 * It used to be the palette, and every screen imported it — which is exactly
 * why dark mode was impossible: a StyleSheet built at import time cannot
 * follow a runtime choice. Components now take colours from `useTheme()` /
 * `useThemedStyles()`, and the compiler enforces it. The only static palette
 * left is `lightPalette`, used by the gradients below and by `<View>`s that
 * render before the provider mounts.
 */

export const gradients = {
  hero: [lightPalette.gradientFrom, lightPalette.gradientMid, lightPalette.gradientTo] as const,
  heroShort: [lightPalette.gradientFrom, lightPalette.gradientTo] as const,
  sunrise: ['#EF8055', '#F5B36A'] as const,
  mint: ['#DCEBE3', '#F7F4ED'] as const,
  night: ['#122C24', '#0B3A2C'] as const,
  sky: ['#E7F2F7', '#F7F4ED'] as const,
  lilac: ['#EFEBF9', '#F7F4ED'] as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radii = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const typography = {
  displayXL: { fontSize: 38, fontWeight: '800' as const, letterSpacing: -1.2 },
  display: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.9 },
  title: { fontSize: 25, fontWeight: '800' as const, letterSpacing: -0.5 },
  heading: { fontSize: 19, fontWeight: '700' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '700' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '700' as const, letterSpacing: 1.1 },
} as const;

export const shadows = {
  card: {
    shadowColor: '#1B2A22',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  raised: {
    shadowColor: '#12241C',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  hero: {
    shadowColor: lightPalette.primary,
    shadowOpacity: 0.28,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 14 },
    elevation: 8,
  },
  floating: {
    shadowColor: '#101F19',
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const;

export const layout = {
  screenPadding: 22,
  maxContentWidth: 620,
  tabBarHeight: 68,
} as const;
