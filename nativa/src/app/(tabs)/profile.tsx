import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { usePreferences, languageName } from '@/state/preferences';
import { getLanguage } from '@/data/languages';
import { isAIConfigured } from '@/lib/ai';
import { isSupabaseConfigured } from '@/lib/supabase';
import { colors, radii, spacing, typography } from '@/theme/tokens';

function StatusDot({ ok }: { ok: boolean }) {
  return <View style={[styles.dot, { backgroundColor: ok ? colors.success : colors.warning }]} />;
}

export default function ProfileScreen() {
  const { user, signOut, isDemo } = useAuth();
  const { targetLanguageId, nativeLanguageId } = usePreferences();
  const target = getLanguage(targetLanguageId);

  const initials = (user?.displayName ?? 'L')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen scroll>
      <Text style={styles.title}>Profile</Text>

      <View style={styles.profileCard}>
        <LinearGradient
          colors={[colors.gradientFrom, colors.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatar}
        >
          <Text style={styles.avatarText}>{initials}</Text>
        </LinearGradient>
        <View style={styles.flex}>
          <Text style={styles.name}>{user?.displayName ?? 'Learner'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={[styles.badge, isDemo ? styles.badgeWarning : styles.badgeSuccess]}>
            <Text style={[styles.badgeText, { color: isDemo ? colors.warning : colors.success }]}>
              {isDemo ? 'Demo account' : 'Verified account'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>LEARNING</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Target language</Text>
          <Text style={styles.rowValue}>
            {target.flag} {target.name}
          </Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Native language</Text>
          <Text style={styles.rowValue}>{languageName(nativeLanguageId)}</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Change target</Text>
          <Text style={styles.rowAction}>Learn tab →</Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>APP STATUS</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <StatusDot ok={isAIConfigured} />
            <Text style={styles.rowLabel}>AI tutor</Text>
          </View>
          <Text style={styles.rowValue}>{isAIConfigured ? 'Connected' : 'Demo mode'}</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <StatusDot ok={isSupabaseConfigured} />
            <Text style={styles.rowLabel}>Accounts</Text>
          </View>
          <Text style={styles.rowValue}>{isSupabaseConfigured ? 'Supabase' : 'On-device'}</Text>
        </View>
      </View>
      <Text style={styles.statusNote}>
        {isDemo || !isAIConfigured
          ? 'Connect real services by copying .env.example to .env and adding your Supabase + AI keys, then restart the dev server.'
          : 'Everything is connected. Go say hi to your tutor in the Speak tab.'}
      </Text>

      <Button
        label="Sign out"
        variant="danger"
        onPress={() => {
          signOut();
        }}
        style={{ marginTop: spacing.xl }}
      />

      <View style={styles.footer}>
        <Ionicons name="globe-outline" size={14} color={colors.textFaint} />
        <Text style={styles.footerText}>Nativa v1.0.0 · 2027 preview</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.title, color: colors.text, marginTop: spacing.lg },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.white, fontSize: 22 },
  name: { ...typography.heading, color: colors.text },
  email: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginTop: spacing.sm,
  },
  badgeSuccess: { backgroundColor: colors.successSoft },
  badgeWarning: { backgroundColor: 'rgba(255, 197, 66, 0.12)' },
  badgeText: { ...typography.micro },
  sectionLabel: { ...typography.micro, color: colors.textFaint, marginTop: spacing.xl, marginBottom: spacing.md },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: spacing.md,
  },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.bodyStrong, color: colors.text },
  rowAction: { ...typography.bodyStrong, color: colors.primarySoft },
  rowDivider: { height: 1, backgroundColor: colors.border },
  statusNote: {
    ...typography.caption,
    color: colors.textFaint,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.micro, color: colors.textFaint },
});
