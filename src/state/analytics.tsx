import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EMPTY_ANALYTICS,
  activeToday,
  pushEvent,
  skillForExerciseType,
  type AnalyticsState,
  type SkillTally,
} from '@/lib/analytics';
import { EMPTY_XP, XP_RULES, addXp, type XpReason, type XpState } from '@/lib/xp';

/**
 * Holds the learner's skill tallies + activity events + XP on-device and
 * persists every write. Aggregation logic lives in `@/lib/analytics` and
 * `@/lib/xp` (pure, tested).
 */
type AnalyticsValue = {
  state: AnalyticsState;
  /** Lifetime + current-week XP (week rolls over in `@/lib/xp.addXp`). */
  xp: XpState;
  /** Lesson answers → skill tallies + an activity event. Fire-and-forget. */
  logSkillResult: (type: string, correct: boolean) => void;
  /** Pronunciation practice score (0–100) → speaking tally + event + XP. */
  logSpeakingScore: (percent: number) => void;
  /** Lesson finished → event + awarded XP (0 for same-day replays) + daily bonus. */
  logLessonCompleted: (xp: number) => void;
  /** Coarse activity event for streaks and insights (XP only for mapped names). */
  logEvent: (name: string) => void;
};

/** Activity events that also earn XP (rules stay published in `@/lib/xp`). */
const EVENT_XP: Partial<Record<string, XpReason>> = { review_completed: 'review' };

const STORAGE_KEY = 'zelvoca:analytics';

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
      xp:
        parsed.xp && typeof parsed.xp.lifetime === 'number'
          ? {
              lifetime: Math.max(0, Number(parsed.xp.lifetime) || 0),
              week: typeof parsed.xp.week === 'string' ? parsed.xp.week : EMPTY_XP.week,
              weekly: Math.max(0, Number(parsed.xp.weekly) || 0),
              day: typeof parsed.xp.day === 'string' ? parsed.xp.day : EMPTY_XP.day,
              daily: Math.max(0, Number(parsed.xp.daily) || 0),
            }
          : { ...EMPTY_XP },
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
    xp: state.xp,
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
      commit((prev) => {
        const now = new Date();
        const daily = activeToday(prev.events, now) ? 0 : XP_RULES.dailyBonus;
        return {
          ...prev,
          speak: { scoreSum: prev.speak.scoreSum + percent, count: prev.speak.count + 1 },
          events: pushEvent(prev.events, { name: 'speaking_practice', at: now.toISOString() }),
          xp: addXp(prev.xp, XP_RULES.pronunciation + daily, now),
        };
      });
    },
    logLessonCompleted: (xp) => {
      commit((prev) => {
        const now = new Date();
        const daily = activeToday(prev.events, now) ? 0 : XP_RULES.dailyBonus;
        const total = Math.max(0, xp) + daily;
        return {
          ...prev,
          events: pushEvent(prev.events, { name: 'lesson_completed', at: now.toISOString() }),
          ...(total > 0 ? { xp: addXp(prev.xp, total, now) } : {}),
        };
      });
    },
    logEvent: (name) => {
      commit((prev) => {
        const now = new Date();
        const reason = EVENT_XP[name];
        const total = reason ? XP_RULES[reason] + (activeToday(prev.events, now) ? 0 : XP_RULES.dailyBonus) : 0;
        return {
          ...prev,
          events: pushEvent(prev.events, { name, at: now.toISOString() }),
          ...(total > 0 ? { xp: addXp(prev.xp, total, now) } : {}),
        };
      });
    },
  };

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>;
}

export function useAnalytics(): AnalyticsValue {
  const ctx = useContext(AnalyticsContext);
  if (!ctx) throw new Error('useAnalytics must be used inside <AnalyticsProvider>');
  return ctx;
}
