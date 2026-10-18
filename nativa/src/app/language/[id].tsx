import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { getLanguage } from '@/data/languages';
import { usePreferences } from '@/state/preferences';
import { colors, radii, spacing, typography } from '@/theme/tokens';

export default function LanguageDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const language = getLanguage(String(id));
  const { targetLanguageId, setTargetLanguage } = usePreferences();
  const isCurrent = language.id === targetLanguageId;

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Text style={styles.flag}>{language.flag}</Text>
        <Text style={styles.name}>{language.name}</Text>
        <Text style={styles.native}>{language.nativeName}</Text>
        <View style={styles.metaRow}>
          <View style={styles.metaPill}>
            <Ionicons name="people-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{language.nativeSpeakers}</Text>
          </View>
          <View style={styles.metaPill}>
            <Ionicons name="text-outline" size={13} color={colors.textMuted} />
            <Text style={styles.metaText}>{language.script}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.blurb}>{language.blurb}</Text>

      <Text style={styles.sectionLabel}>DIALECTS WE TEACH</Text>
      <View style={styles.chipsWrap}>
        {language.dialects.map((dialect) => (
          <Chip key={dialect} label={dialect} />
        ))}
      </View>

      <Text style={styles.sectionLabel}>REAL-LIFE SCENARIOS</Text>
      <View style={styles.group}>
        {language.scenarios.map((scenario, index) => (
          <View key={scenario.id}>
            {index > 0 ? <View style={styles.rowDivider} /> : null}
            <View style={styles.scenarioRow}>
              <Text style={styles.scenarioEmoji}>{scenario.emoji}</Text>
              <Text style={styles.scenarioTitle}>{scenario.title}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.comingSoon}>
        CEFR chapters, pronunciation scoring, and native-speaker review arrive in Phases 1–2 of the
        roadmap — the Speak tab is live today.
      </Text>

      <Button
        label={isCurrent ? `Continue speaking ${language.name}` : `Start speaking ${language.name}`}
        onPress={() => {
          setTargetLanguage(language.id);
          router.push('/speak');
        }}
        style={{ marginTop: spacing.xl }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: spacing.lg },
  flag: { fontSize: 64 },
  name: { ...typography.display, color: colors.text, marginTop: spacing.md },
  native: { ...typography.heading, color: colors.textMuted, marginTop: spacing.xs },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceHigh,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaText: { ...typography.caption, color: colors.textMuted },
  blurb: {
    ...typography.body,
    color: colors.text,
    lineHeight: 23,
    marginTop: spacing.xl,
  },
  sectionLabel: {
    ...typography.micro,
    color: colors.textFaint,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  group: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
  },
  scenarioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 54,
    paddingVertical: spacing.md,
  },
  scenarioEmoji: { fontSize: 22 },
  scenarioTitle: { ...typography.body, color: colors.text },
  rowDivider: { height: 1, backgroundColor: colors.border },
  comingSoon: {
    ...typography.caption,
    color: colors.textFaint,
    lineHeight: 18,
    marginTop: spacing.lg,
  },
});
