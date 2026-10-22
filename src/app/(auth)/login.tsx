import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AuthHero } from '@/components/AuthHero';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { signIn, isDemo } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleDemo() {
    setError(null);
    setBusy(true);
    try {
      await signIn('explorer@babelish.app', 'babelish-demo');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the demo.');
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      // On success the auth guard swaps in the app automatically.
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen scroll>
      <AuthHero
        eyebrow="WELCOME BACK"
        title="Speak like a native."
        subtitle="Real conversations, real voices, and a tutor that never switches to your language."
        perks={['24 languages', 'Every lesson free', 'Works offline']}
      />

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={handleSignIn}
      />

      <Pressable
        onPress={() => router.push('/forgot-password')}
        hitSlop={8}
        accessibilityRole="link"
        style={styles.forgot}
      >
        <Text style={styles.forgotText}>Forgot password?</Text>
      </Pressable>

      <Button label="Sign in" onPress={handleSignIn} loading={busy} />

      {isDemo ? (
        <>
          <Button
            label="Explore the demo — no email"
            variant="secondary"
            onPress={handleDemo}
            disabled={busy}
            style={styles.demoButton}
          />
          <Text style={styles.demoNote}>
            Demo build: accounts, progress and the phrasebook stay on this device. No email is
            sent and nothing leaves your phone. Any email + 8-character password also works.
          </Text>
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>New to Babelish? </Text>
        <Pressable onPress={() => router.push('/signup')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.footerLink}>Create an account</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { ...typography.caption, color: colors.danger, flex: 1 },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.xl },
  forgotText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  demoButton: { marginTop: spacing.md },
  demoNote: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.bodyStrong, color: colors.primary },
});
