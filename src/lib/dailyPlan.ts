/**
 * The daily plan — a ~10-minute path built from the learner's real state:
 * due reviews, weakest skill, streak at risk, and what comes next.
 * Pure and deterministic so it can be tested and explained ("why this card?").
 */
import type { Skill } from '@/lib/analytics';

export type PlanRoute =
  | { pathname: '/review' }
  | { pathname: '/speak' }
  | { pathname: '/lesson/[id]'; params: { id: string; lang: string } };

export type PlanItem = {
  id: 'review' | 'weak' | 'streak' | 'chat';
  icon: string;
  title: string;
  subtitle: string;
  minutes: number;
  route: PlanRoute;
};

export type DailyPlanInput = {
  dueCount: number;
  weakSkill: Skill | null;
  /** Speaking average 0..100, or null with no attempts. */
  speakAverage: number | null;
  /** Lesson the learner should continue (also the replay target for drills). */
  retakeLesson: { id: string; title: string; languageId: string } | null;
  /** True when the streak would break if nothing happens before midnight. */
  streakAtRisk: boolean;
  streak: number;
  /** First learner goal, used for flavour when there's nothing urgent. */
  goal?: string;
};

const SKILL_LABEL: Record<Skill, string> = {
  listen: 'Listening',
  write: 'Writing',
  read: 'Reading',
  speak: 'Speaking',
};

export const PLAN_CAP = 3;

/** Builds the plan: urgent review → weakest skill → keep-the-streak → fallback chat. */
export function buildDailyPlan(input: DailyPlanInput): PlanItem[] {
  const items: PlanItem[] = [];

  if (input.dueCount > 0) {
    items.push({
      id: 'review',
      icon: '🔁',
      title: `Review ${input.dueCount} word${input.dueCount === 1 ? '' : 's'} due`,
      subtitle: '4 min · spaced repetition keeps words from fading',
      minutes: 4,
      route: { pathname: '/review' },
    });
  }

  if (input.weakSkill && items.length < PLAN_CAP) {
    if (input.weakSkill === 'speak') {
      const avg = input.speakAverage;
      items.push({
        id: 'weak',
        icon: '🗣️',
        title: 'Pronunciation practice',
        subtitle:
          avg !== null && avg > 0
            ? `3 min · your speaking averages ${Math.round(avg)}% — beat it`
            : '3 min · say key phrases, get scored word by word',
        minutes: 3,
        route: { pathname: '/speak' },
      });
    } else if (input.retakeLesson) {
      items.push({
        id: 'weak',
        icon: '🎧',
        title: `${SKILL_LABEL[input.weakSkill]} drill: ${input.retakeLesson.title}`,
        subtitle: `5 min · ${input.weakSkill} is your weakest skill right now`,
        minutes: 5,
        route: {
          pathname: '/lesson/[id]',
          params: { id: input.retakeLesson.id, lang: input.retakeLesson.languageId },
        },
      });
    }
  }

  if (input.streakAtRisk && items.length < PLAN_CAP) {
    const last = items[items.length - 1];
    if (last?.route.pathname !== '/speak') {
      items.push({
        id: 'streak',
        icon: '🔥',
        title: input.streak > 0 ? `Keep your ${input.streak}-day streak` : 'Start a daily streak',
        subtitle: '5 min · one quick chat before midnight',
        minutes: 5,
        route: { pathname: '/speak' },
      });
    }
  }

  if (items.length < 2) {
    items.push({
      id: 'chat',
      icon: '🌍',
      title: input.goal ? `Practice for your goal: ${input.goal}` : 'Chat with your tutor',
      subtitle: '5 min · everyday conversation in your language',
      minutes: 5,
      route: { pathname: '/speak' },
    });
  }

  return items.slice(0, PLAN_CAP);
}

export function planTotalMinutes(items: PlanItem[]): number {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}
