import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { ProgressBar, ProgressDots } from '@/components/ProgressBar';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatTile } from '@/components/StatTile';
import { Pill } from '@/components/Pill';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { useLearning, normalizeKey } from '@/state/learning';
import { useAnalytics } from '@/state/analytics';
import { usePreferences } from '@/state/preferences';
import {
  LANGUAGES,
  getLanguage,
  isKnownLanguage,
  type Language,
} from '@/data/languages';
import { loadCurriculum } from '@/lib/curriculum/store';
import type { Chapter, VocabItem } from '@/lib/curriculum/types';
import {
  PHRASE_CATEGORY_LABEL,
  buildPhrasebook,
  searchPhrases,
  type Phrase,
  type PhraseCategory,
} from '@/lib/phrasebook';
import { speakNative } from '@/lib/ai';
import { activityByDay, computeStreak, countEvents, weekdayLabels } from '@/lib/analytics';
import { levelForXp, weeklyXp } from '@/lib/xp';
import { tierForXp } from '@/lib/league';
import {
  evaluateAchievements,
  languagesStartedFromProgress,
  unlockedCount,
} from '@/lib/achievements';
import { radii, shadows, spacing, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';
import { translateUi } from '@/lib/interfaceLocalization';

type Tab = 'practice' | 'phrasebook' | 'badges';

const TABS: { value: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'practice', label: 'Practice', icon: 'refresh' },
  { value: 'phrasebook', label: 'Phrasebook', icon: 'book' },
  { value: 'badges', label: 'Badges', icon: 'ribbon' },
];

const CATEGORY_OPTIONS: { value: PhraseCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'essentials', label: 'Essentials' },
  { value: 'numbers', label: 'Numbers' },
  { value: 'curriculum', label: 'Lessons' },
];

