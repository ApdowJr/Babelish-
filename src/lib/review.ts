/**
 * Review logic — pure helpers behind `review.tsx` and the Words tab.
 *
 * The screen keeps the React/state parts; queueing, grading and session
 * summaries live here so they can be tested without a device.
 */
import type { VocabItem } from './curriculum/types';

/** Accent/case/punctuation-insensitive comparison (same rules as lessons). */
export function normalizeAnswer(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,!?¡¿;:„"'`]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function isTypedAnswerCorrect(attempt: string, target: string): boolean {
  const normalized = normalizeAnswer(attempt);
  return normalized.length > 0 && normalized === normalizeAnswer(target);
}

/** Words due now, oldest due first — the order the review screen uses. */
export function dueWords(
  vocab: Record<string, VocabItem>,
  now = new Date()
): VocabItem[] {
  const threshold = now.getTime();
  return Object.values(vocab)
    .filter((item) => new Date(item.dueAt).getTime() <= threshold)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}

export type LanguageCount = { languageId: string; count: number };

/** Due cards per language, most-loaded first. */
export function groupByLanguage(items: VocabItem[]): LanguageCount[] {
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.languageId, (counts.get(item.languageId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([languageId, count]) => ({ languageId, count }))
    .sort((a, b) => b.count - a.count || a.languageId.localeCompare(b.languageId));
}

export type SessionSummary = {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
};

export function summarizeSession(correct: number, total: number): SessionSummary {
  const safeTotal = Math.max(0, total);
  const safeCorrect = Math.max(0, Math.min(correct, safeTotal));
  return {
    total: safeTotal,
    correct: safeCorrect,
    incorrect: safeTotal - safeCorrect,
    accuracy: safeTotal === 0 ? 0 : safeCorrect / safeTotal,
  };
}

/** Leitner boxes 1–5; a wrong answer always drops back to box 1. */
export function nextBox(box: number, correct: boolean, maxBox = 5): number {
  if (!correct) return 1;
  return Math.min(Math.max(1, box) + 1, maxBox);
}

/** Days until the next review for a box (mirrors `LEITNER_DAYS`). */
export function daysForBox(box: number, days: readonly number[] = [1, 2, 4, 8, 15]): number {
  return days[Math.min(Math.max(1, box), days.length) - 1] ?? 1;
}

export function describeBox(box: number): string {
  const days = daysForBox(box);
  return days === 1 ? 'tomorrow' : `in ${days} days`;
}
