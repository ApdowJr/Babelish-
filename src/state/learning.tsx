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

type ProgressMap = Record<string, { score: number; completedAt: string }>;

type LearningValue = {
  ready: boolean;
  progress: ProgressMap;
  vocab: Record<string, VocabItem>;
  /** Words due for review right now. */
  dueCount: number;
  /** Total XP: 10 per correct answer + 50 first-time lesson completion. */
  xp: number;
  level: number;
  lessonsCompleted: number;
  wordsMastered: number;
  recordLesson: (params: {
    lessonId: string;
    languageId: string;
    correct: number;
    playable: number;
    missed: VocabSeed[];
    firstCompletion: boolean;
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

export function LearningProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState<ProgressMap>({});
  const [vocab, setVocab] = useState<Record<string, VocabItem>>({});
  const [dueCount, setDueCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // Same pattern as AuthProvider: state changes happen after an await, never
    // synchronously in the effect body (react-hooks/set-state-in-effect).
    Promise.all([loadProgress(), loadVocab()])
      .then(([nextProgress, nextVocab]) => {
        if (cancelled) return;
        setProgress(nextProgress);
        setVocab(nextVocab);
        setDueCount(countDue(nextVocab));
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recordLesson = useCallback<LearningValue['recordLesson']>(
    async ({ lessonId, languageId, correct, playable, missed, firstCompletion }) => {
      const score = playable > 0 ? Math.round((correct / playable) * 100) : 100;
      const xpEarned = correct * 10 + (firstCompletion ? 50 : 0);

      const nextProgress = await saveProgress(lessonId, score);
      setProgress(nextProgress);

      if (missed.length > 0) {
        const nextVocab = { ...vocab };
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
      return { score, xpEarned };
    },
    [vocab]
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
    },
    [vocab]
  );

  const value = useMemo<LearningValue>(() => {
    const vocabList = Object.values(vocab);
    const lessonsCompleted = Object.values(progress).filter((p) => p.score >= 70).length;
    // XP is derived from stored state: base on completed lessons + a light
    // estimate for replayed progress keeps it stable without a ledger.
    const xp = lessonsCompleted * 150;
    return {
      ready,
      progress,
      vocab,
      dueCount,
      xp,
      level: Math.floor(xp / 500) + 1,
      lessonsCompleted,
      wordsMastered: vocabList.filter((item) => item.box >= 4).length,
      recordLesson,
      reviewWord,
    };
  }, [ready, progress, vocab, dueCount, recordLesson, reviewWord]);

  return <LearningContext.Provider value={value}>{children}</LearningContext.Provider>;
}

export function useLearning(): LearningValue {
  const ctx = useContext(LearningContext);
  if (!ctx) throw new Error('useLearning must be used inside <LearningProvider>');
  return ctx;
}
