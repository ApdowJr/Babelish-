/** Babelish design tokens: warm, editorial, and grounded in conversation. */
export const colors = {
  bg: '#FAF7F0',
  surface: '#FFFFFF',
  surfaceHigh: '#E5EEE6',
  border: '#E6E8E1',

  primary: '#174D3B',
  primaryPressed: '#10382D',
  primarySoft: 'rgba(23, 77, 59, 0.12)',
  gradientFrom: '#174D3B',
  gradientTo: '#2D7158',

  accent: '#E77C5B',
  accentSoft: 'rgba(231, 124, 91, 0.14)',

  text: '#202923',
  textMuted: '#69736B',
  textFaint: '#89928B',

  danger: '#B84242',
  dangerSoft: 'rgba(184, 66, 66, 0.12)',
  success: '#287A55',
  successSoft: 'rgba(40, 122, 85, 0.12)',
  warning: '#A66A22',

  white: '#FFFFFF',
  black: '#202923',
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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 15, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, fontWeight: '600' as const },
  caption: { fontSize: 13, fontWeight: '400' as const },
  micro: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.4 },
} as const;
