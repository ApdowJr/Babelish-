/**
 * Calendar + skill-breakdown maths for the progress screen.
 *
 * The screen's whole job is to be believable: the wrong day in a cell or a
 * percentage drawn from one lucky answer destroys that. These tests fix the
 * grid geometry, the future/past boundary and the "not enough data" rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY_INITIALS,
  activeDays,
  activityLevel,
  calendarWeeks,
  focusSkill,
  skillBreakdown,
} from '../src/lib/progressCalendar';
import { EMPTY_ANALYTICS, type AnalyticsEvent, type AnalyticsState } from '../src/lib/analytics';

const at = (iso: string): Date => new Date(iso);
const event = (date: Date): AnalyticsEvent => ({ name: 'lesson_completed', at: date.toISOString() });

/** Wednesday 2026-10-21, 15:00 local. */
const NOW = new Date(2026, 9, 21, 15, 0, 0);

test('the grid is a full rectangle of weeks, Sunday first', () => {
  const weeks = calendarWeeks([], { now: NOW });
  assert.equal(weeks.length, 6);
  for (const week of weeks) {
    assert.equal(week.days.length, 7);
    const first = new Date(`${week.days[0].key}T00:00:00`);
    assert.equal(first.getDay(), 0, `${week.days[0].key} should be a Sunday`);
    assert.equal(DAY_INITIALS[first.getDay()], 'S');
  }
});

test('the current week is the last column and contains today', () => {
  const weeks = calendarWeeks([], { now: NOW });
  const todayCells = weeks.flatMap((w) => w.days).filter((d) => d.isToday);
  assert.equal(todayCells.length, 1);
  assert.equal(todayCells[0].key, '2026-10-21');
  assert.ok(weeks[weeks.length - 1].days.some((d) => d.isToday));
});

test('days before today are never marked as future, and vice versa', () => {
  const cells = calendarWeeks([], { now: NOW }).flatMap((w) => w.days);
  const today = cells.find((c) => c.isToday)!;
  for (const cell of cells) {
    const date = new Date(`${cell.key}T00:00:00`);
    if (date > NOW) assert.equal(cell.inFuture, true, `${cell.key} is in the future`);
    if (date < new Date(2026, 9, 21, 0, 0, 0)) assert.equal(cell.inFuture, false);
  }
  assert.equal(today.inFuture, false);
});

test('a quiet day reads as zero, not as a gap in the calendar', () => {
  const counts = calendarWeeks([event(at('2026-10-20T09:00:00'))], { now: NOW })
    .flatMap((w) => w.days)
    .reduce<Record<string, number>>((acc, d) => ({ ...acc, [d.key]: d.count }), {});
  assert.equal(counts['2026-10-20'], 1);
  assert.equal(counts['2026-10-19'], 0);
});

test('events from the same day add up, and days outside the window are ignored', () => {
  const weeks = calendarWeeks(
    [
      event(at('2026-10-21T08:00:00')),
      event(at('2026-10-21T09:30:00')),
      event(at('2026-10-21T22:45:00')),
      event(at('2026-01-01T10:00:00')),
    ],
    { now: NOW }
  );
  const cells = weeks.flatMap((w) => w.days);
  assert.equal(cells.find((c) => c.key === '2026-10-21')!.count, 3);
  assert.equal(cells.find((c) => c.key === '2026-01-01'), undefined);
});

test('month labels appear once per month, left to right', () => {
  const label = (iso: string) => {
    const weeks = calendarWeeks([], { now: at(iso) });
    return weeks.map((w) => w.monthLabel);
  };
  // Mid-October: the window starts in September, so exactly one turn.
  const october = label('2026-10-21T12:00:00');
  assert.equal(october.filter(Boolean).length, 2);
  assert.deepEqual(october.filter(Boolean), ['Sep', 'Oct']);
  // A mid-month window that starts in the same month has a single label.
  const short = calendarWeeks([], { weeks: 2, now: NOW });
  assert.deepEqual(short.map((w) => w.monthLabel), ['Oct', null]);
});

test('active days count real practice only', () => {
  const weeks = calendarWeeks(
    [event(at('2026-10-20T09:00:00')), event(at('2026-10-20T10:00:00')), event(at('2026-10-18T09:00:00'))],
    { now: NOW }
  );
  assert.equal(activeDays(weeks), 2);
  assert.equal(activeDays(calendarWeeks([], { now: NOW })), 0);
});

test('activity levels are monotonic and capped', () => {
  assert.deepEqual([0, 1, 4, 5, 11, 12, 40].map(activityLevel), [0, 1, 1, 2, 2, 3, 3]);
});

/* ---------- skills ---------- */

function withTallies(overrides: Partial<AnalyticsState>): AnalyticsState {
  return { ...EMPTY_ANALYTICS, ...overrides };
}

test('one lucky answer never becomes a percentage', () => {
  const rows = skillBreakdown(withTallies({ read: { correct: 1, total: 1 } }));
  const read = rows.find((r) => r.skill === 'read')!;
  assert.equal(read.samples, 1);
  assert.equal(read.accuracy, null);
});

test('enough answers produce an honest ratio', () => {
  const rows = skillBreakdown(withTallies({ listen: { correct: 6, total: 8 } }));
  assert.equal(rows.find((r) => r.skill === 'listen')!.accuracy, 0.75);
});

test('speaking reports the average of its attempts, not a pass rate', () => {
  const rows = skillBreakdown(withTallies({ speak: { scoreSum: 340, count: 4 } }));
  const speak = rows.find((r) => r.skill === 'speak')!;
  assert.equal(speak.samples, 4);
  assert.equal(speak.accuracy, 0.85);
});

test('every skill appears once, in a stable order', () => {
  const rows = skillBreakdown(EMPTY_ANALYTICS);
  assert.deepEqual(
    rows.map((r) => r.skill),
    ['read', 'listen', 'write', 'speak']
  );
  assert.deepEqual(
    rows.map((r) => r.label),
    ['Reading', 'Listening', 'Writing', 'Speaking']
  );
  assert.ok(rows.every((r) => r.accuracy === null && r.samples === 0));
});

test('focus picks the weakest measured skill and ignores unmeasured ones', () => {
  const focus = focusSkill(
    skillBreakdown(
      withTallies({
        read: { correct: 9, total: 10 },
        write: { correct: 4, total: 10 },
        listen: { correct: 2, total: 2 },
      })
    )
  );
  assert.equal(focus?.skill, 'write');
  assert.equal(focusSkill(skillBreakdown(EMPTY_ANALYTICS)), null);
});
