/**
 * The progress calendar — pure date maths, no React.
 *
 * Streaks are per local device day (see `computeStreak`), and this module
 * builds the same days as a grid: columns are weeks (Sunday → Saturday),
 * cells carry how much happened that day. Everything here is deterministic
 * given `now`, so the screen can be snapshot-tested without a clock.
 */
import {
  dayKey,
  skillAccuracy,
  type AnalyticsEvent,
  type AnalyticsState,
  type Skill,
} from './analytics';

export type DayCell = {
  /** Local `YYYY-MM-DD`. */
  key: string;
  dayOfMonth: number;
  /** Activity events that day (0 = quiet). */
  count: number;
  isToday: boolean;
  /** Days after today in the current week — drawn as empty, never as "missed". */
  inFuture: boolean;
};

export type CalendarWeek = {
  /** Seven cells, Sunday first. */
  days: DayCell[];
  /** Month abbreviation for this column's first day, or null to keep the row quiet. */
  monthLabel: string | null;
};

export const CALENDAR_WEEKS = 6;
export const DAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Events per local day. */
export function activityCounts(events: AnalyticsEvent[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const key = dayKey(new Date(event.at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/** Midnight of the Sunday that starts the week containing `date`. */
function weekStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay());
}

/**
 * The last `weeks` calendar weeks, oldest column first.
 *
 * The current week is always the last column, so "today" is on screen even
 * when the learner opens the app at 00:01 on a Sunday.
 */
export function calendarWeeks(
  events: AnalyticsEvent[],
  { weeks = CALENDAR_WEEKS, now = new Date() }: { weeks?: number; now?: Date } = {}
): CalendarWeek[] {
  const counts = activityCounts(events);
  const today = dayKey(now);
  const start = weekStart(now);
  start.setDate(start.getDate() - (weeks - 1) * 7);

  const out: CalendarWeek[] = [];
  let previousMonth = -1;
  for (let column = 0; column < weeks; column += 1) {
    const days: DayCell[] = [];
    for (let row = 0; row < 7; row += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + column * 7 + row);
      const key = dayKey(date);
      days.push({
        key,
        dayOfMonth: date.getDate(),
        count: counts.get(key) ?? 0,
        isToday: key === today,
        inFuture: date.getTime() > now.getTime() && key !== today,
      });
    }
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate() + column * 7);
    const month = first.getMonth();
    // Label the column when the month turns over — one label per month, not per row.
    const monthLabel = month !== previousMonth ? MONTHS[month] : null;
    previousMonth = month;
    out.push({ days, monthLabel });
  }
  return out;
}

/** Distinct days with at least one event, within the calendar window. */
export function activeDays(weeks: CalendarWeek[]): number {
  return weeks.reduce((sum, week) => sum + week.days.filter((d) => d.count > 0).length, 0);
}

/** 0 = nothing, 1 = a little, 2 = a solid session, 3 = a heavy day. */
export function activityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count < 5) return 1;
  if (count < 12) return 2;
  return 3;
}

/* ---------------- skill breakdown ---------------- */

export type SkillRow = {
  skill: Skill;
  label: string;
  icon: 'book-outline' | 'headset-outline' | 'create-outline' | 'mic-outline';
  /** 0..1, or null when there is not enough honest data to show a number. */
  accuracy: number | null;
  /** How many results feed the number (answers, or speaking attempts). */
  samples: number;
};

const SKILL_META: Record<Skill, { label: string; icon: SkillRow['icon'] }> = {
  read: { label: 'Reading', icon: 'book-outline' },
  listen: { label: 'Listening', icon: 'headset-outline' },
  write: { label: 'Writing', icon: 'create-outline' },
  speak: { label: 'Speaking', icon: 'mic-outline' },
};

/**
 * One row per skill, in a fixed order so the screen never jumps around.
 *
 * A skill with too few answers reports `accuracy: null` — the screen says
 * "Not enough yet" rather than drawing a confident percentage from one tap.
 */
export function skillBreakdown(state: AnalyticsState): SkillRow[] {
  return (['read', 'listen', 'write', 'speak'] as const).map((skill) => ({
    skill,
    label: SKILL_META[skill].label,
    icon: SKILL_META[skill].icon,
    accuracy: skillAccuracy(state, skill),
    samples: skill === 'speak' ? state.speak.count : state[skill].total,
  }));
}

/** The skill with the lowest honest accuracy, for the "practice this next" card. */
export function focusSkill(rows: SkillRow[]): SkillRow | null {
  let focus: SkillRow | null = null;
  for (const row of rows) {
    if (row.accuracy === null) continue;
    if (focus === null || row.accuracy < (focus.accuracy ?? 1)) focus = row;
  }
  return focus;
}
