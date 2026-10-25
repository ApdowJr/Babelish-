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
import { radii, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { usePreferences } from '@/state/preferences';
import { translateUi } from '@/lib/interfaceLocalization';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { interfaceLanguage } = usePreferences();
  const t = (value: string) => translateUi(value, interfaceLanguage);
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
            <Ionicons name="paper-plane-outline" size={30} color={colors.accentInk} />
          </View>
          <Text style={styles.doneTitle}>{t('Check your inbox')}</Text>
          <Text style={styles.doneText}>
            If an account exists for {email.trim()}, a reset link is on its way.
          </Text>
          <Button
            label={t("Back to sign in")}
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
        <Text style={styles.title}>{t('Reset your password')}</Text>
        <Text style={styles.subtitle}>
          {t('Enter your email and we’ll send you a link to get back in.')}
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={colors.danger} />
          <Text style={styles.errorText}>{error}</Text>
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
        returnKeyType="send"
        onSubmitEditing={handleSubmit}
      />

      <Button label={t("Send reset link")} onPress={handleSubmit} loading={busy} />

      {!isSupabaseConfigured ? (
        <Text style={styles.demoNote}>
          {t('Demo mode — password reset needs the Supabase publishable key in .env')}
        </Text>
      ) : null}

      <Pressable
        onPress={() => router.replace('/login')}
        style={styles.back}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t("Back to sign in")}
      >
        <Ionicons name="chevron-back" size={16} color={colors.primary} />
            <Text style={styles.backText}>{t('Back to sign in')}</Text>
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
  demoNote: {
    ...typography.micro,
    color: c.textFaint,
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
