import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AuthHero } from '@/components/AuthHero';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { LANGUAGES } from '@/data/languages';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { signUp, isDemo } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const passwordLooksGood = password.length >= 8;

  async function handleSignUp() {
    if (name.trim().length < 2) {
      setError('Tell us your name — your tutor will use it.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    if (!passwordLooksGood) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const result = await signUp({ name: name.trim(), email: email.trim(), password });
      // Real Supabase may require email confirmation before a session exists.
      setDoneMessage(result.message ?? 'Account ready — welcome to Babelish!');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (doneMessage) {
    return (
      <Screen scroll>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="mail-unread-outline" size={34} color={colors.accentInk} />
          </View>
          <Text style={styles.doneTitle}>You’re almost in</Text>
          <Text style={styles.doneText}>{doneMessage}</Text>
          <Button
            label="Back to sign in"
            variant="secondary"
            onPress={() => router.replace('/login')}
            style={{ alignSelf: 'stretch', marginTop: spacing.xl }}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <AuthHero
        eyebrow="JOIN BABELISH"
        title="Start learning today."
        subtitle="Create your account to save your progress and build a learning habit at your own pace."
        perks={[`${LANGUAGES.length} languages`, 'Offline lessons', 'Personal progress']}
      />

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <TextField
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="What should your tutor call you?"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
      />
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it once more"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSignUp}
      />

      <View style={styles.requirement}>
        <Ionicons
          name={passwordLooksGood ? 'checkmark-circle' : 'ellipse-outline'}
          size={16}
          color={passwordLooksGood ? colors.success : colors.textFaint}
        />
        <Text style={[styles.requirementText, passwordLooksGood && styles.requirementMet]}>
          At least 8 characters
        </Text>
      </View>

      <Button label="Create account" onPress={handleSignUp} loading={busy} />

      <Text style={styles.legalNote}>
        By creating an account you agree to the{' '}
        <Text
          style={styles.legalLink}
          onPress={() => router.push('/terms')}
          accessibilityRole="link"
          accessibilityLabel="Open Terms of Service"
        >
          Terms of Service
        </Text>{' '}
        and{' '}
        <Text
          style={styles.legalLink}
          onPress={() => router.push('/privacy')}
          accessibilityRole="link"
          accessibilityLabel="Open Privacy Policy"
        >
          Privacy Policy
        </Text>
        .
      </Text>

      {isDemo ? (
        <Text style={styles.demoNote}>
          Demo mode — accounts stay on this device. Configure the Supabase publishable key to use real accounts.
        </Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.replace('/login')} hitSlop={8} accessibilityRole="link">
          <Text style={styles.footerLink}>Sign in</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { ...typography.display, color: c.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: c.textMuted, marginTop: spacing.sm },
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
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.xl,
  },
  requirementText: { ...typography.caption, color: c.textFaint },
  requirementMet: { color: c.success },
  demoNote: {
    ...typography.micro,
    color: c.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  legalNote: {
    ...typography.caption,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
    lineHeight: 18,
  },
  legalLink: {
    color: c.primary,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { ...typography.body, color: c.textMuted },
  footerLink: { ...typography.bodyStrong, color: c.primary },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  doneTitle: { ...typography.title, color: c.text },
  doneText: {
    ...typography.body,
    color: c.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
});
