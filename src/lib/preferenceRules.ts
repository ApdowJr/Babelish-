/**
 * Preference rules — pure, so a stored blob from an older version (or a
 * hand-edited one) can be validated without mounting React or touching
 * AsyncStorage.
 *
 * Every reader in the app treats these values as trusted: a bad `voiceSpeed`
 * would reach `Speech.speak` as a NaN rate, and a bad `showTranslation` would
 * make the composer render `undefined`. Validation happens exactly once, here.
 */

import { DEFAULT_LANGUAGE_ID } from '../data/languages';
import { isThemeMode, type ThemeMode } from '../theme/palette';

/** Daily goal options in minutes; XP target = minutes × 10 (published rule). */
export const DAILY_GOALS = [5, 10, 15, 20] as const;
export type DailyGoalMinutes = (typeof DAILY_GOALS)[number];
export const DEFAULT_DAILY_GOAL: DailyGoalMinutes = 10;

/** Speed of spoken playback, relative to the voice's normal rate. */
export const VOICE_SPEEDS = ['slow', 'normal', 'fast'] as const;
export type VoiceSpeed = (typeof VOICE_SPEEDS)[number];

export type Preferences = {
  /** Primary language the learner is studying (drives Speak + Home). */
  targetLanguageId: string;
  /** Language the learner speaks natively (used for AI explanations). */
  nativeLanguageId: string;
  /** Every language the learner has added to "My languages". */
  activeLanguageIds: string[];
  /** Chosen daily-reminder time as a slot key ("18:00"), null = off. */
  reminderKey: string | null;
  /** Chosen daily goal, in minutes. */
  dailyGoalMinutes: DailyGoalMinutes;
  /** False until the first-run welcome flow is finished. */
  onboarded: boolean;
  /** Show the translation under tutor replies by default. */
  showTranslation: boolean;
  /** Playback speed for every spoken line. */
  voiceSpeed: VoiceSpeed;
  /** Read new tutor replies aloud without waiting for a tap. */
  autoSpeak: boolean;
  /** Skip decorative animation (splash entrance, picker fades). */
  reduceMotion: boolean;
  /** Light, dark, or follow the device. */
  themeMode: ThemeMode;
};

export const DEFAULT_PREFERENCES: Preferences = {
  targetLanguageId: DEFAULT_LANGUAGE_ID,
  nativeLanguageId: 'en',
  activeLanguageIds: [DEFAULT_LANGUAGE_ID],
  reminderKey: null,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL,
  onboarded: false,
  showTranslation: true,
  voiceSpeed: 'normal',
  autoSpeak: false,
  reduceMotion: false,
  themeMode: 'system',
};

/** XP needed to fill the daily ring — one lesson is roughly 20–35 XP. */
export function dailyGoalXp(minutes: number): number {
  return Math.max(1, Math.round(minutes * 10));
}

export function isVoiceSpeed(value: unknown): value is VoiceSpeed {
  return typeof value === 'string' && (VOICE_SPEEDS as readonly string[]).includes(value);
}

type Validate = {
  /** True when the id exists in the course catalogue. */
  isKnownLanguage: (id: string) => boolean;
};

/**
 * Returns a complete, valid Preferences object for a stored blob.
 *
 * Anything unreadable keeps the fallback for that field rather than resetting
 * the whole object: a learner who edited one value should not lose their
 * streak language, and a blob written by 1.x (no `onboarded`) is treated as a
 * returning learner.
 */
export function normalizePreferences(raw: unknown, fallback: Preferences, validate: Validate): Preferences {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const parsed = raw as Record<string, unknown>;

  const target =
    typeof parsed.targetLanguageId === 'string' && validate.isKnownLanguage(parsed.targetLanguageId)
      ? parsed.targetLanguageId
      : fallback.targetLanguageId;

  const stored = Array.isArray(parsed.activeLanguageIds) ? parsed.activeLanguageIds : [];
  const active = Array.from(
    new Set(stored.filter((id): id is string => typeof id === 'string' && validate.isKnownLanguage(id)))
  );
  if (!active.includes(target)) active.unshift(target);
  if (active.length === 0) active.push(target);

  const goal = DAILY_GOALS.includes(parsed.dailyGoalMinutes as DailyGoalMinutes)
    ? (parsed.dailyGoalMinutes as DailyGoalMinutes)
    : fallback.dailyGoalMinutes;

  return {
    targetLanguageId: target,
    nativeLanguageId:
      typeof parsed.nativeLanguageId === 'string' && parsed.nativeLanguageId.length > 0
        ? parsed.nativeLanguageId
        : fallback.nativeLanguageId,
    activeLanguageIds: active,
    reminderKey:
      typeof parsed.reminderKey === 'string' || parsed.reminderKey === null
        ? (parsed.reminderKey as string | null)
        : fallback.reminderKey,
    dailyGoalMinutes: goal,
    onboarded: typeof parsed.onboarded === 'boolean' ? parsed.onboarded : fallback.onboarded,
    showTranslation:
      typeof parsed.showTranslation === 'boolean' ? parsed.showTranslation : fallback.showTranslation,
    voiceSpeed: isVoiceSpeed(parsed.voiceSpeed) ? parsed.voiceSpeed : fallback.voiceSpeed,
    autoSpeak: typeof parsed.autoSpeak === 'boolean' ? parsed.autoSpeak : fallback.autoSpeak,
    reduceMotion:
      typeof parsed.reduceMotion === 'boolean' ? parsed.reduceMotion : fallback.reduceMotion,
    themeMode: isThemeMode(parsed.themeMode) ? parsed.themeMode : fallback.themeMode,
  };
}
