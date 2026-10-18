import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import { usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { GOAL_OPTIONS, INTEREST_OPTIONS, toggleChip, useProfile } from '@/state/profile';
import { getLanguage } from '@/data/languages';
import { isAIConfigured } from '@/lib/ai';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isNeonConfigured } from '@/lib/neon';
import { colors, radii, spacing, typography } from '@/theme/tokens';

function StatusDot({ ok }: { ok: boolean }) {
  return <View style={[styles.dot, { backgroundColor: ok ? colors.success : colors.warning }]} />;
}

/** Native-language chips for the profile editor (English + all 10 targets). */
const NATIVE_CHOICES = ['en', 'es', 'pt', 'fr', 'de', 'ar', 'zh', 'hi', 'ja', 'ru', 'sw'];

function nativeLabel(id: string): string {
  if (id === 'en') return 'English';
  return getLanguage(id).nativeName;
}

export default function ProfileScreen() {
  const { user, signOut, isDemo, isNeon } = useAuth();
  const { targetLanguageId, nativeLanguageId, setNativeLanguage } = usePreferences();
  const { xp, level, lessonsCompleted, wordsMastered, dueCount, lastSyncedAt } = useLearning();
  const { profile, updateProfile } = useProfile();
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
              {isDemo ? 'Demo account' : isNeon ? 'Neon account' : 'Verified account'}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>LEARNING PROFILE</Text>
      <View style={styles.group}>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>What should your tutor call you?</Text>
          <TextInput
            style={styles.fieldInput}
            value={profile.displayName}
            onChangeText={(text) => updateProfile({ displayName: text })}
            placeholder={user?.displayName ?? 'Your name'}
            placeholderTextColor={colors.textFaint}
            autoCapitalize="words"
            accessibilityLabel="Display name for your tutor"
          />
        </View>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>What do you do?</Text>
          <TextInput
            style={styles.fieldInput}
            value={profile.job}
            onChangeText={(text) => updateProfile({ job: text })}
            placeholder="e.g. a nurse, a student, a chef"
            placeholderTextColor={colors.textFaint}
            accessibilityLabel="Your job or studies"
          />
        </View>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>You’re into…</Text>
          <View style={styles.chipWrap}>
            {INTEREST_OPTIONS.map((interest) => {
              const on = profile.interests.includes(interest);
              return (
                <Pressable
                  key={interest}
                  onPress={() => updateProfile({ interests: toggleChip(profile.interests, interest) })}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{interest}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>You’re learning for…</Text>
          <View style={styles.chipWrap}>
            {GOAL_OPTIONS.map((goal) => {
              const on = profile.goals.includes(goal);
              return (
                <Pressable
                  key={goal}
                  onPress={() => updateProfile({ goals: toggleChip(profile.goals, goal) })}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{goal}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>You speak…</Text>
          <View style={styles.chipWrap}>
            {NATIVE_CHOICES.filter((id) => id !== targetLanguageId).map((id) => {
              const on = nativeLanguageId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setNativeLanguage(id)}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
                    {nativeLabel(id)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Text style={styles.profileHint}>
          Your tutor uses this to pick examples from your real life. Saved on this device.
        </Text>
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
          <Text style={styles.rowLabel}>Level</Text>
          <Text style={styles.rowValue}>
            {level} · {xp} XP
          </Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Lessons completed (70%+)</Text>
          <Text style={styles.rowValue}>{lessonsCompleted}</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Words mastered</Text>
          <Text style={styles.rowValue}>{wordsMastered}</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Words due for review</Text>
          <Text style={[styles.rowValue, dueCount > 0 && { color: colors.warning }]}>{dueCount}</Text>
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
            <StatusDot ok={isSupabaseConfigured || isNeonConfigured} />
            <Text style={styles.rowLabel}>Accounts</Text>
          </View>
          <Text style={styles.rowValue}>
            {isNeon ? 'Neon Auth' : isSupabaseConfigured ? 'Supabase' : 'On-device'}
          </Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <StatusDot ok={Boolean(lastSyncedAt)} />
            <Text style={styles.rowLabel}>Progress sync</Text>
          </View>
          <Text style={styles.rowValue}>
            {isNeon
              ? lastSyncedAt
                ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : 'Syncing…'
              : 'On-device only'}
          </Text>
        </View>
      </View>
      <Text style={styles.statusNote}>
        {isNeon
          ? isAIConfigured
            ? 'Everything is connected. Go say hi to your tutor in the Speak tab.'
            : 'Neon backend connected: real accounts + cloud progress sync. The AI tutor stays in demo mode until an AI key is added to .env.'
          : isDemo || !isAIConfigured
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
  profileField: { paddingVertical: spacing.md },
  fieldLabel: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.sm },
  fieldInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  choiceChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceHigh,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  choiceChipOn: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  choiceText: { ...typography.caption, color: colors.textMuted },
  choiceTextOn: { color: colors.text, fontWeight: '700' },
  profileHint: {
    ...typography.micro,
    color: colors.textFaint,
    paddingVertical: spacing.md,
    lineHeight: 16,
  },
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
