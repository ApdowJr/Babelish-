/**
 * Design tokens — the single source of truth for Babelish's look.
 * Dark, calm, and premium: deep indigo canvas, violet primary, teal accent.
 */
export const colors = {
  bg: '#0B1020',
  surface: '#151C30',
  surfaceHigh: '#1D2740',
  border: '#273252',

  primary: '#6C5CE7',
  primaryPressed: '#5A4BD1',
  primarySoft: 'rgba(108, 92, 231, 0.16)',
  gradientFrom: '#6C5CE7',
  gradientTo: '#8B7CFF',

  accent: '#00D1B2',
  accentSoft: 'rgba(0, 209, 178, 0.14)',

  text: '#F2F5FC',
  textMuted: '#98A2BE',
  textFaint: '#5F6B8C',

  danger: '#FF6B6B',
  dangerSoft: 'rgba(255, 107, 107, 0.12)',
  success: '#2ED573',
  successSoft: 'rgba(46, 213, 115, 0.12)',
  warning: '#FFC542',

  white: '#FFFFFF',
  black: '#000000',
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
