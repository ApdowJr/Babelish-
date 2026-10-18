import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_LANGUAGE_ID, getLanguage } from '@/data/languages';

type Preferences = {
  /** Language the learner is studying. */
  targetLanguageId: string;
  /** Language the learner speaks natively (used for explanations later). */
  nativeLanguageId: string;
  /** Chosen daily-reminder time as a slot key ("18:00"), null = off. */
  reminderKey: string | null;
};

type PreferencesValue = Preferences & {
  setTargetLanguage: (id: string) => void;
  setNativeLanguage: (id: string) => void;
  /** null clears the reminder preference (OS scheduling is handled by the UI). */
  setReminderKey: (key: string | null) => void;
};

const STORAGE_KEY = 'nativa:preferences';

const DEFAULTS: Preferences = {
  targetLanguageId: DEFAULT_LANGUAGE_ID,
  nativeLanguageId: 'en',
  reminderKey: null,
};

const PreferencesContext = createContext<PreferencesValue | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        setPrefs((prev) => ({
          targetLanguageId: parsed.targetLanguageId ?? prev.targetLanguageId,
          nativeLanguageId: parsed.nativeLanguageId ?? prev.nativeLanguageId,
          reminderKey:
            typeof parsed.reminderKey === 'string' || parsed.reminderKey === null
              ? (parsed.reminderKey as string | null)
              : prev.reminderKey,
        }));
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  function update(patch: Partial<Preferences>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <PreferencesContext.Provider
      value={{
        ...prefs,
        setTargetLanguage: (id) => update({ targetLanguageId: id }),
        setNativeLanguage: (id) => update({ nativeLanguageId: id }),
        setReminderKey: (key) => update({ reminderKey: key }),
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