export default function WordsScreen() {
  const styles = useThemedStyles(createStyles);
  const { interfaceLanguage } = usePreferences();
  const t = (value: string) => translateUi(value, interfaceLanguage);
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string }>();
  const requestedTab: Tab =
    params.tab === 'phrasebook' || params.tab === 'badges' ? params.tab : 'practice';
  const [tab, setTab] = useState<Tab>(requestedTab);
  const [prevRequest, setPrevRequest] = useState<string | undefined>(params.tab);

  // Deep links like /words?tab=badges (from Home) land on the right segment.
  if (prevRequest !== params.tab) {
    setPrevRequest(params.tab);
    setTab(requestedTab);
  }
  const { vocab, dueCount, wordsMastered, addWord, progress, ready } = useLearning();
  const { state: analytics } = useAnalytics();
  const { targetLanguageId, activeLanguageIds, toggleMyLanguage } = usePreferences();

  const [phraseLang, setPhraseLang] = useState(targetLanguageId);
  const [prevTarget, setPrevTarget] = useState(targetLanguageId);
  // Follow the active language when it changes elsewhere (render-time sync).
  if (prevTarget !== targetLanguageId) {
    setPrevTarget(targetLanguageId);
    setPhraseLang(targetLanguageId);
  }
  const [chapters, setChapters] = useState<{ lang: string; chapters: Chapter[] } | null>(null);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PhraseCategory | 'all'>('all');

  const language = getLanguage(phraseLang);

  useEffect(() => {
    if (!isKnownLanguage(phraseLang)) return;
    let cancelled = false;
    loadCurriculum(phraseLang)
      .then((loaded) => {
        if (!cancelled) setChapters({ lang: phraseLang, chapters: loaded });
      })
      .catch(() => {
        if (!cancelled) setChapters({ lang: phraseLang, chapters: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [phraseLang]);

  const loadedChapters = useMemo(
    () => (chapters?.lang === phraseLang ? chapters.chapters : []),
    [chapters, phraseLang]
  );
  const phrasebook = useMemo(
    () => buildPhrasebook(phraseLang, loadedChapters),
    [phraseLang, loadedChapters]
  );

  const filtered = useMemo(() => {
    const byCategory =
      category === 'all' ? phrasebook : phrasebook.filter((p) => p.category === category);
    return searchPhrases(byCategory, query);
  }, [phrasebook, category, query]);

  const streak = computeStreak(analytics.events);
  const level = levelForXp(analytics.xp.lifetime);
  const tier = tierForXp(analytics.xp.lifetime);
  const week = weeklyXp(analytics.xp);
  const weekValues = activityByDay(analytics.events);
  const weekLabels = weekdayLabels();
  const vocabList = useMemo(
    () =>
      Object.values(vocab).sort((a, b) => {
        const due = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        if (due !== 0) return due;
        return a.target.localeCompare(b.target);
      }),
    [vocab]
  );
  const perfectLessons = Object.values(progress).filter((p) => p.score >= 100).length;
  const achievements = evaluateAchievements({
    lifetimeXp: analytics.xp.lifetime,
    streak,
    lessonsCompleted: Object.values(progress).filter((p) => p.score >= 70).length,
    languagesStarted: languagesStartedFromProgress(progress),
    wordsSaved: vocabList.length,
    wordsMastered,
    perfectLessons,
    reviewSessions: countEvents(analytics.events, 'review_completed'),
    speakingAttempts: analytics.speak.count,
  });
  const badgesOpen = unlockedCount(achievements);

  return (
    <Screen scroll tabBarSpace>
      <View style={styles.header}>
        <View style={styles.flex}>
          <Text style={styles.kicker}>{t('YOUR LIBRARY')}</Text>
          <Text style={styles.title}>{t('Words worth keeping')}</Text>
        </View>
        <View style={styles.headerBadge}>
          <Text style={styles.headerEmoji}>📚</Text>
        </View>
      </View>

      <SegmentedControl options={TABS.map((item) => ({ ...item, label: t(item.label) }))} value={tab} onChange={setTab} />

      {tab === 'practice' ? (
        <PracticeTab
          vocab={vocabList}
          dueCount={dueCount}
          wordsMastered={wordsMastered}
          ready={ready}
        />
      ) : null}

      {tab === 'phrasebook' ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.langRail}
          >
            {LANGUAGES.map((option) => {
              const active = option.id === phraseLang;
              const mine = activeLanguageIds.includes(option.id);
              return (
                <Pressable
                  key={option.id}
                  onPress={() => setPhraseLang(option.id)}
                  style={[styles.langChip, active && styles.langChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${option.name} phrasebook`}
                >
                  <Text style={styles.langFlag}>{option.flag}</Text>
                  <Text style={[styles.langName, active && styles.langNameActive]}>
                    {option.name}
                  </Text>
                  {mine ? <View style={styles.mineDot} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={styles.phraseHead}>
            <View style={styles.flex}>
              <Text style={styles.phraseTitle}>
                {language.flag} {language.name} {t('phrasebook')}
              </Text>
              <Text style={styles.phraseSub}>
                {phrasebook.length} {t('words and phrases · works offline')}
              </Text>
            </View>
            <Pressable
              onPress={() => toggleMyLanguage(language.id)}
              style={styles.addLang}
              accessibilityRole="button"
            >
              <Ionicons
                name={activeLanguageIds.includes(language.id) ? 'checkmark-circle' : 'add-circle-outline'}
                size={20}
                color={colors.primary}
              />
              <Text style={styles.addLangText}>
                {t(activeLanguageIds.includes(language.id) ? 'Learning' : 'Add')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.searchWrap}>
            <Ionicons name="search" size={17} color={colors.textFaint} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder={t('Search course or English…').replace('course', language.name)}
              placeholderTextColor={colors.textFaint}
              autoCapitalize="none"
              accessibilityLabel={t("Search phrases")}
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button">
                <Ionicons name="close-circle" size={17} color={colors.textFaint} />
              </Pressable>
            ) : null}
          </View>

          <SegmentedControl
            options={CATEGORY_OPTIONS.map((item) => ({ ...item, label: t(item.label) }))}
            value={category}
            onChange={setCategory}
            scroll
          />

          <Text style={styles.countLine}>
            {filtered.length} {t(filtered.length === 1 ? 'phrase' : 'phrases')}
            {category !== 'all' ? ` · ${PHRASE_CATEGORY_LABEL[category]}` : ''}
          </Text>

          {filtered.length === 0 ? (
            <EmptyState
              icon="search-outline"
              title={t("No phrases match")}
              body={t("Try an English meaning, the native script, or the transliteration.")}
            />
          ) : (
            filtered.map((phrase) => (
              <PhraseRow
                key={phrase.id}
                phrase={phrase}
                language={language}
                saved={Boolean(vocab[`${phrase.languageId}:${normalizeKey(phrase.target)}`])}
                onSave={() =>
                  void addWord({
                    languageId: phrase.languageId,
                    target: phrase.target,
                    translation: phrase.english,
                  })
                }
              />
            ))
          )}
        </View>
      ) : null}

      {tab === 'badges' ? (
        <View>
          <LinearGradient
            colors={[colors.gradientFrom, colors.gradientMid, colors.gradientTo]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.levelCard}
          >
            <View style={styles.levelOrb} />
            <View style={styles.levelRow}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelNumber}>{level.level}</Text>
              </View>
              <View style={styles.flex}>
                <Text style={styles.levelTitle}>
                  {tier.emoji} {tier.name} league
                </Text>
                <Text style={styles.levelSub}>
                  {analytics.xp.lifetime} XP lifetime · {week} XP this week
                </Text>
              </View>
              <Pill label={`${badgesOpen}/${achievements.length}`} tone="dark" icon="ribbon" />
            </View>
            <ProgressBar
              value={level.pct}
              color={colors.sunInk}
              trackColor="rgba(255,255,255,0.16)"
              label={`Level ${level.level} → ${level.level + 1}`}
              showPct
              onDark
              style={styles.levelProgress}
            />
            <Text style={styles.levelNote}>
              Levels never go down — every practice adds up. Next level at {level.target} XP.
            </Text>
          </LinearGradient>

          <View style={styles.statRow}>
            <StatTile icon="flame" value={streak} label="DAY STREAK" tint={colors.accentInk} />
            <StatTile
              icon="checkmark-done"
              value={Object.values(progress).filter((p) => p.score >= 70).length}
              label="LESSONS"
              tint={colors.skyInk}
              tintSoft={colors.skySoft}
            />
            <StatTile
              icon="book"
              value={vocabList.length}
              label="WORDS SAVED"
              tint={colors.lilacInk}
              tintSoft={colors.lilacSoft}
            />
          </View>

          <SectionHeader title="This week" />
          <View style={styles.weekCard}>
            <View style={styles.weekBars}>
              {weekValues.map((value, index) => {
                const max = Math.max(1, ...weekValues);
                const isToday = index === weekValues.length - 1;
                return (
                  <View key={index} style={styles.weekCol}>
                    <View style={styles.weekTrack}>
                      <View
                        style={[
                          styles.weekBar,
                          {
                            height: Math.max(6, Math.round((value / max) * 56)),
                            backgroundColor: value > 0 ? colors.primary : colors.border,
                            opacity: isToday ? 1 : 0.45,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.weekDay, isToday && styles.weekDayToday]}>
                      {weekLabels[index]}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text style={styles.weekNote}>
              {streak > 0
                ? `${streak}-day streak — ${week} XP earned this week.`
                : 'One lesson today starts your streak.'}
            </Text>
          </View>

          <SectionHeader title={`Achievements · ${badgesOpen} unlocked`} />
          <View style={styles.badgeGrid}>
            {achievements.map((badge) => (
              <View
                key={badge.id}
                style={[styles.badgeCard, badge.unlocked && styles.badgeCardUnlocked]}
              >
                <View style={styles.badgeTop}>
                  <Text style={[styles.badgeEmoji, !badge.unlocked && styles.badgeEmojiLocked]}>
                    {badge.emoji}
                  </Text>
                  {badge.unlocked ? (
                    <Pill label={badge.tier.toUpperCase()} tone="free" />
                  ) : (
                    <Ionicons name="lock-closed" size={12} color={colors.textFaint} />
                  )}
                </View>
                <Text style={[styles.badgeTitle, !badge.unlocked && styles.badgeTitleLocked]}>
                  {badge.title}
                </Text>
                <Text style={styles.badgeBody}>{badge.description}</Text>
                <ProgressBar
                  value={badge.pct}
                  height={5}
                  color={badge.unlocked ? colors.success : colors.primary}
                  style={styles.badgeProgress}
                />
                <Text style={styles.badgeCount}>
                  {Math.min(badge.progress, badge.target)} / {badge.target}
                </Text>
              </View>
            ))}
          </View>

          <SectionHeader title="How XP works" />
          <View style={styles.xpCard}>
            {[
              ['Lesson finished', '+20 XP'],
              ['Perfect lesson', '+15 XP'],
              ['Pronunciation attempt', '+3 XP'],
              ['Review session', '+4 XP'],
              ['First activity of the day', '+10 XP'],
            ].map(([label, value], index, all) => (
              <View key={label} style={[styles.xpRow, index < all.length - 1 && styles.xpDivider]}>
                <Text style={styles.xpLabel}>{label}</Text>
                <Text style={styles.xpValue}>{value}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function PracticeTab({
  vocab,
  dueCount,
  wordsMastered,
  ready,
}: {
  vocab: VocabItem[];
  dueCount: number;
  wordsMastered: number;
  ready: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View>
      <LinearGradient
        colors={[colors.gradientFrom, colors.gradientTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.reviewHero}
      >
        <View style={styles.reviewOrb} />
        <View style={styles.reviewTop}>
          <View style={styles.reviewIcon}>
            <Ionicons name="refresh" size={22} color={colors.sunInk} />
          </View>
          <Pill label={dueCount > 0 ? 'DUE NOW' : 'ALL CLEAR'} tone="dark" />
        </View>
        <Text style={styles.reviewTitle}>
          {dueCount > 0 ? `${dueCount} word${dueCount === 1 ? '' : 's'} ready for review` : 'No words due today'}
        </Text>
        <Text style={styles.reviewBody}>
          {dueCount > 0
            ? 'Spaced repetition brings each word back right before you would forget it.'
            : 'Miss a word in a lesson and it lands here tomorrow. Keep the loop going.'}
        </Text>
        <Button
          label={dueCount > 0 ? 'Start review' : 'Learn something new'}
          onPress={() => (dueCount > 0 ? router.push('/review') : router.push('/learn'))}
          variant="secondary"
          style={styles.reviewCta}
        />
      </LinearGradient>

      <View style={styles.statRow}>
        <StatTile
          icon="time"
          value={dueCount}
          label="DUE TODAY"
          tint={colors.accentInk}
          tintSoft={colors.accentSoft}
        />
        <StatTile icon="albums" value={vocab.length} label="IN REVIEW" tint={colors.skyInk} tintSoft={colors.skySoft} />
        <StatTile
          icon="star"
          value={wordsMastered}
          label="MASTERED"
          tint={colors.success}
          tintSoft={colors.successSoft}
        />
      </View>

      <SectionHeader title="Your word bank" action="Review now" onAction={() => router.push('/review')} />

      {!ready ? (
        <Text style={styles.loadingText}>{t('Loading your words…')}</Text>
      ) : vocab.length === 0 ? (
        <EmptyState
          emoji="🌱"
          title="Your word bank is empty"
          body="Every word you miss in a lesson, or save from the phrasebook, shows up here with its own review schedule."
          actionLabel="Browse languages"
          onAction={() => router.push('/learn')}
        />
      ) : (
        vocab.slice(0, 40).map((item) => <WordRow key={item.itemKey} item={item} />)
      )}

      {vocab.length > 40 ? (
        <Text style={styles.moreText}>Showing 40 of {vocab.length} words.</Text>
      ) : null}

      <View style={styles.boxCard}>
        <Text style={styles.boxTitle}>{t('How the boxes work')}</Text>
        <Text style={styles.boxBody}>
          A new word starts in box 1 and comes back tomorrow. Each correct review moves it one box
          further out — 1, 2, 4, 8, then 15 days. A miss gently returns it to box 1. Nothing is ever
          lost.
        </Text>
        <View style={styles.boxRow}>
          {[1, 2, 3, 4, 5].map((box) => (
            <View key={box} style={styles.boxItem}>
              <View style={styles.boxDot} />
              <Text style={styles.boxLabel}>Box {box}</Text>
              <Text style={styles.boxCount}>
                {vocab.filter((item) => item.box === box).length}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function WordRow({ item }: { item: VocabItem }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const language = getLanguage(item.languageId);
  const due = new Date(item.dueAt).getTime() <= new Date().getTime();
  return (
    <View style={styles.wordRow}>
      <Pressable
        onPress={() => speakNative(item.target, language.ttsLocale)}
        style={styles.wordPlay}
        accessibilityRole="button"
        accessibilityLabel={`Hear ${item.target}`}
      >
        <Ionicons name="volume-medium" size={18} color={colors.primary} />
      </Pressable>
      <View style={styles.flex}>
        <Text
          style={[
            styles.wordTarget,
            language.direction === 'rtl' && styles.rtl,
          ]}
        >
          {item.target}
        </Text>
        <Text style={styles.wordTranslation}>{item.translation}</Text>
        <View style={styles.wordMeta}>
          <Text style={styles.wordLang}>
            {language.flag} {language.name}
          </Text>
          <ProgressDots total={5} filled={item.box} color={colors.primary} />
          <Text style={[styles.wordDue, due && styles.wordDueNow]}>
            {due ? 'Due now' : `In ${daysUntil(item.dueAt)}d`}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PhraseRow({
  phrase,
  language,
  saved,
  onSave,
}: {
  phrase: Phrase;
  language: Language;
  saved: boolean;
  onSave: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <View style={styles.phraseCard}>
      <View style={styles.flex}>
        <Text style={[styles.phraseTarget, language.direction === 'rtl' && styles.rtl]}>
          {phrase.target}
        </Text>
        {phrase.roman ? <Text style={styles.phraseRoman}>{phrase.roman}</Text> : null}
        <Text style={styles.phraseEnglish}>{phrase.english}</Text>
        <View style={styles.phraseMeta}>
          <Pill
            label={PHRASE_CATEGORY_LABEL[phrase.category].toUpperCase()}
            tone={phrase.category === 'curriculum' ? 'sky' : phrase.category === 'numbers' ? 'lilac' : 'free'}
          />
          {phrase.source ? <Text style={styles.phraseSource}>{phrase.source}</Text> : null}
        </View>
      </View>
      <View style={styles.phraseActions}>
        <Pressable
          onPress={() => speakNative(phrase.target, language.ttsLocale)}
          style={styles.phraseAction}
          accessibilityRole="button"
          accessibilityLabel={`Hear ${phrase.target}`}
        >
          <Ionicons name="volume-medium" size={18} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={onSave}
          disabled={saved}
          style={[styles.phraseAction, saved && styles.phraseActionSaved]}
          accessibilityRole="button"
          accessibilityLabel={saved ? 'Already in your review queue' : `Save ${phrase.target}`}
        >
          <Ionicons
            name={saved ? 'checkmark' : 'add'}
            size={18}
            color={saved ? colors.success : colors.primary}
          />
        </Pressable>
      </View>
    </View>
  );
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

const createStyles = (c: Palette) => StyleSheet.create({
  flex: { flex: 1 },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  kicker: { ...typography.micro, color: c.accent },
  title: { ...typography.title, color: c.text, marginTop: 4 },
  headerBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  headerEmoji: { fontSize: 24 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  reviewHero: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...shadows.hero,
  },
  reviewOrb: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -60,
    right: -40,
  },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    ...typography.title,
    color: c.onDark,
    marginTop: spacing.md,
    fontSize: 23,
  },
  reviewBody: {
    ...typography.caption,
    color: c.onDarkMuted,
    marginTop: spacing.sm,
    lineHeight: 19,
    maxWidth: 360,
  },
  reviewCta: { marginTop: spacing.lg },
  loadingText: { ...typography.caption, color: c.textMuted, paddingVertical: spacing.lg },
  moreText: { ...typography.caption, color: c.textFaint, textAlign: 'center', marginTop: spacing.md },
  wordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  wordPlay: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordTarget: { ...typography.heading, color: c.text, fontSize: 17 },
  wordTranslation: { ...typography.caption, color: c.textMuted, marginTop: 1 },
  wordMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  wordLang: { ...typography.micro, fontSize: 9.5, color: c.textFaint },
  wordDue: { ...typography.micro, fontSize: 9.5, color: c.textFaint },
  wordDueNow: { color: c.accent },
  boxCard: {
    backgroundColor: c.surfaceTint,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginTop: spacing.lg,
  },
  boxTitle: { ...typography.bodyStrong, color: c.text },
  boxBody: { ...typography.caption, color: c.textMuted, marginTop: spacing.xs, lineHeight: 19 },
  boxRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.lg },
  boxItem: { flex: 1, alignItems: 'center', gap: 3 },
  boxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: c.primary },
  boxLabel: { ...typography.micro, fontSize: 9, color: c.textMuted },
  boxCount: { ...typography.bodyStrong, color: c.text, fontSize: 13 },
  langRail: { gap: spacing.sm, paddingVertical: spacing.lg, paddingRight: spacing.lg },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
  },
  langChipActive: { backgroundColor: c.primary, borderColor: c.primary },
  langFlag: { fontSize: 14 },
  langName: { ...typography.caption, color: c.textMuted },
  langNameActive: { color: c.onDark, fontWeight: '700' },
  mineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: c.success },
  phraseHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  phraseTitle: { ...typography.heading, color: c.text },
  phraseSub: { ...typography.caption, color: c.textMuted, marginTop: 2 },
  addLang: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: c.primaryTint,
  },
  addLangText: { ...typography.micro, color: c.primary, fontSize: 10 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, ...typography.body, color: c.text, paddingVertical: spacing.sm },
  countLine: { ...typography.micro, color: c.textFaint, marginTop: spacing.md, marginBottom: spacing.sm },
  phraseCard: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  phraseTarget: { ...typography.heading, color: c.text, fontSize: 18 },
  phraseRoman: { ...typography.caption, color: c.textFaint, fontStyle: 'italic', marginTop: 2 },
  phraseEnglish: { ...typography.caption, color: c.textMuted, marginTop: 3 },
  phraseMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  phraseSource: { ...typography.micro, fontSize: 9, color: c.textFaint },
  phraseActions: { justifyContent: 'center', gap: spacing.sm },
  phraseAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phraseActionSaved: { backgroundColor: c.successSoft },
  levelCard: {
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    overflow: 'hidden',
    ...shadows.hero,
  },
  levelOrb: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(242,193,78,0.10)',
    top: -80,
    right: -50,
  },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  levelBadge: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: { ...typography.title, color: c.sun },
  levelTitle: { ...typography.bodyStrong, color: c.onDark, fontSize: 16 },
  levelSub: { ...typography.caption, color: c.onDarkMuted, marginTop: 2 },
  levelProgress: { marginTop: spacing.lg },
  levelNote: { ...typography.micro, color: c.onDarkFaint, marginTop: spacing.sm, letterSpacing: 0.2, fontWeight: '500' },
  weekCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
  },
  weekBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  weekCol: { flex: 1, alignItems: 'center' },
  weekTrack: { width: '100%', height: 56, justifyContent: 'flex-end', alignItems: 'center' },
  weekBar: { width: '62%', borderRadius: 99 },
  weekDay: { ...typography.micro, color: c.textFaint, marginTop: 6 },
  weekDayToday: { color: c.text },
  weekNote: { ...typography.caption, color: c.textMuted, marginTop: spacing.md },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  badgeCard: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  badgeCardUnlocked: { borderColor: c.success, backgroundColor: c.successSoft },
  badgeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badgeEmoji: { fontSize: 24 },
  badgeEmojiLocked: { opacity: 0.35 },
  badgeTitle: { ...typography.bodyStrong, color: c.text, marginTop: spacing.sm, fontSize: 14 },
  badgeTitleLocked: { color: c.textMuted },
  badgeBody: { ...typography.caption, color: c.textMuted, marginTop: 2, lineHeight: 17, minHeight: 34 },
  badgeProgress: { marginTop: spacing.sm },
  badgeCount: { ...typography.micro, fontSize: 9, color: c.textFaint, marginTop: 4 },
  xpCard: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  xpDivider: { borderBottomWidth: 1, borderBottomColor: c.border },
  xpLabel: { ...typography.caption, color: c.textMuted },
  xpValue: { ...typography.caption, color: c.primary, fontWeight: '700' },
});
