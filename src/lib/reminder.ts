/**
 * Smart reminders — the learner picks WHEN, we only repeat it daily.
 * Pure slot/copy logic here (node-testable); the expo-notifications side
 * lives in `@/lib/notifications` so this file stays dependency-free.
 */

export type ReminderSlot = { hour: number; minute: number; label: string; icon: string };

/** Four honest presets — no guilt-trip copy, no engagement-bait timing. */
export const REMINDER_SLOTS: ReminderSlot[] = [
  { hour: 8, minute: 0, label: 'Morning', icon: '🌅' },
  { hour: 12, minute: 30, label: 'Lunch', icon: '🕛' },
  { hour: 18, minute: 0, label: 'Evening', icon: '🌆' },
  { hour: 21, minute: 0, label: 'Night', icon: '🌙' },
];

export function isValidSlot(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour <= 23 &&
    minute >= 0 &&
    minute <= 59
  );
}

/** Stable storage key for a chosen time (e.g. "18:00"). */
export function slotKey(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function slotByKey(key: string): ReminderSlot | null {
  return REMINDER_SLOTS.find((slot) => slotKey(slot.hour, slot.minute) === key) ?? null;
}

export function slotLabel(hour: number, minute: number): string {
  const match = slotByKey(slotKey(hour, minute));
  if (match) return `${match.icon} ${match.label}`;
  return `⏰ ${slotKey(hour, minute)}`;
}

/**
 * Notification copy: factual and calm — invites practice, never shames
 * an absence (ethical gamification: no dark patterns).
 */
export function reminderTitle(): string {
  return 'Babelish 🌍';
}

/** Identifies this app's daily reminder without matching unrelated notifications. */
export function isDailyReminderNotification(
  title: string | null | undefined,
  data: unknown,
): boolean {
  if (data && typeof data === 'object' && 'kind' in data) {
    if ((data as { kind?: unknown }).kind === 'babelish-daily-reminder') return true;
  }
  // Backward compatibility for reminders scheduled before the marker existed.
  return title === reminderTitle();
}

export function reminderBody(input: {
  languageName: string;
  streak: number;
  name?: string;
}): string {
  const who = input.name ? `${input.name}, y` : 'Y';
  if (input.streak > 0) {
    return `${who}our ${input.streak}-day ${input.languageName} streak is waiting — one quick practice keeps it alive.`;
  }
  return `${who}our ${input.languageName} practice is ready when you are — a few minutes is enough.`;
}
