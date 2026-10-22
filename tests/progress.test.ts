/**
 * Tests for the 2.0 progress layer: daily XP (goal ring), achievements and
 * language counting. All pure functions — no React, no storage.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_XP,
  addXp,
  lessonXp,
  localDayKey,
  todayXp,
  weeklyXp,
} from '../src/lib/xp';
import {
  evaluateAchievements,
  languagesStartedFromProgress,
  unlockedCount,
  type AchievementInput,
} from '../src/lib/achievements';

const EMPTY_INPUT: AchievementInput = {
  lifetimeXp: 0,
  streak: 0,
  lessonsCompleted: 0,
  languagesStarted: 0,
  wordsSaved: 0,
  wordsMastered: 0,
  perfectLessons: 0,
  reviewSessions: 0,
  speakingAttempts: 0,
};

test('XP tracks today separately from the week and lifetime', () => {
  const monday = new Date(2026, 9, 5, 9, 0, 0); // local time, Monday
  const afterLesson = addXp(EMPTY_XP, 20, monday);
  assert.equal(afterLesson.lifetime, 20);
  assert.equal(afterLesson.weekly, 20);
  assert.equal(afterLesson.daily, 20);
  assert.equal(todayXp(afterLesson, monday), 20);
  assert.equal(weeklyXp(afterLesson, monday), 20);

  const sameDay = addXp(afterLesson, 5, new Date(2026, 9, 5, 18, 0, 0));
  assert.equal(todayXp(sameDay, monday), 25);

  const nextDay = addXp(sameDay, 20, new Date(2026, 9, 6, 9, 0, 0));
  assert.equal(nextDay.lifetime, 45);
  assert.equal(todayXp(nextDay, new Date(2026, 9, 6, 9, 0, 0)), 20);
  assert.equal(todayXp(nextDay, monday), 0, 'yesterday’s daily XP is not today’s');
  assert.equal(nextDay.weekly, 45);
});

test('weekly XP resets on a new ISO week, lifetime never does', () => {
  const sunday = new Date(2026, 9, 11, 20, 0, 0);
  const monday = new Date(2026, 9, 12, 8, 0, 0);
  const earned = addXp(EMPTY_XP, 50, sunday);
  assert.equal(weeklyXp(earned, sunday), 50);
  assert.equal(weeklyXp(earned, monday), 0);
  assert.equal(earned.lifetime, 50);
});

test('addXp ignores zero or negative awards', () => {
  assert.equal(addXp(EMPTY_XP, 0), EMPTY_XP);
  assert.equal(addXp(EMPTY_XP, -10), EMPTY_XP);
});

test('lesson XP rewards first completions and perfects, not same-day replays', () => {
  assert.equal(lessonXp({ firstCompletion: true, completedToday: false, perfect: false }), 20);
  assert.equal(lessonXp({ firstCompletion: true, completedToday: false, perfect: true }), 35);
  assert.equal(lessonXp({ firstCompletion: false, completedToday: true, perfect: true }), 0);
  assert.equal(lessonXp({ firstCompletion: false, completedToday: false, perfect: false }), 20);
});

test('localDayKey is stable and zero-padded', () => {
  assert.equal(localDayKey(new Date(2026, 0, 2, 3, 4, 5)), '2026-01-02');
});

test('achievements start locked and unlock at their targets', () => {
  const empty = evaluateAchievements(EMPTY_INPUT);
  assert.equal(empty.length, 12);
  assert.equal(unlockedCount(empty), 0);
  assert.ok(empty.every((badge) => badge.progress === 0 && badge.pct === 0));

  const firstSteps = evaluateAchievements({ ...EMPTY_INPUT, lessonsCompleted: 1 });
  assert.equal(firstSteps.find((badge) => badge.id === 'first-lesson')?.unlocked, true);
  assert.equal(firstSteps.find((badge) => badge.id === 'lesson-10')?.unlocked, false);

  const all = evaluateAchievements({
    lifetimeXp: 5000,
    streak: 30,
    lessonsCompleted: 60,
    languagesStarted: 6,
    wordsSaved: 200,
    wordsMastered: 40,
    perfectLessons: 10,
    reviewSessions: 20,
    speakingAttempts: 50,
  });
  assert.equal(unlockedCount(all), 12);
  assert.ok(all.every((badge) => badge.pct === 1));
});

test('achievement progress is capped at the target', () => {
  const badges = evaluateAchievements({ ...EMPTY_INPUT, wordsSaved: 500 });
  const collector = badges.find((badge) => badge.id === 'first-word');
  assert.equal(collector?.progress, 10);
  assert.equal(collector?.pct, 1);
});

test('languages started counts distinct languages with 70%+ lessons', () => {
  const progress = {
    'es-ch1-l1': { score: 80, completedAt: '2026-01-01' },
    'es-ch1-l2': { score: 95, completedAt: '2026-01-02' },
    'fr-ch1-l1': { score: 70, completedAt: '2026-01-02' },
    'ja-ch1-l1': { score: 40, completedAt: '2026-01-03' },
  };
  assert.equal(languagesStartedFromProgress(progress), 2);
  assert.equal(languagesStartedFromProgress({}), 0);
});
