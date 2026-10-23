import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { DEFAULT_PROFILE, normalizeLearnerProfile, type LearnerProfile } from '@/lib/learnerProfile';
import { readScopedItem, writeScopedItem } from '@/lib/scopedStorage';

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
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [profile, setProfile] = useState<LearnerProfile>(DEFAULT_PROFILE);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setProfile(DEFAULT_PROFILE);
        setReady(true);
      });
      return () => {
        cancelled = true;
      };
    }

    readScopedItem(STORAGE_KEY, userId)
      .then((raw) => {
        if (cancelled) return;
        if (!raw) {
          setProfile(DEFAULT_PROFILE);
          return;
        }
        setProfile(normalizeLearnerProfile(JSON.parse(raw)));
      })
      .catch(() => {
        if (!cancelled) setProfile(DEFAULT_PROFILE);
      })
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function write(next: LearnerProfile) {
    setProfile(next);
    void writeScopedItem(STORAGE_KEY, JSON.stringify(next), userId);
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
