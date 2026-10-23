/**
 * Speaking stats — best pronunciation score per practice phrase, persisted
 * locally per account so the Speak tab can show "Best 84%" across sessions.
 */
import { readScopedItem, writeScopedItem } from '@/lib/scopedStorage';

export type PhraseStat = { best: number; attempts: number };

export type SpeakingStats = Record<string, PhraseStat>;

const KEY = 'zelvoca:speaking-stats';

export async function loadSpeakingStats(userId?: string | null): Promise<SpeakingStats> {
  try {
    const raw = await readScopedItem(KEY, userId);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SpeakingStats;
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Merges a new attempt into the stats (keeps the best score) and persists.
 * Returns the updated map so callers can set state immediately.
 */
export async function recordPhraseAttempt(
  stats: SpeakingStats,
  phraseId: string,
  score: number,
  userId?: string | null
): Promise<SpeakingStats> {
  const previous = stats[phraseId] ?? { best: 0, attempts: 0 };
  const next: SpeakingStats = {
    ...stats,
    [phraseId]: {
      best: Math.max(previous.best, score),
      attempts: previous.attempts + 1,
    },
  };
  await writeScopedItem(KEY, JSON.stringify(next), userId);
  return next;
}
