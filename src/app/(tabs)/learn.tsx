import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { Pill } from '@/components/Pill';
import { EmptyState } from '@/components/EmptyState';
import {
  DIFFICULTY_LABEL,
  LANGUAGES,
  LANGUAGE_COUNT,
  REGIONS,
  getLanguage,
  languageStatus,
  searchLanguages,
  type Language,
  type RegionId,
} from '@/data/languages';
import { catalogueStats, progressForLanguage, starterWordCount } from '@/lib/catalog';
import { usePreferences } from '@/state/preferences';
import { useLearning } from '@/state/learning';
import { radii, shadows, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { translateUi } from '@/lib/interfaceLocalization';

export default function ExploreScreen() {
  const styles = useThemedStyles(createStyles);
  const { interfaceLanguage } = usePreferences();
  const t = (value: string) => translateUi(value, interfaceLanguage);
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<RegionId | 'all'>('all');
  const { targetLanguageId, activeLanguageIds } = usePreferences();
  const { progress } = useLearning();

  const stats = useMemo(() => catalogueStats(), []);
  const filtered = useMemo(() => searchLanguages(query, region), [query, region]);
  const myLanguages = activeLanguageIds.map(getLanguage);
  const summaries = useMemo(
    () =>
      Object.fromEntries(
        LANGUAGES.map((language) => [language.id, progressForLanguage(language.id, progress)])
      ),
    [progress]
  );

  return (
    <Screen scroll tabBarSpace>
      <View style={styles.header}>
        <Text style={styles.kicker}>{t('THE WHOLE ATLAS')}</Text>
        <Text style={styles.title}>{t('Explore')} {LANGUAGE_COUNT} {t('languages')}</Text>
        <Text style={styles.subtitle}>
          {t('Real scripts, real dialects, real voices. Every course is free — pick a flag and start today.')}
        </Text>
        <View style={styles.statStrip}>
          <Text style={styles.statText}>
            {stats.languages} {t('languages')} · {stats.lessons} {t('lessons')} · {starterWordCount()}+ {t('words')}
          </Text>
          <Pill label="100% FREE" tone="free" icon="sparkles" />
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={t("Spanish, العربية, Kansai, Hangul…")}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          accessibilityLabel={t("Search languages")}
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.regionRail}
      >
        <Pressable
          onPress={() => setRegion('all')}
          style={[styles.regionChip, region === 'all' && styles.regionChipActive]}
          accessibilityRole="button"
          accessibilityState={{ selected: region === 'all' }}
        >
          <Text style={[styles.regionText, region === 'all' && styles.regionTextActive]}>
            🌐 All
          </Text>
        </Pressable>
        {REGIONS.map((item) => {
          const active = region === item.id;
          return (
            <Pressable
              key={item.id}
              onPress={() => setRegion(item.id)}
              style={[styles.regionChip, active && styles.regionChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.regionText, active && styles.regionTextActive]}>
                {item.emoji} {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {region === 'all' && !query ? (
        <>
          <SectionHeader
            title="Pick up where you left off"
            action="Home"
            onAction={() => router.push('/')}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mineRail}
          >
            {myLanguages.map((language) => {
              const summary = summaries[language.id] ?? progressForLanguage(language.id, progress);
              return (
                <Pressable
                  key={language.id}
                  onPress={() => router.push(`/language/${language.id}`)}
                  style={({ pressed }) => [
                    styles.mineCard,
                    language.id === targetLanguageId && styles.mineCardActive,
                    pressed && styles.pressed,
                  ]}
                  accessibilityRole="button"
                >
                  <View style={styles.mineTop}>
                    <Text style={styles.mineFlag}>{language.flag}</Text>
                    {language.id === targetLanguageId ? (
                      <Pill label="ACTIVE" tone="free" />
                    ) : null}
                  </View>
                  <Text style={styles.mineName}>{language.name}</Text>
                  <Text style={styles.mineMeta}>
                    {summary.completedLessons}/{summary.lessons} lessons · {summary.pct > 0 ? `${Math.round(summary.pct * 100)}%` : 'new'}
                  </Text>
                  <ProgressBar value={summary.pct} height={5} style={styles.mineBar} />
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <SectionHeader
        title={
          query || region !== 'all'
            ? `${filtered.length} result${filtered.length === 1 ? '' : 's'}`
            : 'The full atlas'
        }
        icon="globe-outline"
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No language matches"
          body="Try the native name (Español, 日本語, العربية), a script, or a dialect such as Kansai or Vlaams."
          actionLabel="Clear filters"
          onAction={() => {
            setQuery('');
            setRegion('all');
          }}
        />
      ) : (
        filtered.map((language) => (
          <LanguageCard
            key={language.id}
            language={language}
            learning={activeLanguageIds.includes(language.id)}
            active={language.id === targetLanguageId}
            completed={summaries[language.id]?.completedLessons ?? 0}
            total={summaries[language.id]?.lessons ?? 0}
            pct={summaries[language.id]?.pct ?? 0}
            onPress={() => router.push(`/language/${language.id}`)}
          />
        ))
      )}

      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.footerCard}
      >
        <View style={styles.footerOrb} />
        <Text style={styles.footerEmoji}>🌍</Text>
        <Text style={styles.footerTitle}>{t('Why is it all free?')}</Text>
        <Text style={styles.footerBody}>
          Because a language should never sit behind a paywall. Babelish is free during beta: every
          lesson, every phrasebook, every native voice. Optional supporter perks arrive at launch —
          the core course stays free.
        </Text>
        <View style={styles.footerPills}>
          <Pill label="NO CARD" tone="dark" />
          <Pill label="NO TRIAL TIMER" tone="dark" />
          <Pill label="NO ADS" tone="dark" />
        </View>
      </LinearGradient>
    </Screen>
  );
}

function LanguageCard({
  language,
  learning,
  active,
  completed,
  total,
  pct,
  onPress,
}: {
  language: Language;
  learning: boolean;
  active: boolean;
  completed: number;
  total: number;
  pct: number;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        active && styles.cardActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${language.name}, ${language.nativeName}, ${DIFFICULTY_LABEL[language.difficulty]}`}
    >
      <View style={styles.cardTop}>
        <View style={styles.flagTile}>
          <Text style={styles.flag}>{language.flag}</Text>
        </View>
        <View style={styles.cardBody}>
          <View style={styles.nameRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {language.name}
            </Text>
            {learning ? <Pill label={active ? 'ACTIVE' : 'LEARNING'} tone="free" /> : null}
            {!learning && languageStatus(language.id) === 'beta' ? (
              <Pill label="BETA" tone="beta" />
            ) : null}
          </View>
          <Text style={styles.cardNative} numberOfLines={1}>
            {language.nativeName} · {language.nativeSpeakers}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="text-outline" size={11} color={colors.textFaint} />
              <Text style={styles.metaText}>{language.script}</Text>
            </View>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>{DIFFICULTY_LABEL[language.difficulty]}</Text>
            <View style={styles.metaDot} />
            <Text style={styles.metaText}>
              {total} lesson{total === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      </View>

      <View style={styles.greetingRow}>
        <Text
          style={[styles.greetingText, language.direction === 'rtl' && styles.rtl]}
          numberOfLines={1}
        >
          “{language.greeting.text}”
        </Text>
        <Text style={styles.greetingMeaning} numberOfLines={1}>
          {language.greeting.meaning}
        </Text>
      </View>

      {learning ? (
        <View style={styles.cardProgress}>
          <ProgressBar value={pct} height={5} color={active ? colors.primary : colors.mint} />
          <Text style={styles.cardProgressText}>
            {completed}/{total} lessons
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.85 },
  header: { marginTop: spacing.md },
  kicker: { ...typography.micro, color: c.accent },
  title: { ...typography.display, color: c.text, marginTop: spacing.sm, lineHeight: 38 },
  subtitle: { ...typography.body, color: c.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  statStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.md,
    flexWrap: 'wrap',
  },
  statText: { ...typography.caption, color: c.textFaint },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    marginTop: spacing.lg,
    ...shadows.card,
  },
  searchInput: { flex: 1, ...typography.body, color: c.text, paddingVertical: spacing.md },
  regionRail: { gap: spacing.sm, paddingVertical: spacing.md, paddingRight: spacing.lg },
  regionChip: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  regionChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  regionText: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  regionTextActive: { color: c.onDark },
  mineRail: { gap: spacing.sm, paddingVertical: 2, paddingRight: spacing.lg },
  mineCard: {
    width: 170,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  mineCardActive: { borderColor: c.primary, borderWidth: 1.5 },
  mineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  mineFlag: { fontSize: 26 },
  mineName: { ...typography.bodyStrong, color: c.text, marginTop: spacing.sm, fontSize: 14 },
  mineMeta: { ...typography.caption, color: c.textMuted, marginTop: 1, fontSize: 11 },
  mineBar: { marginTop: spacing.sm },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    ...shadows.card,
  },
  cardActive: { borderColor: c.primary, borderWidth: 1.5 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flagTile: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.surfaceTint,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flag: { fontSize: 28 },
  cardBody: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  cardTitle: { ...typography.heading, color: c.text, fontSize: 17 },
  cardNative: { ...typography.caption, color: c.textMuted, marginTop: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { ...typography.micro, fontSize: 9, color: c.textFaint, letterSpacing: 0.2, fontWeight: '500' },
  metaDot: { width: 2, height: 2, borderRadius: 1, backgroundColor: c.borderStrong },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  greetingText: { ...typography.bodyStrong, color: c.primary, fontSize: 14, flexShrink: 1 },
  greetingMeaning: { ...typography.caption, color: c.textFaint, fontSize: 11, flexShrink: 1 },
  cardProgress: { marginTop: spacing.md },
  cardProgressText: { ...typography.micro, color: c.textFaint, marginTop: 4, fontSize: 9 },
  footerCard: {
    borderRadius: radii.lg,
    padding: spacing.xl,
    marginTop: spacing.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  footerOrb: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -90,
    right: -60,
  },
  footerEmoji: { fontSize: 30 },
  footerTitle: { ...typography.heading, color: c.onDark, marginTop: spacing.sm },
  footerBody: { ...typography.caption, color: c.onDarkMuted, marginTop: spacing.sm, lineHeight: 19 },
  footerPills: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.lg },
});
