import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { bundledCurriculum } from '@/data/curriculum';
import type { Chapter, Exercise, Lesson } from '@/lib/curriculum/types';

/**
 * Curriculum service: approved content from Supabase when configured,
 * bundled content otherwise (demo mode / schema not run yet / offline).
 * Progress and vocabulary persist to Supabase AND AsyncStorage — the remote
 * write is attempted and the local write always happens, so nothing is lost
 * when tables are missing or the network drops.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY = 'zelvoca:progress:v1';
const VOCAB_KEY = 'zelvoca:vocab:v1';

const curriculumCache = new Map<string, Chapter[]>();

export async function loadCurriculum(languageId: string): Promise<Chapter[]> {
  const cached = curriculumCache.get(languageId);
  if (cached) return cached;

  let chapters: Chapter[] | null = null;
  if (isSupabaseConfigured) {
    chapters = await loadRemoteCurriculum(languageId);
  }
  if (!chapters || chapters.length === 0) {
    chapters = bundledCurriculum(languageId);
  }
  curriculumCache.set(languageId, chapters);
  return chapters;
}

type RemoteChapterRow = {
  id: string;
  language_id: string;
  cefr: string;
  order_index: number;
  title: string;
  description: string;
  lessons: {
    id: string;
    order_index: number;
    title: string;
    goal: string;
    exercises: {
      id: string;
      order_index: number;
      type: Exercise['type'];
      prompt: string;
      question: string;
      options: string[] | null;
      answer: string[];
      hint: string | null;
      note: string | null;
      vocab: { target: string; translation: string } | null;
    }[];
  }[];
};

async function loadRemoteCurriculum(languageId: string): Promise<Chapter[] | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('chapters')
      .select(
        'id, language_id, cefr, order_index, title, description, lessons(id, order_index, title, goal, exercises(id, order_index, type, prompt, question, options, answer, hint, note, vocab))'
      )
      .eq('language_id', languageId)
      .eq('status', 'approved');
    if (error || !data) return null;

    const rows = (data as unknown as RemoteChapterRow[]).slice();
    rows.sort((a, b) => a.order_index - b.order_index);
    return rows.map((row) => ({
      id: row.id,
      languageId: row.language_id,
      cefr: row.cefr,
      orderIndex: row.order_index,
      title: row.title,
      description: row.description,
      lessons: row.lessons
        .slice()
        .sort((a, b) => a.order_index - b.order_index)
        .map((lesson) => ({
          id: lesson.id,
          chapterId: row.id,
          languageId: row.language_id,
          orderIndex: lesson.order_index,
          title: lesson.title,
          goal: lesson.goal,
          exercises: lesson.exercises
            .slice()
            .sort((a, b) => a.order_index - b.order_index)
            .map((ex) => ({
              id: ex.id,
              lessonId: lesson.id,
              orderIndex: ex.order_index,
              type: ex.type,
              prompt: ex.prompt,
              question: ex.question,
              options: ex.options ?? undefined,
              answer: ex.answer,
              hint: ex.hint ?? undefined,
              note: ex.note ?? undefined,
              vocab: ex.vocab ?? undefined,
            })),
        })),
    }));
  } catch {
    return null;
  }
}

/** Finds a lesson across a language's curriculum (player entry point). */
export async function findLesson(languageId: string, lessonId: string): Promise<Lesson | null> {
  const chapters = await loadCurriculum(languageId);
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      if (lesson.id === lessonId) return lesson;
    }
  }
  return null;
}

/** First incomplete lesson (or last for replay) — powers "Continue". */
export async function findContinueLesson(
  languageId: string,
  progress: Record<string, { score: number }>
): Promise<{ lesson: Lesson; chapterTitle: string } | null> {
  const chapters = await loadCurriculum(languageId);
  const flat: { lesson: Lesson; chapterTitle: string }[] = [];
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) flat.push({ lesson, chapterTitle: chapter.title });
  }
  if (flat.length === 0) return null;
  return flat.find((entry) => !progress[entry.lesson.id]) ?? flat[flat.length - 1];
}

/** Chapter is open when it's first, or every previous lesson scored ≥ 70. */
export function isChapterUnlocked(
  chapters: Chapter[],
  index: number,
  progress: Record<string, { score: number }>
): boolean {
  if (index === 0) return true;
  const previous = chapters[index - 1];
  return previous.lessons.every((lesson) => (progress[lesson.id]?.score ?? 0) >= 70);
}

/* ── Progress persistence (local always, remote when available) ─────────── */

export async function loadProgress(): Promise<Record<string, { score: number; completedAt: string }>> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('lesson_id, score, completed_at');
      if (!error && data) {
        return Object.fromEntries(
          data.map((row: { lesson_id: string; score: number; completed_at: string }) => [
            row.lesson_id,
            { score: row.score, completedAt: row.completed_at },
          ])
        );
      }
    } catch {
      // fall through to local
    }
  }
  return readLocal(PROGRESS_KEY);
}

export async function saveProgress(
  lessonId: string,
  score: number
): Promise<Record<string, { score: number; completedAt: string }>> {
  const completedAt = new Date().toISOString();
  const current = await loadProgress();
  const previous = current[lessonId]?.score ?? 0;
  const next = { ...current, [lessonId]: { score: Math.max(previous, score), completedAt } };
  await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  if (supabase) {
    void (async () => {
      try {
        await supabase
          .from('user_progress')
          .upsert(
            { lesson_id: lessonId, score: Math.max(previous, score), completed_at: completedAt },
            { onConflict: 'user_id,lesson_id' }
          );
      } catch {
        // remote write failed — local copy already saved
      }
    })();
  }
  return next;
}

export async function loadVocab(): Promise<
  Record<string, import('@/lib/curriculum/types').VocabItem>
> {
  if (supabase) {
    try {
      const { data, error } = await supabase.from('user_vocab').select('*');
      if (!error && data) {
        return Object.fromEntries(
          data.map(
            (row: {
              item_key: string;
              language_id: string;
              target: string;
              translation: string;
              box: number;
              due_at: string;
              last_reviewed_at: string | null;
            }) => [
              row.item_key,
              {
                itemKey: row.item_key,
                languageId: row.language_id,
                target: row.target,
                translation: row.translation,
                box: row.box,
                dueAt: row.due_at,
                lastReviewedAt: row.last_reviewed_at ?? undefined,
              },
            ]
          )
        );
      }
    } catch {
      // fall through to local
    }
  }
  return readLocal(VOCAB_KEY);
}

export async function saveVocab(
  items: Record<string, import('@/lib/curriculum/types').VocabItem>
): Promise<void> {
  await AsyncStorage.setItem(VOCAB_KEY, JSON.stringify(items));
  if (supabase) {
    const rows = Object.values(items).map((item) => ({
      item_key: item.itemKey,
      language_id: item.languageId,
      target: item.target,
      translation: item.translation,
      box: item.box,
      due_at: item.dueAt,
      last_reviewed_at: item.lastReviewedAt ?? null,
    }));
    void (async () => {
      try {
        await supabase.from('user_vocab').upsert(rows, { onConflict: 'user_id,item_key' });
      } catch {
        // remote write failed — local copy already saved
      }
    })();
  }
}

async function readLocal<T>(key: string): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
