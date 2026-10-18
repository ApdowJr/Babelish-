import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { LANGUAGES } from '@/data/languages';
import { usePreferences } from '@/state/preferences';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function LearnScreen() {
  const [query, setQuery] = useState('');
  const { targetLanguageId } = usePreferences();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.dialects.some((d) => d.toLowerCase().includes(q))
    );
  }, [query]);

  return (
    <Screen scroll>
      <Text style={styles.title}>Learn a language</Text>
      <Text style={styles.subtitle}>
        Real dialects, real scenarios — pick where you want to be fluent.
      </Text>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={colors.textFaint} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search Spanish, العربية, Kansai…"
          placeholderTextColor={colors.textFaint}
          autoCapitalize="none"
          accessibilityLabel="Search languages"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color={colors.textFaint} />
          </Pressable>
        ) : null}
      </View>

      {filtered.map((language) => {
        const isLearning = language.id === targetLanguageId;
        return (
          <Pressable
            key={language.id}
            onPress={() => router.push(`/language/${language.id}`)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <Text style={styles.flag}>{language.flag}</Text>
            <View style={styles.cardBody}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardTitle}>{language.name}</Text>
                {isLearning ? (
                  <View style={styles.learningBadge}>
                    <Text style={styles.learningBadgeText}>Learning</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.cardNative}>{language.nativeName}</Text>
              <Text style={styles.cardMeta}>
                {language.nativeSpeakers} · {language.dialects.length} dialects
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
          </Pressable>
        );
      })}

      {filtered.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyEmoji}>🌍</Text>
          <Text style={styles.emptyText}>
            No match yet — but every language is on the roadmap. Tell us which one you want next in
            your profile feedback.
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, color: colors.text, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    minHeight: 48,
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  searchInput: { flex: 1, ...typography.body, color: colors.text, paddingVertical: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardPressed: { opacity: 0.8 },
  flag: { fontSize: 34 },
  cardBody: { flex: 1 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { ...typography.heading, color: colors.text },
  cardNative: { ...typography.body, color: colors.textMuted, marginTop: 2 },
  cardMeta: { ...typography.caption, color: colors.textFaint, marginTop: spacing.xs },
  learningBadge: {
    backgroundColor: colors.successSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  learningBadgeText: { ...typography.micro, color: colors.success },
  empty: { alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.md },
  emptyEmoji: { fontSize: 36 },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: spacing.xl,
  },
});
