import { router, Stack, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider } from '@/state/preferences';
import { LearningProvider } from '@/state/learning';
import { ProfileProvider } from '@/state/profile';
import { AnalyticsProvider } from '@/state/analytics';
import { SubscriptionProvider } from '@/state/subscription';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <LearningProvider>
          <ProfileProvider>
            <AnalyticsProvider>
              <SubscriptionProvider>
                <StatusBar style="light" />
                <RootNavigator />
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
  const segments = useSegments();

  if (loading) {
    return (
      <View style={styles.splash}>
        <Logo size={36} />
        <ActivityIndicator color={colors.primarySoft} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const signedIn = Boolean(user);
  const inAuthGroup = segments[0] === '(auth)';

  // Explicit auth redirects. Stack.Protected removes guarded screens from the
  // navigator, but on web (SPA export) the implicit guard fallback can leave a
  // logged-out first-time visitor on "/" with nothing to render ("Unmatched
  // Route"). Send both directions to a real route explicitly.
  useEffect(() => {
    if (loading) return;
    if (!signedIn && !inAuthGroup) {
      router.replace('/login');
    } else if (signedIn && inAuthGroup) {
      router.replace('/');
    }
  }, [loading, signedIn, inAuthGroup]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
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
