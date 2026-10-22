import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE_ID, getLanguage, isKnownLanguage } from '@/data/languages';
import {
  DAILY_GOALS,
  DEFAULT_DAILY_GOAL,
  DEFAULT_PREFERENCES,
  normalizePreferences,
  type DailyGoalMinutes,
  type Preferences,
  type VoiceSpeed,
} from '@/lib/preferenceRules';

// Re-exported so screens keep importing from one place (`@/state/preferences`).
export { DAILY_GOALS, dailyGoalXp } from '@/lib/preferenceRules';
export type { DailyGoalMinutes, VoiceSpeed } from '@/lib/preferenceRules';

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
  setShowTranslation: (value: boolean) => void;
  setVoiceSpeed: (speed: VoiceSpeed) => void;
  setAutoSpeak: (value: boolean) => void;
  setReduceMotion: (value: boolean) => void;
};

const STORAGE_KEY = 'zelvoca:preferences';

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        // A blob written before onboarding existed belongs to a returning
        // learner: never re-show the welcome flow for it.
        setPrefs((prev) =>
          normalizePreferences(
            parsed,
            { ...DEFAULT_PREFERENCES, onboarded: true },
            { isKnownLanguage }
          ) ?? prev
        );
      })
      .catch(() => {
        // Unreadable storage keeps the defaults — the app still works.
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
      const active = has
        ? prev.activeLanguageIds.filter((item) => item !== id)
        : [...prev.activeLanguageIds, id];
      let target = prev.targetLanguageId;
      if (has && target === id) target = active[0] ?? DEFAULT_LANGUAGE_ID;
      if (!active.includes(target)) active.unshift(target);
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
        setShowTranslation: (value) => update({ showTranslation: value }),
        setVoiceSpeed: (speed) => update({ voiceSpeed: speed }),
        setAutoSpeak: (value) => update({ autoSpeak: value }),
        setReduceMotion: (value) => update({ reduceMotion: value }),
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
