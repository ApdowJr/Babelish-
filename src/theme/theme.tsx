import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { lightPalette, resolvePalette, type Palette, type ThemeMode } from '@/theme/palette';
import { usePreferences } from '@/state/preferences';

/**
 * Light / dark / follow-the-system.
 *
 * The learner's choice lives in preferences (`themeMode`) so it syncs with the
 * rest of their settings; the OS scheme is only consulted when the mode is
 * `system`, and it updates live.
 *
 * Every screen reads colours through `useTheme()` or `useThemedStyles()`;
 * there is no static `colors` export to fall back on, so a screen that forgets
 * the hook fails to compile instead of staying stubbornly light.
 */

type ThemeValue = {
  colors: Palette;
  isDark: boolean;
  /** What the learner picked: 'system' | 'light' | 'dark'. */
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
};

/**
 * The fallback is the daylight palette, not an exception.
 *
 * One component legitimately renders above the provider: Expo Router's
 * route-level `ErrorBoundary`, which replaces the layout (and therefore the
 * providers) when the layout itself throws. A crash screen that crashes is
 * useless, so out here the app degrades to light colours and a no-op setter.
 * Every real screen is inside the provider — `tests/theme.test.ts` pins that.
 */
const FALLBACK: ThemeValue = {
  colors: lightPalette,
  isDark: false,
  mode: 'light',
  setMode: () => {},
};

const ThemeContext = createContext<ThemeValue>(FALLBACK);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { themeMode, setThemeMode } = usePreferences();
  const systemScheme = useColorScheme();

  const value = useMemo<ThemeValue>(() => {
    const colors = resolvePalette(themeMode, systemScheme === 'dark' ? 'dark' : 'light');
    return { colors, isDark: colors.isDark, mode: themeMode, setMode: setThemeMode };
  }, [themeMode, systemScheme, setThemeMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

/**
 * Builds a StyleSheet from the active palette, rebuilding only when the
 * palette identity changes (light ↔ dark, and never on a re-render).
 *
 *   const styles = useThemedStyles(createStyles);
 *   function createStyles(c: Palette) { return StyleSheet.create({ … }) }
 *
 * `factory` must be a module-level function so the memo stays stable.
 */
export function useThemedStyles<T>(factory: (palette: Palette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}
