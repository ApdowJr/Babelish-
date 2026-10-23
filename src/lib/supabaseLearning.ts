import { supabase } from '@/lib/supabase';

export type SupabaseStatePayload = {
  progress: Record<string, { score: number; completedAt: string }>;
  vocab: Record<string, unknown>;
};
export type SupabaseState = SupabaseStatePayload & { updatedAt: string | null };

async function currentUserId(): Promise<string | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user?.id ?? null;
}

export async function fetchSupabaseState(_jwt?: string): Promise<SupabaseState> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to sync learning progress.');

  const [progressResult, vocabResult] = await Promise.all([
    supabase.from('user_progress').select('lesson_id, score, completed_at').eq('user_id', userId),
    supabase.from('user_vocab').select('item_key, language_id, target, translation, box, due_at, last_reviewed_at').eq('user_id', userId),
  ]);
  if (progressResult.error) throw progressResult.error;
  if (vocabResult.error) throw vocabResult.error;

  const progress: SupabaseStatePayload['progress'] = {};
  for (const row of progressResult.data ?? []) {
    progress[row.lesson_id] = { score: row.score, completedAt: row.completed_at };
  }
  const vocab: Record<string, unknown> = {};
  for (const row of vocabResult.data ?? []) {
    vocab[row.item_key] = {
      itemKey: row.item_key,
      languageId: row.language_id,
      target: row.target,
      translation: row.translation,
      box: row.box,
      dueAt: row.due_at,
      ...(row.last_reviewed_at ? { lastReviewedAt: row.last_reviewed_at } : {}),
    };
  }
  const times = Object.values(progress).map((entry) => entry.completedAt);
  return { progress, vocab, updatedAt: times.sort().at(-1) ?? null };
}

export async function saveSupabaseState(_jwt: string | null, payload: SupabaseStatePayload): Promise<{ updatedAt: string }> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const userId = await currentUserId();
  if (!userId) throw new Error('Sign in to sync learning progress.');

  const progressRows = Object.entries(payload.progress).map(([lesson_id, entry]) => ({
    user_id: userId,
    lesson_id,
    score: entry.score,
    completed_at: entry.completedAt,
  }));
  const vocabRows = Object.entries(payload.vocab).map(([key, value]) => {
    const item = value as {
      languageId?: string; target?: string; translation?: string;
      box?: number; dueAt?: string; lastReviewedAt?: string;
    };
    return {
      user_id: userId,
      item_key: key,
      language_id: item.languageId ?? key.split(':')[0] ?? 'unknown',
      target: item.target ?? key,
      translation: item.translation ?? '',
      box: Math.max(1, Math.min(5, item.box ?? 1)),
      due_at: item.dueAt ?? new Date().toISOString(),
      last_reviewed_at: item.lastReviewedAt ?? null,
    };
  });

  if (progressRows.length) {
    const { error } = await supabase.from('user_progress').upsert(progressRows, { onConflict: 'user_id,lesson_id' });
    if (error) throw error;
  }
  if (vocabRows.length) {
    const { error } = await supabase.from('user_vocab').upsert(vocabRows, { onConflict: 'user_id,item_key' });
    if (error) throw error;
  }
  // Explicitly clear stale rows on a reset/empty snapshot. RLS ensures only the
  // signed-in user's rows are visible and deletable.
  if (!progressRows.length) {
    const { error } = await supabase.from('user_progress').delete().eq('user_id', userId);
    if (error) throw error;
  }
  if (!vocabRows.length) {
    const { error } = await supabase.from('user_vocab').delete().eq('user_id', userId);
    if (error) throw error;
  }
  return { updatedAt: new Date().toISOString() };
}
