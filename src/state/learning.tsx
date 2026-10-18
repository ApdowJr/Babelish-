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
  loadProgress,
  loadVocab,
  saveProgress,
  saveVocab,
} from '@/lib/curriculum/store';
import { LEITNER_DAYS, type VocabItem, type VocabSeed } from '@/lib/curriculum/types';
import { isNeonConfigured } from '@/lib/neon';
import { fetchNeonState, saveNeonState } from '@/lib/neonApi';
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

function mergeProgress(local: ProgressMap, remote: ProgressMap | undefined): ProgressMap {
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

function mergeVocab(
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
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [vocab, setVocab] = useState<Record<string, VocabItem>>({});
  const [dueCount, setDueCount] = useState(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  /** Pushes a state snapshot to the Neon backend (no-op outside Neon mode). */
  const pushState = useCallback(
    async (nextProgress: ProgressMap, nextVocab: Record<string, VocabItem>) => {
      if (!isNeonConfigured) return;
      try {
        const jwt = await getAccessToken();
        if (!jwt) return;
        await saveNeonState(jwt, { progress: nextProgress, vocab: nextVocab });
        setLastSyncedAt(new Date().toISOString());
      } catch {
        // Offline or server unreachable: the device copy stays authoritative
        // and the next successful sync merges both sides.
      }
    },
    [getAccessToken]
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Same pattern as AuthProvider: state changes happen after an await, never
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    Promise.all([loadProgress(), loadVocab()])
      .then(async ([nextProgress, nextVocab]) => {
        let mergedProgress = nextProgress;
        let mergedVocab = nextVocab;
        if (isNeonConfigured) {
          // Cloud sync: union the device copy with the server copy, then make
          // sure both sides hold the merged result.
          try {
            const jwt = await getAccessToken();
            if (jwt) {
              const remote = await fetchNeonState(jwt);
              mergedProgress = mergeProgress(nextProgress, remote.progress);
              mergedVocab = mergeVocab(nextVocab, remote.vocab);
              for (const [lessonId, entry] of Object.entries(mergedProgress)) {
                if (nextProgress[lessonId]?.score !== entry.score) {
                  await saveProgress(lessonId, entry.score);
                }
              }
              await saveVocab(mergedVocab);
              await saveNeonState(jwt, { progress: mergedProgress, vocab: mergedVocab });
            }
          } catch {
            // Server unreachable: device state loads as usual.
          }
        }
        if (cancelled) return;
        setProgress(mergedProgress);
        setVocab(mergedVocab);
        setDueCount(countDue(mergedVocab));
        if (isNeonConfigured && !cancelled) setLastSyncedAt(new Date().toISOString());
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, getAccessToken]);

  const recordLesson = useCallback<LearningValue['recordLesson']>(
    async ({ lessonId, languageId, correct, playable, missed, firstCompletion, completedToday }) => {
      const score = playable > 0 ? Math.round((correct / playable) * 100) : 100;
      // Published rules from @/lib/xp — same number the ledger will store.
      const xpEarned = lessonXp({
        firstCompletion,
        completedToday,
        perfect: playable > 0 && correct === playable,
      });

      const nextProgress = await saveProgress(lessonId, score);
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
        await saveVocab(nextVocab);
      }
      await pushState(nextProgress, nextVocab);
      return { score, xpEarned };
    },
    [vocab, pushState]
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
      await saveVocab(nextVocab);
      await pushState(progress, nextVocab);
    },
    [vocab, progress, pushState]
  );

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
    };
  }, [ready, progress, vocab, dueCount, lastSyncedAt, recordLesson, reviewWord]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used inside <LearningProvider>');
  return ctx;
}
