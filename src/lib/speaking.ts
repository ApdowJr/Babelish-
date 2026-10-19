/**
 * Speaking stats — best pronunciation score per practice phrase, persisted
 * locally so the Speak tab can show "Best 84%" across sessions.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type PhraseStat = { best: number; attempts: number };

export type SpeakingStats = Record<string, PhraseStat>;

const KEY = 'zelvoca:speaking-stats';

export async function loadSpeakingStats(): Promise<SpeakingStats> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
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
  score: number
): Promise<SpeakingStats> {
  const previous = stats[phraseId] ?? { best: 0, attempts: 0 };
  const next: SpeakingStats = {
    ...stats,
    [phraseId]: {
      best: Math.max(previous.best, score),
      attempts: previous.attempts + 1,
    },
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort persistence
  }
  return next;
}
