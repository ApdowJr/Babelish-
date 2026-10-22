import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { BrandMark } from '@/components/BrandMark';
import { gradients, spacing, typography, type Palette } from '@/theme/tokens';
import { useThemedStyles } from '@/theme/theme';

/**
 * The first second of the app.
 *
 * The native splash (app.json → expo-splash-screen) shows the same mark on the
 * same forest plate, so this component continues that frame instead of
 * replacing it: the mark settles, the wordmark rises, and the whole plate fades
 * out once auth + preferences are actually ready. The minimum on-screen time
 * exists so a warm start does not flash a half-drawn frame.
 *
 * Motion is decoration: with "Reduce motion" on, nothing moves except the
 * fade-out, and the timing is identical.
 */

const MIN_VISIBLE_MS = 900;
const EXIT_MS = 380;

export function AnimatedSplash({
  ready,
  reduceMotion = false,
  onDone,
}: {
  /** App state (auth + preferences) has finished loading. */
  ready: boolean;
  reduceMotion?: boolean;
  onDone: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  // Animated.Value lives in state-like storage, not a ref: the React Compiler
  // lint rule treats a ref read as a render-time side effect.
  const [markOpacity] = useState(() => new Animated.Value(0));
  const [markScale] = useState(() => new Animated.Value(reduceMotion ? 1 : 0.86));
  const [copyOpacity] = useState(() => new Animated.Value(0));
  const [copyShift] = useState(() => new Animated.Value(reduceMotion ? 0 : 14));
  const [barWidth] = useState(() => new Animated.Value(0));
  const [plateOpacity] = useState(() => new Animated.Value(1));
  const [minElapsed, setMinElapsed] = useState(false);
  const done = useRef(false);

  // Hand off from the native splash as soon as this frame exists. On web there
  // is no native splash, and the module is a no-op there.
  useEffect(() => {
    if (Platform.OS !== 'web') SplashScreen.hideAsync().catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    if (reduceMotion) {
      Animated.parallel([
        Animated.timing(markOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(copyOpacity, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(barWidth, { toValue: 1, duration: MIN_VISIBLE_MS, useNativeDriver: false }),
      ]).start();
      return () => clearTimeout(timer);
    }
    Animated.sequence([
      Animated.parallel([
        Animated.timing(markOpacity, {
          toValue: 1,
          duration: 320,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(markScale, {
          toValue: 1,
          friction: 7,
          tension: 70,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(copyOpacity, {
          toValue: 1,
          duration: 340,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(copyShift, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]).start();
    Animated.timing(barWidth, {
      toValue: 1,
      duration: MIN_VISIBLE_MS + 500,
      easing: Easing.inOut(Easing.quad),
      // Width is not animatable natively; the bar is a transform-safe scaleX
      // below instead, so this driver flag only affects the fallback.
      useNativeDriver: false,
    }).start();
    return () => clearTimeout(timer);
  }, [barWidth, copyOpacity, copyShift, markOpacity, markScale, reduceMotion]);

  useEffect(() => {
    if (!ready || !minElapsed || done.current) return;
    done.current = true;
    Animated.timing(plateOpacity, {
      toValue: 0,
      duration: EXIT_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDone());
  }, [minElapsed, onDone, plateOpacity, ready]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: plateOpacity }]}
      accessibilityRole="progressbar"
      accessibilityLabel="Babelish is starting"
      accessibilityViewIsModal
      accessible
    >
      <LinearGradient colors={gradients.hero} style={StyleSheet.absoluteFill} />
      <View style={styles.halo} />
      <View style={styles.center}>
        <Animated.View
          style={{ opacity: markOpacity, transform: [{ scale: markScale }] }}
          accessibilityElementsHidden
        >
          <BrandMark size={96} tone="light" />
        </Animated.View>
        <Animated.View
          style={[
            styles.copy,
            { opacity: copyOpacity, transform: [{ translateY: copyShift }] },
          ]}
        >
          <Text style={styles.wordmark}>Babelish</Text>
          <Text style={styles.tagline}>Speak from day one</Text>
        </Animated.View>
      </View>
      <View style={styles.track} accessibilityElementsHidden>
        <Animated.View
          style={[
            styles.fill,
            {
              width: barWidth.interpolate({
                inputRange: [0, 1],
                outputRange: ['8%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </Animated.View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.gradientFrom },
  halo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(244, 248, 243, 0.05)',
  },
  center: { alignItems: 'center', gap: spacing.xl },
  copy: { alignItems: 'center', gap: spacing.xs },
  wordmark: {
    ...typography.display,
    color: c.onDark,
    letterSpacing: -1.1,
  },
  tagline: {
    ...typography.caption,
    color: c.onDarkMuted,
    letterSpacing: 0.3,
  },
  track: {
    position: 'absolute',
    bottom: 64,
    width: 96,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(244, 248, 243, 0.16)',
    overflow: 'hidden',
  },
  fill: { height: 3, borderRadius: 2, backgroundColor: c.accent },
});
