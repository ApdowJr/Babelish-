import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_ANALYTICS,
  pushEvent,
  skillForExerciseType,
  type AnalyticsState,
  type SkillTally,
} from '@/lib/analytics';

/**
 * Holds the learner's skill tallies + activity events on-device and persists
 * every write. Aggregation logic lives in `@/lib/analytics` (pure, tested).
 */
type AnalyticsValue = {
  state: AnalyticsState;
  /** Lesson answers → skill tallies + an activity event. Fire-and-forget. */
  logSkillResult: (type: string, correct: boolean) => void;
  /** Pronunciation practice score (0–100) → speaking tally + event. */
  logSpeakingScore: (percent: number) => void;
  /** Coarse activity event for streaks and insights. */
  logEvent: (name: string) => void;
};

const STORAGE_KEY = 'nativa:analytics';

const AnalyticsContext = createContext<AnalyticsValue | undefined>(undefined);

function sanitize(raw: string | null): AnalyticsState {
  if (!raw) return EMPTY_ANALYTICS;
  try {
    const parsed = JSON.parse(raw) as Partial<AnalyticsState>;
    const tally = (value: unknown): SkillTally =>
      value && typeof (value as SkillTally).correct === 'number'
        ? {
            correct: Number((value as SkillTally).correct ?? 0),
            total: Number((value as SkillTally).total ?? 0),
          }
        : { correct: 0, total: 0 };
    return {
      read: tally(parsed.read),
      listen: tally(parsed.listen),
      write: tally(parsed.write),
      speak:
        parsed.speak && typeof parsed.speak.scoreSum === 'number'
          ? { scoreSum: Number(parsed.speak.scoreSum), count: Number(parsed.speak.count) || 0 }
          : { scoreSum: 0, count: 0 },
      events: Array.isArray(parsed.events)
        ? parsed.events.filter((e) => e && typeof e.name === 'string' && typeof e.at === 'string')
        : [],
    };
  } catch {
    return EMPTY_ANALYTICS;
  }
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AnalyticsState>(EMPTY_ANALYTICS);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setState(sanitize(raw));
      })
      .catch(() => {
        // keep empty state
      });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Applies a state transition and persists the result (best-effort). */
  function commit(transform: (prev: AnalyticsState) => AnalyticsState) {
    setState((prev) => {
      const next = transform(prev);
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }

  const value: AnalyticsValue = {
    state,
    logSkillResult: (type, correct) => {
      const skill = skillForExerciseType(type);
      if (!skill || skill === 'speak') return;
      commit((prev) => ({
        ...prev,
        [skill]: { correct: prev[skill].correct + (correct ? 1 : 0), total: prev[skill].total + 1 },
        events: pushEvent(prev.events, { name: `answer_${skill}`, at: new Date().toISOString() }),
      }));
    },
    logSpeakingScore: (percent) => {
      commit((prev) => ({
        ...prev,
        speak: { scoreSum: prev.speak.scoreSum + percent, count: prev.speak.count + 1 },
        events: pushEvent(prev.events, { name: 'speaking_practice', at: new Date().toISOString() }),
      }));
    },
    logEvent: (name) => {
      commit((prev) => ({
        ...prev,
        events: pushEvent(prev.events, { name, at: new Date().toISOString() }),
      }));
    },
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used inside <AnalyticsProvider>');
  return ctx;
}
