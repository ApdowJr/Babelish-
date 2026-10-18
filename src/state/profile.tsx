import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Learner profile — who they are, what they're into, why they're learning.
 * Fed into every AI tutor prompt so examples come from their real life.
 * Stored on this device; the account name itself lives in auth.
 */
export type LearnerProfile = {
  /** Optional display-name override (falls back to the account name). */
  displayName: string;
  /** Job or role, e.g. "a nurse", "a university student". */
  job: string;
  /** Interest chips, e.g. ["cooking", "football"]. */
  interests: string[];
  /** Goal chips, e.g. ["travel", "work"]. */
  goals: string[];
};

type ProfileValue = {
  profile: LearnerProfile;
  updateProfile: (patch: Partial<LearnerProfile>) => void;
};

const STORAGE_KEY = 'nativa:profile';

export const DEFAULT_PROFILE: LearnerProfile = {
  displayName: '',
  job: '',
  interests: [],
  goals: [],
};

export const INTEREST_OPTIONS = [
  'Cooking',
  'Football',
  'Music',
  'Travel',
  'Movies',
  'Technology',
  'Fashion',
  'Gaming',
  'Nature',
  'Photography',
] as const;

export const GOAL_OPTIONS = [
  'Travel',
  'Work & career',
  'Family & friends',
  'Exams',
  'Moving abroad',
] as const;

const ProfileContext = createContext<ProfileValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LearnerProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<LearnerProfile>;
        setProfile({
          displayName: typeof parsed.displayName === 'string' ? parsed.displayName : '',
          job: typeof parsed.job === 'string' ? parsed.job : '',
          interests: Array.isArray(parsed.interests) ? parsed.interests.filter((x) => typeof x === 'string') : [],
          goals: Array.isArray(parsed.goals) ? parsed.goals.filter((x) => typeof x === 'string') : [],
        });
      })
      .catch(() => {
        // keep defaults
      });
  }, []);

  function updateProfile(patch: Partial<LearnerProfile>) {
    setProfile((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  return (
    <ProfileContext.Provider value={{ profile, updateProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}

/** Toggles one chip in a list (add when absent, remove when present). */
export function toggleChip(list: string[], chip: string): string[] {
  return list.includes(chip) ? list.filter((item) => item !== chip) : [...list, chip];
}
