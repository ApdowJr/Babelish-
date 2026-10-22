import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE_ID, getLanguage, isKnownLanguage } from '@/data/languages';

/** Daily goal options in minutes; XP target = minutes × 10 (published rule). */
export const DAILY_GOALS = [5, 10, 15, 20] as const;
export type DailyGoalMinutes = (typeof DAILY_GOALS)[number];

export const DEFAULT_DAILY_GOAL: DailyGoalMinutes = 10;

/** XP needed to fill the daily ring — one lesson is roughly 20–35 XP. */
export function dailyGoalXp(minutes: number): number {
  return Math.max(1, Math.round(minutes * 10));
}

type Preferences = {
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
};

type PreferencesValue = Preferences & {
  /** True once the stored preferences have been read from the device. */
  ready: boolean;
  setTargetLanguage: (id: string) => void;
  setNativeLanguage: (id: string) => void;
  /** null clears the reminder preference (OS scheduling is handled by the UI). */
  setReminderKey: (key: string | null) => void;
  setDailyGoal: (minutes: DailyGoalMinutes) => void;
  /** Adds/removes a language from "My languages" (never below one). */
  toggleMyLanguage: (id: string) => void;
  completeOnboarding: () => void;
};

const STORAGE_KEY = 'zelvoca:preferences';

const DEFAULTS: Preferences = {
  targetLanguageId: DEFAULT_LANGUAGE_ID,
  nativeLanguageId: 'en',
  activeLanguageIds: [DEFAULT_LANGUAGE_ID],
  reminderKey: null,
  dailyGoalMinutes: DEFAULT_DAILY_GOAL,
  onboarded: false,
};

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);

function uniqueKnownIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter((id) => typeof id === 'string' && isKnownLanguage(id))));
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        setPrefs((prev) => {
          const target =
            typeof parsed.targetLanguageId === 'string' && isKnownLanguage(parsed.targetLanguageId)
              ? parsed.targetLanguageId
              : prev.targetLanguageId;
          const active = uniqueKnownIds(
            Array.isArray(parsed.activeLanguageIds) ? parsed.activeLanguageIds : []
          );
          if (!active.includes(target)) active.unshift(target);
          if (active.length === 0) active.push(target);
          const goal = DAILY_GOALS.includes(parsed.dailyGoalMinutes as DailyGoalMinutes)
            ? (parsed.dailyGoalMinutes as DailyGoalMinutes)
            : prev.dailyGoalMinutes;
          return {
            targetLanguageId: target,
            nativeLanguageId:
              typeof parsed.nativeLanguageId === 'string'
                ? parsed.nativeLanguageId
                : prev.nativeLanguageId,
            activeLanguageIds: active,
            reminderKey:
              typeof parsed.reminderKey === 'string' || parsed.reminderKey === null
                ? (parsed.reminderKey as string | null)
                : prev.reminderKey,
            dailyGoalMinutes: goal,
            // Migration: a stored 1.x preferences blob predates onboarding, so
            // its owner already knows the app — never re-show the welcome flow.
            onboarded: typeof parsed.onboarded === 'boolean' ? parsed.onboarded : true,
          };
        });
      })
      .catch(() => {
        // keep defaults
      })
      .finally(() => setReady(true));
  }, []);

  function update(patch: Partial<Preferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function setTargetLanguage(id: string) {
    if (!isKnownLanguage(id)) return;
    setPrefs((prev) => {
      const active = prev.activeLanguageIds.includes(id)
        ? prev.activeLanguageIds
        : [...prev.activeLanguageIds, id];
      const next = { ...prev, targetLanguageId: id, activeLanguageIds: active };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  function toggleMyLanguage(id: string) {
    if (!isKnownLanguage(id)) return;
    setPrefs((prev) => {
      const has = prev.activeLanguageIds.includes(id);
      if (has && prev.activeLanguageIds.length <= 1) return prev; // keep at least one
      let active = has
        ? prev.activeLanguageIds.filter((item) => item !== id)
        : [...prev.activeLanguageIds, id];
      let target = prev.targetLanguageId;
      if (has && target === id) target = active[0] ?? DEFAULT_LANGUAGE_ID;
      if (!active.includes(target)) active = [target, ...active];
      const next = { ...prev, activeLanguageIds: active, targetLanguageId: target };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <PreferencesContext.Provider
      value={{
        ...prefs,
        ready,
        setTargetLanguage,
        setNativeLanguage: (id) => update({ nativeLanguageId: id }),
        setReminderKey: (key) => update({ reminderKey: key }),
        setDailyGoal: (minutes) =>
          update({
            dailyGoalMinutes: DAILY_GOALS.includes(minutes) ? minutes : DEFAULT_DAILY_GOAL,
          }),
        toggleMyLanguage,
        completeOnboarding: () => update({ onboarded: true }),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences(): PreferencesValue {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used inside <PreferencesProvider>');
  return ctx;
}

const EXTERNAL_NAMES: Record<string, string> = { en: 'English' };

/** Display name for any language id, including non-target languages like English. */
export function languageName(id: string): string {
  if (EXTERNAL_NAMES[id]) return EXTERNAL_NAMES[id];
  return getLanguage(id).name;
}
