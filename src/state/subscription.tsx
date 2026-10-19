import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  consumeScenario,
  canStartScenario,
  emptyScenarioState,
  redeemCode,
  type ScenarioDecision,
  type ScenarioState,
} from '@/lib/plans';

/**
 * Free tier = 1 new scenario per day, premium = unlimited — enforced
 * on-device like every other Babelish state (billing integration ships at
 * launch; the beta code stands in until then). The day rolls lazily, so
 * midnight needs no timer and no network.
 */
type SubscriptionValue = {
  scenario: ScenarioState;
  plan: ScenarioState['plan'];
  /** Gate check before opening a lesson (replays of today's are free). */
  canStart: (lessonId: string) => ScenarioDecision;
  /** Marks a scenario as used when the learner finishes it. */
  consume: (lessonId: string) => void;
  /** Beta/launch code → premium label, or null when invalid. */
  redeem: (code: string) => string | null;
  /** Leave premium (used by tests / support). */
  resetToFree: () => void;
};

const STORAGE_KEY = 'babelish:subscription';

const SubscriptionContext = createContext<SubscriptionValue | undefined>(undefined);

function sanitize(raw: string | null): ScenarioState {
  const base = emptyScenarioState();
  if (!raw) return base;
  try {
    const parsed = JSON.parse(raw) as Partial<ScenarioState>;
    return {
      plan: parsed.plan === 'premium' ? 'premium' : 'free',
      day: typeof parsed.day === 'string' ? parsed.day : base.day,
      used: Array.isArray(parsed.used)
        ? parsed.used.filter((id): id is string => typeof id === 'string')
        : [],
    };
  } catch {
    return base;
  }
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ScenarioState>(emptyScenarioState());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!cancelled) setScenario(sanitize(raw));
      })
      .catch(() => {
        // keep defaults
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function commit(next: ScenarioState) {
    setScenario(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  }

  const value: SubscriptionValue = {
    scenario,
    plan: scenario.plan,
    canStart: (lessonId) => canStartScenario(scenario, lessonId),
    consume: (lessonId) => commit(consumeScenario(scenario, lessonId)),
    redeem: (code) => {
      const result = redeemCode(scenario, code);
      if (!result) return null;
      commit(result.state);
      return result.label;
    },
    resetToFree: () => commit({ ...scenario, plan: 'free' }),
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
