import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  clearLearningStorage,
  loadProgress,
  loadVocab,
  saveProgress,
  saveProgressMap,
  saveVocab,
} from '@/lib/curriculum/store';
import { LEITNER_DAYS, type VocabItem, type VocabSeed } from '@/lib/curriculum/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { fetchSupabaseState, saveSupabaseState } from '@/lib/supabaseLearning';
import { lessonXp } from '@/lib/xp';

type ProgressMap = Record<string, { score: number; completedAt: string }>;

type LearningValue = {
  ready: boolean;
  progress: ProgressMap;
  vocab: Record<string, VocabItem>;
  /** Words due for review right now. */
  dueCount: number;
  /** ISO timestamp of the last successful cloud sync (null = local only). */
  lastSyncedAt: string | null;
  /** Lifetime XP + level now live in the analytics ledger (@/lib/xp). */
  lessonsCompleted: number;
  wordsMastered: number;
  recordLesson: (params: {
    lessonId: string;
    languageId: string;
    correct: number;
    playable: number;
    missed: VocabSeed[];
    firstCompletion: boolean;
    /** The lesson was already finished earlier today (replays earn no XP). */
    completedToday: boolean;
  }) => Promise<{ score: number; xpEarned: number }>;
  reviewWord: (itemKey: string, correct: boolean) => Promise<void>;
  /**
   * Forgets every lesson and word (and pushes the empty state to the server
   * when signed in). The account, profile and preferences are untouched —
   * "Reset progress" in Settings, not account deletion.
   */
  resetLearning: () => Promise<void>;
  /** Saves a phrase from the phrasebook into the review queue (due now). */
  addWord: (seed: { languageId: string; target: string; translation: string }) => Promise<boolean>;
};

const LearningContext = createContext<LearningValue | undefined>(undefined);

