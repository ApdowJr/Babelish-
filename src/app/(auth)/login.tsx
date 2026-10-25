import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AuthHero } from '@/components/AuthHero';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { LANGUAGES } from '@/data/languages';
import { usePreferences } from '@/state/preferences';
import { translateUi } from '@/lib/interfaceLocalization';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { interfaceLanguage } = usePreferences();
  const t = (value: string) => translateUi(value, interfaceLanguage);
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
        eyebrow={t("WELCOME BACK")}
        title={t("Welcome back.")}
        subtitle={t("Pick up where you left off and keep building your language skills.")}
        perks={[`${LANGUAGES.length} languages`, 'Offline lessons', 'Your progress, saved']}
      />

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{t(error)}</Text>
        </View>
      ) : null}

      <TextField
        label={t("Email")}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
      />
      <TextField
        label={t("Password")}
        value={password}
        onChangeText={setPassword}
        placeholder={t("At least 8 characters")}
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
        <Text style={styles.forgotText}>{t("Forgot password?")}</Text>
      </Pressable>

      <Button label={t("Sign in")} onPress={handleSignIn} loading={busy} />

      {isDemo ? (
        <>
          <Button
            label={t("Explore the demo — no email")}
            variant="secondary"
            onPress={handleDemo}
            disabled={busy}
            style={styles.demoButton}
          />
          <Text style={styles.demoNote}>
            {t('Demo build: accounts, progress and the phrasebook stay on this device. No email is sent and nothing leaves your phone. Any email + 8-character password also works.')}
          </Text>
        </>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>{t("New to Babelish? ")}</Text>
        <Pressable onPress={() => router.push('/signup')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.footerLink}>{t("Create an account")}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.dangerSoft,
    borderRadius: radii.sm,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  errorText: { ...typography.caption, color: c.danger, flex: 1 },
  forgot: { alignSelf: 'flex-end', marginBottom: spacing.xl },
  forgotText: { ...typography.caption, color: c.primary, fontWeight: '600' },
  demoButton: { marginTop: spacing.md },
  demoNote: {
    ...typography.micro,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.body, color: c.textMuted },
  footerLink: { ...typography.bodyStrong, color: c.primary },
});
