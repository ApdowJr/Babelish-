import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider, usePreferences } from '@/state/preferences';
import { LearningProvider } from '@/state/learning';
import { ProfileProvider } from '@/state/profile';
import { AnalyticsProvider } from '@/state/analytics';
import { SubscriptionProvider } from '@/state/subscription';
import { AlertProvider } from '@/components/AlertProvider';
import { CrashScreen, ErrorBoundary as ScreenBoundary } from '@/components/ErrorBoundary';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme/tokens';
import { validateConfigurationAtStartup } from '@/lib/config';

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
  const { ready: prefsReady, onboarded } = usePreferences();
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

  if (loading || !prefsReady) {
    return (
      <View style={styles.splash}>
        <Logo size={36} />
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
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
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
