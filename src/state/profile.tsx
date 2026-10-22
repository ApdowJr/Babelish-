import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_PROFILE, normalizeLearnerProfile, type LearnerProfile } from '@/lib/learnerProfile';

// Re-exported so screens keep importing from one place.
export { DEFAULT_PROFILE, GOAL_OPTIONS, INTEREST_OPTIONS, toggleChip } from '@/lib/learnerProfile';
export type { AvatarColor, LearnerProfile } from '@/lib/learnerProfile';

type ProfileValue = {
  profile: LearnerProfile;
  /** True once the stored profile has been read (avoids a flash of defaults). */
  ready: boolean;
  updateProfile: (patch: Partial<LearnerProfile>) => void;
  /** Replaces the whole profile — used by the editor's Save button. */
  saveProfile: (next: LearnerProfile) => void;
};

const STORAGE_KEY = 'zelvoca:profile';

const ProfileContext = createContext<ProfileValue | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<LearnerProfile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        // One validator for stored data: a 3.1 blob has no avatar/bio, and a
        // hand-edited one could contain anything.
        setProfile(normalizeLearnerProfile(JSON.parse(raw)));
      })
      .catch(() => {
        // Unreadable storage keeps the defaults — the tutor still works.
      })
      .finally(() => setReady(true));
  }, []);

  function write(next: LearnerProfile) {
    setProfile(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  return (
    <ProfileContext.Provider
      value={{
        profile,
        ready,
        updateProfile: (patch) => write(normalizeLearnerProfile({ ...profile, ...patch })),
        saveProfile: (next) => write(normalizeLearnerProfile(next)),
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile(): ProfileValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}
