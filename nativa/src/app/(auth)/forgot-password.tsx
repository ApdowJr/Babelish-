import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <Screen scroll>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="paper-plane-outline" size={30} color={colors.accent} />
          </View>
          <Text style={styles.doneTitle}>Check your inbox</Text>
          <Text style={styles.doneText}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
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
        <Logo size={30} />
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.subtitle}>
          Enter your email and we’ll send you a link to get back in.
        </Text>
      </View>

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
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />

      <Button label="Send reset link" onPress={handleSubmit} loading={busy} />

      {!isSupabaseConfigured ? (
        <Text style={styles.demoNote}>
          Demo mode — password reset needs Supabase keys in .env
        </Text>
      ) : null}

      <Pressable onPress={() => router.replace('/login')} style={styles.back} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={colors.primarySoft} />
            <Text style={styles.backText}>Back to sign in</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { ...typography.display, color: colors.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm, lineHeight: 22 },
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
  demoNote: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
  },
  backText: { ...typography.bodyStrong, color: colors.primarySoft },
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