export function normalizeKey(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function dueAtForBox(box: number): string {
  const days = LEITNER_DAYS[Math.min(box, LEITNER_DAYS.length) - 1] ?? 1;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Counts words due right now — called from async paths, never during render. */
function countDue(vocab: Record<string, VocabItem>): number {
  const now = Date.now();
  return Object.values(vocab).filter((item) => new Date(item.dueAt).getTime() <= now).length;
}

/* ── Cloud sync merge rules (device + server union, best-entry wins) ─────── */

export function mergeProgress(local: ProgressMap, remote: ProgressMap | undefined): ProgressMap {
  const merged: ProgressMap = { ...local };
  for (const [lessonId, entry] of Object.entries(remote ?? {})) {
    const mine = merged[lessonId];
    if (
      !mine ||
      entry.score > mine.score ||
      (entry.score === mine.score && entry.completedAt > mine.completedAt)
    ) {
      merged[lessonId] = entry;
    }
  }
  return merged;
}

export function mergeVocab(
  local: Record<string, VocabItem>,
  remote: Record<string, unknown> | undefined
): Record<string, VocabItem> {
  const merged: Record<string, VocabItem> = { ...local };
  for (const [key, value] of Object.entries(remote ?? {})) {
    const item = value as VocabItem | null;
    if (!item || typeof item.box !== 'number' || typeof item.dueAt !== 'string') continue;
    const mine = merged[key];
    if (
      !mine ||
      item.box > mine.box ||
      (item.box === mine.box && (item.lastReviewedAt ?? '') > (mine.lastReviewedAt ?? ''))
    ) {
      merged[key] = item;
    }
  }
  return merged;
}

export function LearningProvider({ children }: { children: ReactNode }) {
  const { user, getAccessToken } = useAuth();
  const userId = user?.id ?? null;
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [vocab, setVocab] = useState<Record<string, VocabItem>>({});
  const [dueCount, setDueCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  /** Pushes a state snapshot to Supabase when configured. */
  const pushState = useCallback(
    async (nextProgress: ProgressMap, nextVocab: Record<string, VocabItem>) => {
      if (!isSupabaseConfigured || !userId) return;
      try {
        const jwt = await getAccessToken();
        if (!jwt) return;
        await saveSupabaseState(jwt, { progress: nextProgress, vocab: nextVocab });
        setLastSyncedAt(new Date().toISOString());
      } catch {
        // Offline or server unreachable: the device copy stays authoritative
        // and the next successful sync merges both sides.
      }
    },
    [getAccessToken, userId]
  );

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      void Promise.resolve().then(() => {
        if (cancelled) return;
        setProgress({});
        setVocab({});
        setDueCount(0);
        setLastSyncedAt(null);
        setReady(false);
      });
      return () => {
        cancelled = true;
      };
    }

    // Load only THIS user's local progress/vocab, then merge with THIS user's
    // Supabase rows when online.
    Promise.all([loadProgress(userId), loadVocab(userId)])
      .then(async ([localProgress, localVocab]) => {
        let mergedProgress = localProgress;
        let mergedVocab = localVocab;
        let synced = false;
        if (isSupabaseConfigured) {
          try {
            const jwt = await getAccessToken();
            if (jwt) {
              const remote = await fetchSupabaseState(jwt);
              mergedProgress = mergeProgress(localProgress, remote.progress);
              mergedVocab = mergeVocab(localVocab, remote.vocab);
              await saveProgressMap(mergedProgress, userId);
              await saveVocab(mergedVocab, userId);
              await saveSupabaseState(jwt, { progress: mergedProgress, vocab: mergedVocab });
              synced = true;
            }
          } catch {
            // Server unreachable: local account-scoped state stays intact.
          }
        }
        if (cancelled) return;
        setProgress(mergedProgress);
        setVocab(mergedVocab);
        setDueCount(countDue(mergedVocab));
        setLastSyncedAt(synced ? new Date().toISOString() : null);
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, getAccessToken]);

  const recordLesson = useCallback<LearningValue['recordLesson']>(
    async ({ lessonId, languageId, correct, playable, missed, firstCompletion, completedToday }) => {
      const score = playable > 0 ? Math.round((correct / playable) * 100) : 100;
      const xpEarned = lessonXp({
        firstCompletion,
        completedToday,
        perfect: playable > 0 && correct === playable,
      });

      const nextProgress = await saveProgress(lessonId, score, userId);
      setProgress(nextProgress);

      let nextVocab = vocab;
      if (missed.length > 0) {
        nextVocab = { ...vocab };
        for (const seed of missed) {
          const itemKey = `${languageId}:${normalizeKey(seed.target)}`;
          nextVocab[itemKey] = {
            itemKey,
            languageId,
            target: seed.target,
            translation: seed.translation,
            box: 1,
            dueAt: dueAtForBox(1),
          };
        }
        setVocab(nextVocab);
        setDueCount(countDue(nextVocab));
        await saveVocab(nextVocab, userId);
      }
      await pushState(nextProgress, nextVocab);
      return { score, xpEarned };
    },
    [vocab, pushState, userId]
  );

  const addWord = useCallback<LearningValue['addWord']>(
    async ({ languageId, target, translation }) => {
      const itemKey = `${languageId}:${normalizeKey(target)}`;
      if (vocab[itemKey]) return false;
      const nextVocab = {
        ...vocab,
        [itemKey]: {
          itemKey,
          languageId,
          target,
          translation,
          box: 1,
          dueAt: new Date().toISOString(),
        },
      };
      setVocab(nextVocab);
      setDueCount(countDue(nextVocab));
      await saveVocab(nextVocab, userId);
      await pushState(progress, nextVocab);
      return true;
    },
    [vocab, progress, pushState, userId]
  );

  const reviewWord = useCallback<LearningValue['reviewWord']>(
    async (itemKey, correct) => {
      const item = vocab[itemKey];
      if (!item) return;
      const box = correct ? Math.min(item.box + 1, LEITNER_DAYS.length) : 1;
      const nextVocab = {
        ...vocab,
        [itemKey]: {
          ...item,
          box,
          dueAt: dueAtForBox(box),
          lastReviewedAt: new Date().toISOString(),
        },
      };
      setVocab(nextVocab);
      setDueCount(countDue(nextVocab));
      await saveVocab(nextVocab, userId);
      await pushState(progress, nextVocab);
    },
    [vocab, progress, pushState, userId]
  );

  const resetLearning = useCallback<LearningValue['resetLearning']>(async () => {
    setProgress({});
    setVocab({});
    setDueCount(0);
    setLastSyncedAt(null);
    await clearLearningStorage(userId);
    await pushState({}, {});
  }, [pushState, userId]);

  const value = useMemo<LearningValue>(() => {
    const vocabList = Object.values(vocab);
    const lessonsCompleted = Object.values(progress).filter((p) => p.score >= 70).length;
    return {
      ready,
      progress,
      vocab,
      dueCount,
      lastSyncedAt,
      lessonsCompleted,
      wordsMastered: vocabList.filter((item) => item.box >= 4).length,
      recordLesson,
      reviewWord,
      addWord,
      resetLearning,
    };
  }, [
    ready,
    progress,
    vocab,
    dueCount,
    lastSyncedAt,
    recordLesson,
    reviewWord,
    addWord,
    resetLearning,
  ]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used inside <LearningProvider>');
  return ctx;
}
