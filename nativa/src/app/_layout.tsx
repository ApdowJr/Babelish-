import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { PreferencesProvider } from '@/state/preferences';
import { Logo } from '@/components/Logo';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  return (
    <AuthProvider>
      <PreferencesProvider>
        <StatusBar style="light" />
        <RootNavigator />
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

  if (loading) {
    return (
      <View style={styles.splash}>
        <Logo size={36} />
        <ActivityIndicator color={colors.primarySoft} style={{ marginTop: 24 }} />
      </View>
    );
  }

  const signedIn = Boolean(user);

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
