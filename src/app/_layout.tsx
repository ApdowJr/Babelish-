import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider, usePreferences } from '@/state/preferences';
import { LearningProvider } from '@/state/learning';
import { ProfileProvider } from '@/state/profile';
import { AnalyticsProvider } from '@/state/analytics';
import { SubscriptionProvider } from '@/state/subscription';
import { AlertProvider } from '@/components/AlertProvider';
import { CrashScreen, ErrorBoundary as ScreenBoundary } from '@/components/ErrorBoundary';
import { AnimatedSplash } from '@/components/AnimatedSplash';
import { colors } from '@/theme/tokens';
import { validateConfigurationAtStartup } from '@/lib/config';

// Keep the native splash up until our own animated one has painted: the two
// use the same mark on the same forest plate, so the hand-off is invisible.
// (Web has no native splash; expo-splash-screen is a no-op there.)
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync().catch(() => {});
  SplashScreen.setOptions({ duration: 220, fade: true });
}

export default function RootLayout() {
  // One-shot, secret-free config validation: warns in the console exactly
  // which service will fall back (demo tutor, demo accounts) and how to fix it.
  useEffect(() => {
    validateConfigurationAtStartup();
  }, []);

  return (
    <AuthProvider>
      <PreferencesProvider>
        <LearningProvider>
          <ProfileProvider>
            <AnalyticsProvider>
              <SubscriptionProvider>
                <AlertProvider>
                  <StatusBar style="dark" />
                  {/* Keeps a render error on one screen instead of a blank app.
                      Nothing here touches storage or auth: progress survives. */}
                  <ScreenBoundary onHome={() => router.replace('/')}>
                    <RootNavigator />
                  </ScreenBoundary>
                </AlertProvider>
              </SubscriptionProvider>
            </AnalyticsProvider>
          </ProfileProvider>
        </LearningProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}

/**
 * Auth gate: the signed-in learner gets the app (tabs + language detail),
 * everyone else gets the auth stack. Guards redirect automatically.
 */
function RootNavigator() {
  const { user, loading } = useAuth();
  const { ready: prefsReady, onboarded, reduceMotion } = usePreferences();
  const [splashDone, setSplashDone] = useState(false);
  const booting = loading || !prefsReady;
  const segments = useSegments();

  const signedIn = Boolean(user);
  const inAuthGroup = segments[0] === '(auth)';
  const inOnboarding = segments[0] === 'onboarding';

  // Explicit auth redirects. Stack.Protected removes guarded screens from the
  // navigator, but on web (SPA export) the implicit guard fallback can leave a
  // logged-out first-time visitor on "/" with nothing to render ("Unmatched
  // Route"). Send both directions to a real route explicitly. Declared before
  // any early return so the hook order is identical on every render.
  useEffect(() => {
    if (loading || !prefsReady) return;
    if (!signedIn && !inAuthGroup) {
      router.replace('/login');
    } else if (signedIn && !onboarded && !inOnboarding) {
      router.replace('/onboarding');
    } else if (signedIn && onboarded && (inAuthGroup || inOnboarding)) {
      router.replace('/');
    }
  }, [loading, prefsReady, signedIn, onboarded, inAuthGroup, inOnboarding]);

  return (
    <View style={styles.root}>
      {booting ? null : (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="language/[id]"
          options={{
            headerShown: true,
            title: '',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="lesson/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="review"
          options={{
            headerShown: true,
            title: 'Daily review',
            headerStyle: { backgroundColor: colors.bg },
            headerTintColor: colors.text,
            headerShadowVisible: false,
          }}
        />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
      )}
      {/* Covers the boot window, then fades out over the mounted app. */}
      {splashDone ? null : (
        <AnimatedSplash
          ready={!booting}
          reduceMotion={reduceMotion}
          onDone={() => setSplashDone(true)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});

/**
 * Expo Router's route-level boundary: a crash inside the layout itself (before
 * the screen boundary exists) still lands on the same readable screen. `retry`
 * remounts the segment; progress is untouched either way.
 */
export function ErrorBoundary({
  error,
  retry,
}: {
  error: Error;
  retry: () => Promise<void> | void;
}) {
  return (
    <CrashScreen
      error={error}
      onRetry={() => {
        void retry();
      }}
      onHome={() => router.replace('/')}
    />
  );
}
