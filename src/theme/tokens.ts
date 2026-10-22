/**
 * Babelish 2.0 design tokens — "warm atlas".
 *
 * A travel-journal palette: parchment paper, deep forest ink, tangerine
 * highlights and a few bright accents that only ever mean one thing
 * (sun = streak, sky = reviews, lilac = speaking). Every screen composes
 * from these tokens, so a single change re-skins the whole app.
 */
export const colors = {
  // ── Canvas ──────────────────────────────────────────────────────────
  bg: '#F7F4ED',
  bgSunken: '#F0ECE2',
  surface: '#FFFFFF',
  surfaceHigh: '#EDF1EA',
  surfaceTint: '#F3F0E7',
  border: '#E4E4D9',
  borderStrong: '#D3D6C8',

  // ── Brand ───────────────────────────────────────────────────────────
  primary: '#0F4C3A',
  primaryPressed: '#0A382B',
  primarySoft: 'rgba(15, 76, 58, 0.10)',
  primaryTint: '#DCEBE3',
  gradientFrom: '#0B3A2C',
  gradientMid: '#1C6852',
  gradientTo: '#2E8B6F',

  // ── Accents (one meaning each, never decorative noise) ──────────────
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

  // ── Text ────────────────────────────────────────────────────────────
  text: '#15231D',
  textMuted: '#5E6B63',
  textFaint: '#8B968E',
  onDark: '#F4F8F3',
  onDarkMuted: 'rgba(244, 248, 243, 0.74)',
  onDarkFaint: 'rgba(244, 248, 243, 0.52)',

  // ── Semantic ────────────────────────────────────────────────────────
  danger: '#B84242',
  dangerSoft: 'rgba(184, 66, 66, 0.12)',
  success: '#287A55',
  successSoft: 'rgba(40, 122, 85, 0.12)',
  warning: '#A66A22',
  warningSoft: 'rgba(166, 106, 34, 0.12)',

  white: '#FFFFFF',
  black: '#15231D',
} as const;

export const gradients = {
  hero: [colors.gradientFrom, colors.gradientMid, colors.gradientTo] as const,
  heroShort: [colors.gradientFrom, colors.gradientTo] as const,
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
    shadowColor: colors.primary,
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
