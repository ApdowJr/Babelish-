import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
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
 * Works with all Supabase Auth recovery callback shapes:
 *   - an active `PASSWORD_RECOVERY` session established via `#access_token=…` or `?code=…`,
 *   - `?token_hash=…&type=recovery` verified in `AuthContext`, or
 *   - an explicit `token` query/path parameter (`/reset-password?token=…` or `/reset-password/<token>`).
 */
export function ResetPasswordForm() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ token?: string | string[]; token_hash?: string | string[] }>();
  const rawToken = params.token ?? params.token_hash;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;
  const {
    user,
    loading,
    isPasswordRecovery,
    authLinkError,
    clearPasswordRecovery,
    resetPasswordWithToken,
    signOut,
  } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const hasRecoveryContext = Boolean(token || user || isPasswordRecovery);
  const displayError = error ?? authLinkError;

  async function handleSubmit() {
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords don’t match.');
      return;
    }
    if (!hasRecoveryContext) {
      setError('This reset link is missing or expired. Request a new one.');
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

  async function handleRequestNewLink() {
    clearPasswordRecovery();
    if (user) {
      await signOut().catch(() => {});
    }
    router.replace('/forgot-password');
  }

  if (loading) {
    return (
      <Screen scroll>
        <View style={styles.doneWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.doneText}>Verifying your reset link…</Text>
        </View>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen scroll>
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark-circle-outline" size={34} color={colors.success} />
          </View>
          <Text style={styles.doneTitle}>Password updated</Text>
          <Text style={styles.doneText}>
            {user
              ? 'Your password has been saved and you’re signed in.'
              : 'Sign in with your new password to get back to learning.'}
          </Text>
          <Button
            label={user ? 'Continue to Babelish' : 'Back to sign in'}
            onPress={() => router.replace(user ? '/' : '/login')}
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

      {displayError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{displayError}</Text>
        </View>
      ) : null}

      {!hasRecoveryContext && !displayError ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="link-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>
            This link is missing its reset code or has expired. Open the newest email, or request a
            new link.
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

      <Button
        label="Set new password"
        onPress={handleSubmit}
        loading={busy}
        disabled={!hasRecoveryContext}
      />

      <Pressable
        onPress={() => void handleRequestNewLink()}
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
