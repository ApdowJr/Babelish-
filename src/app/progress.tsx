import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card, SectionHeader } from '@/components/SectionHeader';
import { ProgressBar } from '@/components/ProgressBar';
import { StatTile } from '@/components/StatTile';
import { useAnalytics } from '@/state/analytics';
import { useLearning } from '@/state/learning';
import { usePreferences } from '@/state/preferences';
import {
  activeDays,
  activityLevel,
  calendarWeeks,
  focusSkill,
  skillBreakdown,
  DAY_INITIALS,
  type DayCell,
} from '@/lib/progressCalendar';
import { computeStreak } from '@/lib/analytics';
import { levelForXp, todayXp } from '@/lib/xp';
import { spacing, radii, typography, type Palette } from '@/theme/tokens';
import { useTheme, useThemedStyles } from '@/theme/theme';

/**
 * Progress, in full.
 *
 * The home screen shows the streak as one number; this screen explains it —
 * which days were active, how each skill is actually doing, and what to
 * practise next. Everything here is computed from the local analytics store,
 * so an empty account shows empty states rather than invented history.
 */

const WEEKDAYS = DAY_INITIALS;

export default function ProgressScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { state: analytics } = useAnalytics();
  const { wordsMastered } = useLearning();
  const { dailyGoalMinutes } = usePreferences();

  // One clock read per render pass; the calendar and the streak agree by
  // construction because they use the same instant.
  const now = useMemo(() => new Date(), []);
  const weeks = useMemo(() => calendarWeeks(analytics.events, { now }), [analytics.events, now]);
  const streak = useMemo(() => computeStreak(analytics.events, now), [analytics.events, now]);
  const daysActive = activeDays(weeks);
  const rows = useMemo(() => skillBreakdown(analytics), [analytics]);
  const focus = focusSkill(rows);
  const level = levelForXp(analytics.xp.lifetime);
  const xpToday = todayXp(analytics.xp);
  const goalXp = dailyGoalMinutes * 10;
  const hasHistory = analytics.events.length > 0;

  return (
    <Screen scroll>
      {/* ── Hero: the three numbers a learner actually cares about ── */}
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>YOUR MOMENTUM</Text>
        <View style={styles.heroRow}>
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{streak}</Text>
            <Text style={styles.heroLabel}>day streak</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{daysActive}</Text>
            <Text style={styles.heroLabel}>active days</Text>
          </View>
          <View style={styles.heroDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroValue}>{analytics.xp.lifetime}</Text>
            <Text style={styles.heroLabel}>lifetime XP</Text>
          </View>
        </View>
        <Text style={styles.heroHint}>
          {streak === 0
            ? 'Finish one exercise today to start a streak.'
            : xpToday >= goalXp
              ? `Today's goal is done — ${xpToday} of ${goalXp} XP.`
              : `${Math.max(0, goalXp - xpToday)} XP to today's goal.`}
        </Text>
      </View>

      {/* ── Calendar ── */}
      <SectionHeader title="Last 6 weeks" icon="calendar-outline" />
      <Card>
        <View style={styles.weekdayRow}>
          {WEEKDAYS.map((initial, index) => (
            <Text key={`${initial}-${index}`} style={styles.weekday}>
              {initial}
            </Text>
          ))}
        </View>

        <View style={styles.calendar}>
          {weeks.map((week) => (
            <View key={week.days[0].key} style={styles.calendarColumn}>
              <Text style={styles.monthLabel}>{week.monthLabel ?? ''}</Text>
              <View style={styles.calendarDays}>
                {week.days.map((day) => (
                  <DayDot key={day.key} day={day} />
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.legend}>
          <Text style={styles.legendText}>Quiet</Text>
          {([0, 1, 2, 3] as const).map((level) => (
            <View key={level} style={[styles.legendSwatch, dayFill(colors, level)]} />
          ))}
          <Text style={styles.legendText}>Busy</Text>
          <View style={styles.legendSpacer} />
          <Text style={styles.legendText}>
            {daysActive === 0 ? 'No activity yet' : `${daysActive} of 42 days`}
          </Text>
        </View>
      </Card>

      {/* ── Level ── */}
      <SectionHeader title="Level" icon="trending-up-outline" />
      <Card>
        <View style={styles.levelRow}>
          <View style={styles.levelBadge}>
            <Text style={styles.levelNumber}>{level.level}</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.levelTitle}>Level {level.level}</Text>
            <Text style={styles.levelHint}>
              {`${Math.max(0, level.target - analytics.xp.lifetime)} XP to level ${level.level + 1}`}
            </Text>
          </View>
        </View>
        <ProgressBar value={level.pct} height={8} label="Level progress" showPct />
      </Card>

      {/* ── Skills ── */}
      <SectionHeader title="Skills" icon="analytics-outline" />
      <Card>
        {rows.map((row) => {
          const pct = row.accuracy === null ? 0 : row.accuracy;
          const measured = row.accuracy !== null;
          return (
            <View key={row.skill} style={styles.skillRow}>
              <View style={styles.skillHead}>
                <View style={styles.skillName}>
                  <Ionicons name={row.icon} size={16} color={colors.primary} />
                  <Text style={styles.skillLabel}>{row.label}</Text>
                </View>
                <Text style={[styles.skillValue, !measured && styles.skillValueMuted]}>
                  {measured ? `${Math.round(pct * 100)}%` : 'Not enough yet'}
                </Text>
              </View>
              <ProgressBar
                value={pct}
                height={6}
                color={measured ? colors.primary : colors.borderStrong}
                trackColor={colors.surfaceHigh}
              />
              <Text style={styles.skillMeta}>
                {row.samples === 0
                  ? 'No practice logged'
                  : `${row.samples} ${row.samples === 1 ? 'result' : 'results'} · ${
                      row.skill === 'speak' ? 'average match' : 'correct'
                    }`}
              </Text>
            </View>
          );
        })}
      </Card>

      {/* ── What next ── */}
      <SectionHeader title="What next" icon="compass-outline" />
      {hasHistory ? (
        <Card
          onPress={() =>
            focus?.skill === 'speak' ? router.push('/speak') : router.push('/review')
          }
          accessibilityLabel={
            focus ? `Practise ${focus.label.toLowerCase()} next` : 'Open today’s review'
          }
        >
          <View style={styles.nextRow}>
            <View style={styles.nextIcon}>
              <Ionicons
                name={focus?.skill === 'speak' ? 'mic-outline' : 'repeat-outline'}
                size={18}
                color={colors.primary}
              />
            </View>
            <View style={styles.flex}>
              <Text style={styles.nextTitle}>
                {focus ? `Practise ${focus.label.toLowerCase()}` : 'Keep the rhythm going'}
              </Text>
              <Text style={styles.nextHint}>
                {focus
                  ? `Your lowest measured skill right now — ${Math.round((focus.accuracy ?? 0) * 100)}% over ${focus.samples} results.`
                  : 'Every skill is solid. A short review keeps words from slipping.'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
          </View>
        </Card>
      ) : (
        <Card>
          <Text style={styles.emptyTitle}>Nothing to chart yet</Text>
          <Text style={styles.emptyBody}>
            Finish your first lesson and this page fills in: your streak, the days you practised,
            and an honest accuracy per skill — no placeholder percentages.
          </Text>
          <Pressable
            onPress={() => router.push('/learn')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.emptyCta, pressed && styles.pressed]}
          >
            <Text style={styles.emptyCtaText}>Pick a lesson</Text>
            <Ionicons name="arrow-forward" size={15} color={colors.primary} />
          </Pressable>
        </Card>
      )}

      {/* ── Vocabulary + records, only when there is something to say ── */}
      <View style={styles.tiles}>
        <StatTile icon="star" value={`${wordsMastered}`} label="WORDS MASTERED" tint={colors.lilacInk} tintSoft={colors.lilacSoft} />
        <StatTile icon="flame" value={`${streak}`} label="DAY STREAK" tint={colors.accentInk} tintSoft={colors.accentSoft} />
        <StatTile icon="sparkles" value={`${xpToday}`} label="XP TODAY" tint={colors.sunInk} tintSoft={colors.sunSoft} />
      </View>
    </Screen>
  );
}

/** The four activity steps, in palette terms — one source for cells and legend. */
function dayFill(colors: Palette, level: 0 | 1 | 2 | 3) {
  if (level === 0) return { backgroundColor: colors.surfaceHigh };
  if (level === 1) return { backgroundColor: colors.primarySoft };
  if (level === 2) return { backgroundColor: colors.mintSoft };
  return { backgroundColor: colors.primary };
}

/** One day. A quiet day is a soft dot, not an error. */
function DayDot({ day }: { day: DayCell }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const level = activityLevel(day.count);
  return (
    <View
      style={[
        styles.day,
        dayFill(colors, level),
        day.isToday && styles.dayToday,
        day.inFuture && styles.dayFuture,
      ]}
      accessibilityLabel={
        day.inFuture
          ? undefined
          : `${day.key}: ${day.count === 0 ? 'no activity' : `${day.count} ${day.count === 1 ? 'activity' : 'activities'}`}`
      }
    >
      <Text style={[styles.dayText, level >= 3 && styles.dayTextOnPrimary]}>{day.dayOfMonth}</Text>
    </View>
  );
}

const createStyles = (c: Palette) => StyleSheet.create({
  flex: { flex: 1 },

  hero: {
    backgroundColor: c.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  heroKicker: { ...typography.micro, color: c.textFaint },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  heroStat: { flex: 1, alignItems: 'center' },
  heroValue: { ...typography.display, color: c.primary },
  heroLabel: { ...typography.caption, color: c.textMuted, marginTop: 2 },
  heroDivider: { width: 1, height: 34, backgroundColor: c.border },
  heroHint: { ...typography.caption, color: c.textMuted, marginTop: spacing.md, textAlign: 'center' },

  weekdayRow: { flexDirection: 'row', marginBottom: 6 },
  weekday: { flex: 1, textAlign: 'center', ...typography.caption, color: c.textFaint },

  calendar: { flexDirection: 'row', gap: 4 },
  calendarColumn: { flex: 1, alignItems: 'center' },
  monthLabel: { ...typography.micro, color: c.textFaint, letterSpacing: 0.4, height: 16 },
  calendarDays: { gap: 4, alignSelf: 'stretch' },

  day: {
    aspectRatio: 1,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceHigh,
  },
  dayToday: { borderWidth: 1.5, borderColor: c.primary },
  dayFuture: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.border },
  // 10 px numerals: the lightest cell still carries `text`-level contrast, and
  // the solid step flips to `white` (dark ink at night — see the palette).
  dayText: { fontSize: 10, fontWeight: '700', color: c.textMuted },
  dayTextOnPrimary: { color: c.white },

  legend: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  legendText: { ...typography.caption, color: c.textFaint },
  legendSwatch: { width: 11, height: 11, borderRadius: 3 },
  legendSpacer: { flex: 1 },

  levelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  levelBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelNumber: { ...typography.heading, color: c.primary },
  levelTitle: { ...typography.bodyStrong, color: c.text },
  levelHint: { ...typography.caption, color: c.textMuted, marginTop: 2 },

  skillRow: { marginBottom: spacing.lg },
  skillHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  skillName: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  skillLabel: { ...typography.bodyStrong, color: c.text },
  skillValue: { ...typography.bodyStrong, color: c.primary },
  skillValueMuted: { ...typography.caption, color: c.textMuted, fontWeight: '600' },
  skillMeta: { ...typography.caption, color: c.textFaint, marginTop: 5 },

  nextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  nextIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: c.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextTitle: { ...typography.bodyStrong, color: c.text },
  nextHint: { ...typography.caption, color: c.textMuted, marginTop: 2, lineHeight: 18 },

  emptyTitle: { ...typography.heading, color: c.text },
  emptyBody: { ...typography.caption, color: c.textMuted, marginTop: 6, lineHeight: 19 },
  emptyCta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: spacing.md },
  emptyCtaText: { ...typography.bodyStrong, color: c.primary },
  pressed: { opacity: 0.85 },

  tiles: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, marginBottom: spacing.xxl },
});
