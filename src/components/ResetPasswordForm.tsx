import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/context/AuthContext';
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

/**
 * Step 2 of password recovery: set the new password.
 *
 * Managed Auth has no hosted reset page (the auth host answers `400` for
 * `/reset-password/<token>`), so the app must finish the flow. The one-time
 * token arrives from the email link — as a query parameter
 * (`/reset-password?token=…`) or as a path segment (`/reset-password/…`); this
 * screen is mounted for both shapes and `useLocalSearchParams` exposes either
 * as `token`.
 */
export function ResetPasswordForm() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { resetPasswordWithToken } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    if (!token) {
      setError('This reset link is missing its token. Request a new one.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetPasswordWithToken(token, password);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen scroll>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle-outline" size={34} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>Password updated</Text>
          <Text style={styles.doneText}>Sign in with your new password to get back to learning.</Text>
          <Button
            label="Back to sign in"
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
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.subtitle}>Pick something you’ll remember — at least 8 characters.</Text>
      </View>

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!token ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="link-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>
            This link is missing its reset code. Open the newest email, or request a new link.
          </Text>
        </View>
      ) : null}

      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField
        label="Confirm new password"
        value={confirm}
        onChangeText={setConfirm}
        placeholder="Type it once more"
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={handleSubmit}
      />

      <Button label="Set new password" onPress={handleSubmit} loading={busy} />

      <Pressable
        onPress={() => router.replace('/forgot-password')}
        style={styles.back}
        hitSlop={8}
        accessibilityRole="link"
      >
        <Ionicons name="chevron-back" size={16} color={colors.primary} />
        <Text style={styles.backText}>Request a new link</Text>
      </Pressable>
    </Screen>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  header: { marginTop: spacing.xxl, marginBottom: spacing.xl },
  title: { ...typography.display, color: c.text, marginTop: spacing.xxl },
  subtitle: { ...typography.body, color: c.textMuted, marginTop: spacing.sm, lineHeight: 22 },
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
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.xxl,
  },
  backText: { ...typography.bodyStrong, color: c.primary },
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
