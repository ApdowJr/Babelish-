import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  isValidSlot,
  reminderBody,
  reminderTitle,
  type ReminderSlot,
} from '@/lib/reminder';

/**
 * Daily practice reminders — LOCAL notifications only (no push servers, no
 * telemetry). Expo Go supports local notifications on SDK 58; only remote
 * push would need a development build, and Babelish doesn't use it.
 *
 * One repeating reminder at the learner's chosen time; we own the schedule,
 * so enabling replaces any previous reminder instead of stacking them.
 */

/**
 * Android notification channel. Must match `defaultChannel` in app.json's
 * expo-notifications plugin: a mismatch means a reminder scheduled here is
 * filed under a channel the OS never shows prominently.
 */
export const CHANNEL_ID = 'daily-reminder';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export type ReminderResult = 'scheduled' | 'denied' | 'error';

export async function scheduleDailyReminder(
  slot: ReminderSlot,
  copy: { languageName: string; streak: number; name?: string }
): Promise<ReminderResult> {
  if (!isValidSlot(slot.hour, slot.minute)) return 'error';
  try {
    // Android 13+ shows the permission prompt only after a channel exists.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily practice reminder',
        description: 'One calm reminder at the time you chose',
        // AndroidImportance.DEFAULT (verified = 5) — the enum lives in an
        // `export *` barrel that the lint namespace resolver can't see.
        importance: 5 /* AndroidImportance.DEFAULT */,
        vibrationPattern: [0, 150],
      });
    }

    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      (await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      })).granted;
    if (!granted) return 'denied';

    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: reminderTitle(),
        body: reminderBody(copy),
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: slot.hour,
        minute: slot.minute,
        channelId: CHANNEL_ID,
      },
    });
    return 'scheduled';
  } catch {
    return 'error';
  }
}

export async function cancelDailyReminder(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // nothing to cancel
  }
}

/** Whether a reminder is live in the OS (the pref alone can go stale). */
export async function isReminderScheduled(): Promise<boolean> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    return scheduled.length > 0;
  } catch {
    return false;
  }
}

/**
 * Fires one notification a few seconds from now, so a learner can prove the
 * permission and the channel actually work instead of waiting until 18:00.
 *
 * Deliberately a separate call from `scheduleDailyReminder`: a test must never
 * punch a hole in the recurring reminder, and it must not cancel it either.
 */
export async function sendTestReminder(): Promise<ReminderResult> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Daily practice reminder',
        description: 'One calm reminder at the time you chose',
        importance: 5 /* AndroidImportance.DEFAULT */,
        vibrationPattern: [0, 150],
      });
    }
    const current = await Notifications.getPermissionsAsync();
    const granted =
      current.granted ||
      (await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: false, allowSound: false },
      })).granted;
    if (!granted) return 'denied';

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'This is your reminder',
        body: 'It will arrive at your chosen time, quietly. Nothing else is sent.',
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        repeats: false,
        channelId: CHANNEL_ID,
      },
    });
    return 'scheduled';
  } catch {
    return 'error';
  }
}
