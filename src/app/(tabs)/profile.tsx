import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { showAlert } from '@/lib/alert';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { useAuth } from '@/context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { GOAL_OPTIONS, INTEREST_OPTIONS, toggleChip, useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { useSubscription } from '@/state/subscription';
import { getLanguage } from '@/data/languages';
import { fetchAiStatus, isAIConfigured, type AiStatus } from '@/lib/ai';
import { isSupabaseConfigured } from '@/lib/supabase';
import { isNeonConfigured, NEON_API_URL } from '@/lib/neon';
import { levelForXp } from '@/lib/xp';
import { buildPack, formatPackSize, OFFLINE_CAPABILITIES } from '@/lib/offline';
import { FAMILY_SEATS, referralCode } from '@/lib/plans';
import { buildDataExport, LOCAL_DATA_KEYS } from '@/lib/privacy';
import { deleteAccount } from '@/lib/neonApi';
import { REMINDER_SLOTS, slotKey } from '@/lib/reminder';
import { cancelDailyReminder, scheduleDailyReminder } from '@/lib/notifications';
import { loadCurriculum } from '@/lib/curriculum/store';
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
  const { user, signOut, isDemo, isNeon, getAccessToken } = useAuth();
  const {
    targetLanguageId,
    nativeLanguageId,
    setNativeLanguage,
    reminderKey,
    setReminderKey,
  } = usePreferences();
  const { lessonsCompleted, wordsMastered, dueCount, lastSyncedAt, progress, vocab } = useLearning();
  const { profile, updateProfile } = useProfile();
  const { state: analytics } = useAnalytics();
  const { plan, redeem, resetToFree } = useSubscription();
  const target = getLanguage(targetLanguageId);

  const lifetimeXp = analytics.xp.lifetime;
  const level = levelForXp(lifetimeXp);
  const myReferralCode = referralCode(user?.id ?? 'babelish-demo');

  // Honest AI status: probe the backend proxy (its key lives server-side)
  // and combine with any direct EXPO_PUBLIC_AI_* config — the status rows
  // reflect what actually answers, not what a bundle merely contains.
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const jwt = await getAccessToken().catch(() => null);
      const status = await fetchAiStatus({ apiBase: NEON_API_URL, jwt });
      if (!cancelled) setAiStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  const tutorLive = isAIConfigured || aiStatus?.chat === true;
  const voiceLive = isAIConfigured || aiStatus?.stt === true;
  const aiSource = aiStatus?.source ?? (isAIConfigured ? 'direct' : 'none');

  // Target-language pack stats — content is bundled, so this is instant
  // and purely local (no download, no network, ever).
  const [pack, setPack] = useState<{ chapters: number; exercises: number; kb: number } | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadCurriculum(targetLanguageId)
      .then((chapters) => {
        if (cancelled) return;
        const exercises = chapters.reduce(
          (n, chapter) => n + chapter.lessons.reduce((m, lesson) => m + lesson.exercises.length, 0),
          0
        );
        setPack(buildPack({ languageId: targetLanguageId, chapters: chapters.length, exercises, phrases: 0 }));
      })
      .catch(() => {
        if (!cancelled) setPack(null);
      });
    return () => {
      cancelled = true;
    };
  }, [targetLanguageId]);

  async function pickReminder(hour: number, minute: number, turningOff: boolean) {
    if (turningOff) {
      await cancelDailyReminder();
      setReminderKey(null);
      return;
    }
    const slot = { hour, minute, label: '', icon: '' };
    // Copy is deliberately streak-free: a daily repeat must stay true all week.
    const result = await scheduleDailyReminder(slot, {
      languageName: target.name,
      streak: 0,
      name: profile.displayName || undefined,
    });
    if (result === 'scheduled') {
      setReminderKey(slotKey(hour, minute));
    } else if (result === 'denied') {
      showAlert(
        'Notifications blocked',
        'Allow notifications for Babelish in your system settings, then pick a time again.'
      );
    } else {
      showAlert('Reminder unavailable', 'This device could not schedule the reminder.');
    }
  }

  function shareReferral() {
    void Share.share({
      message: `I'm learning ${target.name} with Babelish 🌍 — use my code ${myReferralCode} when you sign up and we both get a premium month at launch. https://babelish.app`,
    }).catch(() => {
      // sharing dismissed — nothing to do
    });
  }

  function exportMyData() {
    void Share.share({
      title: 'Babelish data export',
      message: buildDataExport({
        profile,
        preferences: { targetLanguageId, nativeLanguageId, reminderKey },
        progress,
        vocab,
        analytics,
      }),
    }).catch(() => {
      // sharing dismissed — nothing to do
    });
  }

  function deleteMyAccount() {
    showAlert(
      'Delete account?',
      'This removes your profile, progress, vocabulary, XP and reports from this device and from Babelish servers. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              let serverIssue = false;
              try {
                if (isNeon) {
                  const jwt = await getAccessToken();
                  if (jwt) {
                    const result = await deleteAccount(jwt);
                    serverIssue = result.authUser === 'failed';
                  }
                }
              } catch {
                // server unreachable — the local wipe below still happens
              }
              await AsyncStorage.multiRemove([...LOCAL_DATA_KEYS]);
              signOut();
              if (serverIssue) {
                // Honest label: rows were erased, but the auth account itself
                // could not be removed — the learner must know it may still exist.
                showAlert(
                  'Account removal incomplete',
                  'Your learning data was erased, but the account itself could not be removed from the server. Please try again later or contact support.'
                );
              }
            })();
          },
        },
      ]
    );
  }

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

      <Text style={styles.sectionLabel}>PLAN</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Current plan</Text>
          <Text style={styles.rowValue}>
            {plan === 'premium' ? '⭐ Premium preview' : 'Free · 1 scenario/day'}
          </Text>
        </View>
        {plan === 'free' ? (
          <>
            <View style={styles.rowDivider} />
            <View style={styles.profileField}>
              <Text style={styles.fieldLabel}>
                Premium removes the daily scenario limit, and a family plan covers up to {FAMILY_SEATS} learners.
                Replays of scenarios you already started today are always free.
              </Text>
              <Button
                label="Start premium (beta)"
                onPress={() => {
                  const label = redeem('BABELISH-BETA');
                  if (label) {
                    showAlert('Premium preview enabled', `${label} — preview features are unlocked on this device. Paid billing is not available yet.`);
                  } else {
                    showAlert('Code not accepted', 'Ask support for a valid beta code.');
                  }
                }}
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.rowDivider} />
            <View style={styles.profileField}>
              <Text style={styles.fieldLabel}>
                Premium preview access is enabled on this device. Paid billing is not available yet.
              </Text>
              <Button label="Return to free plan" variant="secondary" onPress={() => resetToFree()} />
            </View>
          </>
        )}
        <View style={styles.rowDivider} />
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>
            Invite friends with your code — you both get a premium month at launch.
          </Text>
          <View style={styles.referralRow}>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCode}>{myReferralCode}</Text>
            </View>
            <Button label="Share" variant="secondary" onPress={shareReferral} style={styles.referralShare} />
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>DAILY REMINDER</Text>
      <View style={styles.group}>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>
            One calm reminder at a time you pick. Scheduled on-device — nothing leaves your phone.
          </Text>
          <View style={styles.chipWrap}>
            {REMINDER_SLOTS.map((slot) => {
              const key = slotKey(slot.hour, slot.minute);
              const on = reminderKey === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => void pickReminder(slot.hour, slot.minute, on)}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${slot.label} reminder at ${key}`}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
                    {slot.icon} {slot.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.profileHint}>
            {reminderKey ? `Reminder set for ${reminderKey} daily — tap the time again to turn it off.` : 'Off — pick a time to get one daily reminder.'}
          </Text>
        </View>
      </View>

      <Text style={styles.sectionLabel}>OFFLINE</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>
            {target.flag} {target.name} pack
          </Text>
          <Text style={[styles.rowValue, { color: colors.success }]}>Installed ✓</Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Contents</Text>
          <Text style={styles.rowValue}>
            {pack ? `${pack.chapters} chapters · ${formatPackSize(pack.kb)}` : 'Bundled'}
          </Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Voice input (speaking)</Text>
          <Text style={[styles.rowValue, { color: colors.warning }]}>Needs internet</Text>
        </View>
        <Text style={styles.profileHint}>
          Every language ships inside the app — lessons, reviews and voice playback all work offline.{' '}
          {OFFLINE_CAPABILITIES.tts}. {OFFLINE_CAPABILITIES.sync}
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
            {level.level} · {lifetimeXp} XP
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

      <Text style={styles.sectionLabel}>PRIVACY</Text>
      <View style={styles.group}>
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>
            Practice events, XP and streaks stay on this device. Cloud sync covers progress and
            vocabulary only. Microphone audio is transcribed on demand and never stored. No ads,
            no third-party trackers.
          </Text>
          <Button label="Export my data" variant="secondary" onPress={exportMyData} />
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.profileField}>
          <Text style={styles.fieldLabel}>
            Deleting your account removes your data from this device and from Babelish servers.
          </Text>
          <Button label="Delete account" variant="danger" onPress={deleteMyAccount} />
        </View>
      </View>

      <Text style={styles.sectionLabel}>APP STATUS</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <StatusDot ok={tutorLive} />
            <Text style={styles.rowLabel}>AI tutor</Text>
          </View>
          <Text style={styles.rowValue}>
            {tutorLive ? (aiSource === 'proxy' ? 'Live (app backend)' : 'Connected') : 'Demo mode'}
          </Text>
        </View>
        <View style={styles.rowDivider} />
        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <StatusDot ok={voiceLive} />
            <Text style={styles.rowLabel}>Voice input</Text>
          </View>
          <Text style={styles.rowValue}>
            {voiceLive
              ? aiSource === 'proxy'
                ? 'Live (app backend)'
                : 'Connected'
              : 'Not configured'}
          </Text>
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
          ? tutorLive
            ? 'Everything is connected. Go say hi to your tutor in the Speak tab.'
            : 'Neon backend connected: real accounts + cloud progress sync. The AI tutor runs in labeled demo mode until AI_API_KEY is set on the api Function (production) or an EXPO_PUBLIC_AI_* key is added for development.'
          : isDemo
            ? 'This build runs without a backend (EXPO_PUBLIC_NEON_DISABLED=1): accounts and progress stay on this device, and the AI tutor needs an EXPO_PUBLIC_AI_* key.'
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
        <Text style={styles.footerText}>Babelish v1.0.0 · 2027 preview</Text>
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
  referralRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  referralCodeBox: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    justifyContent: 'center',
  },
  referralCode: { ...typography.bodyStrong, color: colors.accent, letterSpacing: 1.5 },
  referralShare: { minWidth: 96 },
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
