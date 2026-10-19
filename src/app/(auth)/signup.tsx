import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
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
      setDoneMessage(result.message ?? 'Account ready — welcome to Zelvoca!');
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
            <Ionicons name="mail-unread-outline" size={34} color={colors.accent} />
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
      <View style={styles.header}>
        <Logo size={34} />
        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Two minutes now. Fluency later. 🌍</Text>
      </View>

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

      {isDemo ? (
        <Text style={styles.demoNote}>
          Demo mode — accounts stay on this device. Add the Neon backend URL to use real accounts.
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

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { ...typography.display, color: colors.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
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
  requirement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: -spacing.sm,
    marginBottom: spacing.xl,
  },
  requirementText: { ...typography.caption, color: colors.textFaint },
  requirementMet: { color: colors.success },
  demoNote: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xxl },
  footerText: { ...typography.body, color: colors.textMuted },
  footerLink: { ...typography.bodyStrong, color: colors.primarySoft },
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxxl },
  doneIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  doneTitle: { ...typography.title, color: colors.text },
  doneText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xl,
    lineHeight: 22,
  },
});
