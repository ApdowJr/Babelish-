import { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/Button';
import { Pill } from '@/components/Pill';
import { ProgressBar } from '@/components/ProgressBar';
import {
  DIFFICULTY_LABEL,
  LANGUAGES,
  getLanguage,
  searchLanguages,
  type Language,
} from '@/data/languages';
import { DAILY_GOALS, dailyGoalXp, usePreferences } from '@/state/preferences';
import { colors, layout, radii, shadows, spacing, typography } from '@/theme/tokens';

const STEPS = 3;

export default function OnboardingScreen() {
  const {
    targetLanguageId,
    setTargetLanguage,
    nativeLanguageId,
    setNativeLanguage,
    dailyGoalMinutes,
    setDailyGoal,
    completeOnboarding,
  } = usePreferences();

  const [step, setStep] = useState(0);
  const [query, setQuery] = useState('');
  const [fade] = useState(() => new Animated.Value(0));

  const selected = getLanguage(targetLanguageId);
  const results = useMemo(() => searchLanguages(query), [query]);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [step, fade]);

  const nativeChoices = useMemo(
    () => [{ id: 'en', name: 'English', flag: '🇬🇧' }, ...LANGUAGES],
    []
  );

  function next() {
    if (step < STEPS - 1) setStep((current) => current + 1);
    else finish();
  }

  function finish() {
    completeOnboarding();
    router.replace('/');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.top}>
        <View style={styles.brandRow}>
          <Logo size={26} />
          {step > 0 ? (
            <Pressable onPress={finish} hitSlop={12} accessibilityRole="button">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          ) : null}
        </View>
        <ProgressBar value={(step + 1) / STEPS} height={5} color={colors.primary} />
        <Text style={styles.stepLabel}>
          STEP {step + 1} OF {STEPS}
        </Text>
      </View>

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
          {step === 0 ? (
            <View>
              <LinearGradient
                colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <View style={styles.orbA} />
                <View style={styles.orbB} />
                <Pill label="FREE FOREVER" tone="dark" icon="sparkles" />
                <Text style={styles.heroTitle}>The whole world,{'\n'}one hello at a time.</Text>
                <Text style={styles.heroBody}>
                  Learn {LANGUAGES.length} languages with real voices, real dialect notes and a
                  tutor that talks to you like a local.
                </Text>
                <View style={styles.heroLanguages}>
                  {['🇪🇸', '🇯🇵', '🇸🇦', '🇫🇷', '🇰🇷', '🇸🇼', '🇮🇳', '🇧🇷'].map((flag) => (
                    <View key={flag} style={styles.heroFlag}>
                      <Text style={styles.heroFlagText}>{flag}</Text>
                    </View>
                  ))}
                  <Text style={styles.heroMore}>+{LANGUAGES.length - 8} more</Text>
                </View>
              </LinearGradient>

              <View style={styles.valueList}>
                <ValueRow icon="infinite" title="Every lesson, free" body="No paywall, no card, no trial timer — ever." />
                <ValueRow icon="mic-outline" title="Hear it, say it" body="Native text-to-speech, plus word-match feedback on what you say." />
                <ValueRow icon="download-outline" title="Works offline" body="The whole phrasebook ships inside the app." />
              </View>
            </View>
          ) : null}

          {step === 1 ? (
            <View>
              <Text style={styles.kicker}>YOUR FIRST LANGUAGE</Text>
              <Text style={styles.title}>What do you want to learn?</Text>
              <Text style={styles.subtitle}>
                You can add more later — every language is free, so nothing is locked.
              </Text>

              <View style={styles.searchWrap}>
                <Ionicons name="search" size={18} color={colors.textFaint} />
                <TextInput
                  style={styles.searchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search 24 languages, scripts, families…"
                  placeholderTextColor={colors.textFaint}
                  autoCapitalize="none"
                  accessibilityLabel="Search languages"
                />
                {query ? (
                  <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button">
                    <Ionicons name="close-circle" size={18} color={colors.textFaint} />
                  </Pressable>
                ) : null}
              </View>

              <View style={styles.grid}>
                {results.map((language) => (
                  <LanguageChoice
                    key={language.id}
                    language={language}
                    selected={language.id === selected.id}
                    onPress={() => setTargetLanguage(language.id)}
                  />
                ))}
              </View>

              {results.length === 0 ? (
                <Text style={styles.empty}>
                  No match — try the language’s native name (Español, 日本語, العربية…).
                </Text>
              ) : null}
            </View>
          ) : null}

          {step === 2 ? (
            <View>
              <Text style={styles.kicker}>MAKE IT YOURS</Text>
              <Text style={styles.title}>A habit that fits your day.</Text>
              <Text style={styles.subtitle}>
                Choose your daily goal and the language you think in. Both can change any time.
              </Text>

              <View style={styles.selectionCard}>
                <Text style={styles.fieldLabel}>I’M LEARNING</Text>
                <View style={styles.selectionRow}>
                  <Text style={styles.selectionFlag}>{selected.flag}</Text>
                  <View style={styles.flex}>
                    <Text style={styles.selectionTitle}>{selected.name}</Text>
                    <Text style={styles.selectionSub}>
                      {selected.nativeName} · {selected.nativeSpeakers}
                    </Text>
                  </View>
                  <Pill label="FREE" tone="free" />
                </View>
              </View>

              <Text style={styles.fieldLabel}>MY DAILY GOAL</Text>
              <View style={styles.goalRow}>
                {DAILY_GOALS.map((minutes) => {
                  const active = minutes === dailyGoalMinutes;
                  return (
                    <Pressable
                      key={minutes}
                      onPress={() => setDailyGoal(minutes)}
                      style={[styles.goal, active && styles.goalActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.goalValue, active && styles.goalValueActive]}>
                        {minutes}
                      </Text>
                      <Text style={[styles.goalUnit, active && styles.goalUnitActive]}>min</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.hint}>
                ≈ {dailyGoalXp(dailyGoalMinutes)} XP a day. Most learners finish a lesson in 4–6
                minutes.
              </Text>

              <Text style={[styles.fieldLabel, styles.nativeLabel]}>I ALREADY SPEAK</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.nativeRow}
              >
                {nativeChoices.map((choice) => {
                  const active = nativeLanguageId === choice.id;
                  return (
                    <Pressable
                      key={choice.id}
                      onPress={() => setNativeLanguage(choice.id)}
                      style={[styles.nativeChip, active && styles.nativeChipActive]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={styles.nativeFlag}>{choice.flag}</Text>
                      <Text style={[styles.nativeText, active && styles.nativeTextActive]}>
                        {choice.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.readyCard}>
                <Text style={styles.readyEmoji}>🌍</Text>
                <View style={styles.flex}>
                  <Text style={styles.readyTitle}>You’re ready to start</Text>
                  <Text style={styles.readyBody}>
                    First up: “{selected.greeting.text}” — {selected.greeting.meaning.toLowerCase()}
                    {selected.greeting.roman ? ` (${selected.greeting.roman})` : ''}.
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Pressable
            onPress={() => setStep((current) => Math.max(0, current - 1))}
            style={styles.back}
            accessibilityRole="button"
          >
            <Ionicons name="arrow-back" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
        <Button
          label={step === 0 ? 'Let’s go' : step === STEPS - 1 ? `Start learning ${selected.name}` : 'Continue'}
          onPress={next}
          style={styles.cta}
        />
      </View>
    </SafeAreaView>
  );
}

function ValueRow({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  return (
    <View style={styles.valueRow}>
      <View style={styles.valueIcon}>
        <Ionicons name={icon} size={18} color={colors.primary} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.valueTitle}>{title}</Text>
        <Text style={styles.valueBody}>{body}</Text>
      </View>
    </View>
  );
}

function LanguageChoice({
  language,
  selected,
  onPress,
}: {
  language: Language;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.languageChoice,
        selected && styles.languageChoiceSelected,
        pressed && styles.pressed,
      ]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${language.name}, ${language.nativeName}`}
    >
      <View style={styles.languageTop}>
        <Text style={styles.languageFlag}>{language.flag}</Text>
        {selected ? (
          <View style={styles.check}>
            <Ionicons name="checkmark" size={12} color={colors.onDark} />
          </View>
        ) : null}
      </View>
      <Text style={styles.languageName} numberOfLines={1}>
        {language.name}
      </Text>
      <Text style={styles.languageNative} numberOfLines={1}>
        {language.nativeName}
      </Text>
      <Text style={styles.languageMeta}>{DIFFICULTY_LABEL[language.difficulty]}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  top: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.sm,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  skip: { ...typography.bodyStrong, color: colors.textMuted },
  stepLabel: { ...typography.micro, color: colors.textFaint, marginTop: spacing.sm },
  scroll: {
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  hero: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  orbA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    right: -60,
  },
  orbB: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(242,193,78,0.12)',
    bottom: -50,
    left: -30,
  },
  heroTitle: {
    ...typography.display,
    color: colors.onDark,
    marginTop: spacing.lg,
    lineHeight: 40,
  },
  heroBody: {
    ...typography.body,
    color: colors.onDarkMuted,
    marginTop: spacing.md,
    lineHeight: 22,
    maxWidth: 420,
  },
  heroLanguages: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  heroFlag: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroFlagText: { fontSize: 20 },
  heroMore: { ...typography.caption, color: colors.onDarkMuted, marginLeft: 2 },
  valueList: { marginTop: spacing.xl, gap: spacing.md },
  valueRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  valueIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueTitle: { ...typography.bodyStrong, color: colors.text },
  valueBody: { ...typography.caption, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  kicker: { ...typography.micro, color: colors.accent },
  title: { ...typography.display, color: colors.text, marginTop: spacing.sm, lineHeight: 38 },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  languageChoice: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  languageChoiceSelected: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  pressed: { opacity: 0.85 },
  languageTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  languageFlag: { fontSize: 26 },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  languageName: { ...typography.bodyStrong, color: colors.text, marginTop: spacing.sm },
  languageNative: { ...typography.caption, color: colors.textMuted, marginTop: 1 },
  languageMeta: { ...typography.micro, fontSize: 9.5, color: colors.textFaint, marginTop: 6 },
  empty: { ...typography.caption, color: colors.textMuted, textAlign: 'center', marginTop: spacing.xl },
  selectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    ...shadows.card,
  },
  fieldLabel: { ...typography.micro, color: colors.textFaint, marginBottom: spacing.sm },
  selectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  selectionFlag: { fontSize: 32 },
  selectionTitle: { ...typography.heading, color: colors.text },
  selectionSub: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  goalRow: { flexDirection: 'row', gap: spacing.sm },
  goal: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  goalActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  goalValue: { ...typography.title, color: colors.text, fontSize: 22 },
  goalValueActive: { color: colors.onDark },
  goalUnit: { ...typography.micro, color: colors.textFaint, marginTop: 1 },
  goalUnitActive: { color: colors.onDarkMuted },
  hint: { ...typography.caption, color: colors.textMuted, marginTop: spacing.sm },
  nativeLabel: { marginTop: spacing.xl },
  nativeRow: { gap: spacing.sm, paddingVertical: spacing.xs, paddingRight: spacing.lg },
  nativeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  nativeChipActive: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  nativeFlag: { fontSize: 15 },
  nativeText: { ...typography.caption, color: colors.textMuted },
  nativeTextActive: { color: colors.primary, fontWeight: '700' },
  readyCard: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.primaryTint,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
  },
  readyEmoji: { fontSize: 30 },
  readyTitle: { ...typography.bodyStrong, color: colors.primary },
  readyBody: { ...typography.caption, color: colors.primary, marginTop: 2, lineHeight: 18 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: layout.screenPadding,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  back: {
    width: 54,
    height: 54,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: { flex: 1 },
});
