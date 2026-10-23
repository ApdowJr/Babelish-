import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  REMINDER_SLOTS,
  isDailyReminderNotification,
  isValidSlot,
  reminderBody,
  reminderTitle,
  slotByKey,
  slotKey,
  slotLabel,
} from '../src/lib/reminder';

test('daily reminder presets are valid unique local times', () => {
  const keys = REMINDER_SLOTS.map(({ hour, minute }) => {
    assert.equal(isValidSlot(hour, minute), true);
    return slotKey(hour, minute);
  });
  assert.equal(new Set(keys).size, keys.length, 'preset times must be unique');
});

test('slot validation rejects out-of-range and non-integer values', () => {
  for (const [hour, minute] of [
    [-1, 0],
    [24, 0],
    [12, -1],
    [12, 60],
    [1.5, 0],
    [8, 2.5],
  ]) {
    assert.equal(isValidSlot(hour, minute), false, `${hour}:${minute} must be invalid`);
  }
  assert.equal(isValidSlot(0, 0), true);
  assert.equal(isValidSlot(23, 59), true);
});

test('slot keys are zero-padded and presets can be looked up', () => {
  assert.equal(slotKey(8, 0), '08:00');
  assert.equal(slotKey(21, 0), '21:00');
  assert.equal(slotByKey('08:00')?.label, 'Morning');
  assert.equal(slotByKey('not-a-slot'), null);
  assert.equal(slotLabel(8, 0), '🌅 Morning');
  assert.equal(slotLabel(9, 15), '⏰ 09:15');
});

test('reminder title uses the current Babelish brand', () => {
  assert.equal(reminderTitle(), 'Babelish 🌍');
});


test('daily reminder matching never treats test or unrelated notifications as the daily reminder', () => {
  assert.equal(isDailyReminderNotification('Babelish 🌍', undefined), true, 'supports older scheduled reminders');
  assert.equal(isDailyReminderNotification('Updated title', { kind: 'babelish-daily-reminder' }), true);
  assert.equal(isDailyReminderNotification('This is your reminder', { kind: 'babelish-test-reminder' }), false);
  assert.equal(isDailyReminderNotification('Another app notification', { kind: 'other' }), false);
});

test('reminder copy invites practice without shaming the learner', () => {
  assert.equal(
    reminderBody({ languageName: 'Spanish', streak: 0 }),
    'Your Spanish practice is ready when you are — a few minutes is enough.',
  );
  assert.equal(
    reminderBody({ languageName: 'French', streak: 3, name: 'Amina' }),
    'Amina, your 3-day French streak is waiting — one quick practice keeps it alive.',
  );
  assert.doesNotMatch(reminderBody({ languageName: 'English', streak: 0 }), /lazy|failed|lost/i);
});
