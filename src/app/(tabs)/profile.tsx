import { Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { SectionHeader } from '@/components/SectionHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { Pill } from '@/components/Pill';
import { showAlert } from '@/lib/alert';
import { useAuth } from '@/context/AuthContext';
import { DAILY_GOALS, dailyGoalXp, usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { GOAL_OPTIONS, INTEREST_OPTIONS, toggleChip, useProfile } from '@/state/profile';
import { useAnalytics } from '@/state/analytics';
import { useSubscription } from '@/state/subscription';
import { LANGUAGES, getLanguage } from '@/data/languages';
import { progressForLanguage } from '@/lib/catalog';
import { computeStreak } from '@/lib/analytics';
import { levelForXp, todayXp } from '@/lib/xp';
import { tierForXp } from '@/lib/league';
import { FAMILY_SEATS, referralCode } from '@/lib/plans';
import { colors, radii, shadows, spacing, typography } from '@/theme/tokens';

/** English + every language in the 2.0 atlas. */
const NATIVE_CHOICES = ['en', ...LANGUAGES.map((language) => language.id)];

function nativeLabel(id: string): string {
  if (id === 'en') return 'English';
  const language = getLanguage(id);
  return `${language.flag} ${language.name}`;
}

export default function ProfileScreen() {
  const { user, signOut, isDemo, isNeon } = useAuth();

  const {
    targetLanguageId,
    nativeLanguageId,
    setNativeLanguage,
    dailyGoalMinutes,
    setDailyGoal,
    activeLanguageIds,
    setTargetLanguage,
  } = usePreferences();
  const { wordsMastered, progress } = useLearning();
  const { profile, updateProfile } = useProfile();
  const { state: analytics } = useAnalytics();
  const { plan, redeem, resetToFree } = useSubscription();
  const target = getLanguage(targetLanguageId);

  const lifetimeXp = analytics.xp.lifetime;
  const level = levelForXp(lifetimeXp);
  const tier = tierForXp(lifetimeXp);
  const streak = computeStreak(analytics.events);
  const today = todayXp(analytics.xp);
  const myReferralCode = referralCode(user?.id ?? 'babelish-demo');

  function shareReferral() {
    void Share.share({
      message: `I'm learning ${target.name} with Babelish 🌍 — use my code ${myReferralCode} when you sign up and we both get supporter perks at launch. https://zelvoca.app`,
    }).catch(() => {
      // sharing dismissed — nothing to do
    });
  }

  const initials = (user?.displayName ?? 'L')
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <Screen scroll tabBarSpace>
      <View style={styles.headerRow}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>YOUR SPACE</Text>
          <Text style={styles.title}>You</Text>
        </View>
        <Pressable
          onPress={() => router.push('/settings')}
          style={styles.gear}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open settings"
        >
          <Ionicons name="settings-outline" size={20} color={colors.text} />
        </Pressable>
        <Pill label={`LEVEL ${level.level}`} tone="free" icon="sparkles" />
      </View>

      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.profileCard}
      >
        <View style={styles.profileOrb} />
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={styles.name}>{user?.displayName ?? 'Learner'}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.badgeRow}>
            <Pill
              label={isDemo ? 'DEMO ACCOUNT' : isNeon ? 'NEON ACCOUNT' : 'VERIFIED'}
              tone="dark"
            />
            <Pill label={`${tier.emoji} ${tier.name.toUpperCase()}`} tone="dark" />
          </View>
        </View>
      </LinearGradient>

      <View style={styles.quickRow}>
        <QuickStat icon="flame" value={`${streak}`} label="DAY STREAK" tint={colors.accent} />
        <QuickStat icon="sparkles" value={`${today}`} label="XP TODAY" tint={colors.sun} />
        <QuickStat icon="star" value={`${wordsMastered}`} label="MASTERED" tint={colors.lilac} />
      </View>

      <SectionHeader title="Daily goal" icon="flag-outline" />
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>
          A gentle target — {dailyGoalXp(dailyGoalMinutes)} XP a day, about {dailyGoalMinutes}{' '}
          minutes. Missing a day never costs you anything.
        </Text>
        <View style={styles.chipWrap}>
          {DAILY_GOALS.map((minutes) => {
            const on = dailyGoalMinutes === minutes;
            return (
              <Pressable
                key={minutes}
                onPress={() => setDailyGoal(minutes)}
                style={[styles.choiceChip, on && styles.choiceChipOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{minutes} min</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <SectionHeader
        title={`My languages · ${activeLanguageIds.length}`}
        action="Manage"
        onAction={() => router.push('/learn')}
      />
      <View style={styles.card}>
        {activeLanguageIds.map((id, index) => {
          const language = getLanguage(id);
          const summary = progressForLanguage(id, progress);
          const active = id === targetLanguageId;
          return (
            <View key={id}>
              {index > 0 ? <View style={styles.rowDivider} /> : null}
              <Pressable
                onPress={() => {
                  setTargetLanguage(id);
                  router.push(`/language/${id}`);
                }}
                style={styles.langRow}
                accessibilityRole="button"
              >
                <Text style={styles.langFlag}>{language.flag}</Text>
                <View style={styles.flex}>
                  <View style={styles.langTitleRow}>
                    <Text style={styles.langName}>{language.name}</Text>
                    {active ? <Pill label="ACTIVE" tone="free" /> : null}
                  </View>
                  <Text style={styles.langMeta}>
                    {summary.completedLessons}/{summary.lessons} lessons ·{' '}
                    {summary.chapters} chapter{summary.chapters === 1 ? '' : 's'}
                  </Text>
                  <ProgressBar value={summary.pct} height={4} style={styles.langBar} />
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
              </Pressable>
            </View>
          );
        })}
        <View style={styles.rowDivider} />
        <Pressable
          onPress={() => router.push('/learn')}
          style={styles.addLanguageRow}
          accessibilityRole="button"
        >
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={styles.addLanguageText}>
            Add another language — all {LANGUAGES.length} are free
          </Text>
        </Pressable>
      </View>

      <SectionHeader title="Learning profile" icon="person-outline" />
      <View style={styles.card}>
        <View style={styles.field}>
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
        <View style={styles.field}>
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
        <View style={styles.field}>
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
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>You’re learning for…</Text>
          <View style={styles.chipWrap}>
            {GOAL_OPTIONS.map((goalOption) => {
              const on = profile.goals.includes(goalOption);
              return (
                <Pressable
                  key={goalOption}
                  onPress={() => updateProfile({ goals: toggleChip(profile.goals, goalOption) })}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{goalOption}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>You already speak…</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.nativeRail}
          >
            {NATIVE_CHOICES.filter((id) => id !== targetLanguageId).map((id) => {
              const on = nativeLanguageId === id;
              return (
                <Pressable
                  key={id}
                  onPress={() => setNativeLanguage(id)}
                  style={[styles.choiceChip, on && styles.choiceChipOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                >
                  <Text style={[styles.choiceText, on && styles.choiceTextOn]}>
                    {nativeLabel(id)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
        <Text style={styles.hint}>
          Your tutor uses this to pick examples from your real life. Saved on this device.
        </Text>
      </View>

      <SectionHeader title="Plan" icon="pricetag-outline" />
      <View style={styles.freeCard}>
        <View style={styles.freeTop}>
          <Pill label={plan === 'premium' ? 'SUPPORTER' : 'FREE FOREVER'} tone="free" icon="heart" />
          <Text style={styles.freeTier}>{plan === 'premium' ? 'Thank you 💚' : 'No card needed'}</Text>
        </View>
        <Text style={styles.freeTitle}>Everything is included</Text>
        <Text style={styles.freeBody}>
          {LANGUAGES.length} languages, every lesson, every phrasebook, offline packs, native
          voices and unlimited retakes. No trial timer, no locked chapters, no ads.
        </Text>
        <View style={styles.perks}>
          {[
            'All lessons & retakes',
            'Full phrasebook + audio',
            'Progress sync & offline',
            `Family seats at launch (${FAMILY_SEATS})`,
          ].map((perk) => (
            <View key={perk} style={styles.perk}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={styles.perkText}>{perk}</Text>
            </View>
          ))}
        </View>

        {plan === 'free' ? (
          <>
            <Text style={styles.supporterNote}>
              Want to support the project? A supporter code unlocks the beta badge and early
              features at launch. Nothing about learning changes.
            </Text>
            <Button
              label="Redeem a supporter code"
              variant="secondary"
              onPress={() => {
                const label = redeem('BABELISH-BETA');
                if (label) {
                  showAlert(
                    'Supporter mode on',
                    `${label} — thank you! Your learning stays free, and supporter badges are available on this device.`
                  );
                } else {
                  showAlert('Code not accepted', 'Ask support for a valid supporter code.');
                }
              }}
            />
          </>
        ) : (
          <Button label="Return to the free plan" variant="secondary" onPress={() => resetToFree()} />
        )}

        <View style={styles.rowDivider} />
        <View style={styles.referralBlock}>
          <Text style={styles.fieldLabel}>
            Invite a friend — you both get supporter perks at launch.
          </Text>
          <View style={styles.referralRow}>
            <View style={styles.referralCodeBox}>
              <Text style={styles.referralCode}>{myReferralCode}</Text>
            </View>
            <Button
              label="Share"
              variant="secondary"
              onPress={shareReferral}
              style={styles.referralShare}
            />
          </View>
        </View>
      </View>

      <SectionHeader title="App settings" icon="settings-outline" />
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel="Open settings"
        accessibilityHint="Reminders, voice, data, privacy and account"
        style={({ pressed }) => [styles.card, styles.settingsCard, pressed && styles.settingsCardPressed]}
      >
        <View style={styles.settingsIcon}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.settingsTitle}>Reminders, voice, data & privacy</Text>
          <Text style={styles.hint}>
            Daily reminder, offline pack, translations, playback speed, export and account.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </Pressable>

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
        <Text style={styles.footerText}>
          Babelish v2.0.0 · {LANGUAGES.length} languages · free
        </Text>
      </View>
      <Text style={styles.footerSub}>Made for curious people everywhere.</Text>
    </Screen>
  );
}

function QuickStat({
  icon,
  value,
  label,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  label: string;
  tint: string;
}) {
  return (
    <View style={styles.quickStat}>
      <Ionicons name={icon} size={15} color={tint} />
      <Text style={styles.quickValue}>{value}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  kicker: { ...typography.micro, color: colors.accent },
  gear: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  settingsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  settingsCardPressed: { backgroundColor: colors.surfaceTint },
  settingsIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
  },
  settingsTitle: { ...typography.bodyStrong, color: colors.text },
  title: { ...typography.display, color: colors.text, marginTop: 2 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    borderRadius: radii.xl,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadows.hero,
  },
  profileOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    right: -50,
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { ...typography.heading, color: colors.onDark, fontSize: 22 },
  name: { ...typography.heading, color: colors.onDark },
  email: { ...typography.caption, color: colors.onDarkMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: spacing.sm, flexWrap: 'wrap' },
  quickRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  quickStat: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
  },
  quickValue: { ...typography.heading, color: colors.text, fontSize: 18 },
  quickLabel: { ...typography.micro, color: colors.textFaint, fontSize: 8.5 },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    ...shadows.card,
  },
  field: { paddingTop: spacing.md, paddingBottom: spacing.xs },
  fieldLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.sm,
    lineHeight: 19,
  },
  fieldInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    paddingVertical: spacing.sm,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.sm },
  nativeRail: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  choiceChip: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceTint,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  choiceChipOn: { backgroundColor: colors.primaryTint, borderColor: colors.primary },
  choiceText: { ...typography.caption, color: colors.textMuted, fontSize: 12 },
  choiceTextOn: { color: colors.primary, fontWeight: '700' },
  hint: {
    ...typography.micro,
    color: colors.textFaint,
    paddingVertical: spacing.md,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontWeight: '500',
  },
  langRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  langFlag: { fontSize: 26 },
  langTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  langName: { ...typography.bodyStrong, color: colors.text },
  langMeta: { ...typography.caption, color: colors.textMuted, marginTop: 1, fontSize: 11 },
  langBar: { marginTop: 5 },
  addLanguageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  addLanguageText: { ...typography.caption, color: colors.primary, fontWeight: '600' },
  freeCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'rgba(40, 122, 85, 0.25)',
    borderRadius: radii.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  freeTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  freeTier: { ...typography.micro, color: colors.textFaint, fontSize: 9 },
  freeTitle: { ...typography.heading, color: colors.text, marginTop: spacing.md },
  freeBody: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs, lineHeight: 19 },
  perks: { marginTop: spacing.md, gap: 6 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  perkText: { ...typography.caption, color: colors.text, fontSize: 12 },
  supporterNote: {
    ...typography.micro,
    color: colors.textFaint,
    letterSpacing: 0.2,
    fontWeight: '500',
    lineHeight: 16,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  referralBlock: { paddingBottom: spacing.md },
  referralRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  referralCodeBox: {
    flex: 1,
    backgroundColor: colors.surfaceTint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    minHeight: 46,
    justifyContent: 'center',
  },
  referralCode: { ...typography.bodyStrong, color: colors.accent, letterSpacing: 1.5 },
  referralShare: { minWidth: 96 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  rowLabel: { ...typography.body, color: colors.textMuted },
  rowValue: { ...typography.bodyStrong, color: colors.text, fontSize: 14 },
  rowDivider: { height: 1, backgroundColor: colors.border },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  },
  footerText: { ...typography.micro, color: colors.textFaint },
  footerSub: {
    ...typography.micro,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
    fontWeight: '500',
  },
});
