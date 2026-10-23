import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { bundledCurriculum } from '@/data/curriculum';
import type { Chapter, Exercise, Lesson, VocabItem } from '@/lib/curriculum/types';
import {
  clearScopedProgress,
  readScopedItem,
  writeScopedItem,
} from '@/lib/scopedStorage';

/**
 * Curriculum service: approved content from Supabase when configured,
 * bundled content otherwise (demo mode / schema not run yet / offline).
 *
 * Local progress and vocabulary are stored per account (`zelvoca:progress:v1:u:<id>`)
 * so offline lessons survive restarts and merge cleanly with Supabase when
 * connectivity returns, while two accounts sharing one device never mix data.
 */

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

/* ── Progress persistence (account-scoped local cache; cloud sync in LearningProvider) ── */

export async function clearLearningStorage(userId?: string | null): Promise<void> {
  await clearScopedProgress(userId);
}

export async function loadProgress(
  userId?: string | null
): Promise<Record<string, { score: number; completedAt: string }>> {
  return readLocal(PROGRESS_KEY, userId);
}

export async function saveProgressMap(
  progress: Record<string, { score: number; completedAt: string }>,
  userId?: string | null
): Promise<void> {
  await writeScopedItem(PROGRESS_KEY, JSON.stringify(progress), userId);
}

export async function saveProgress(
  lessonId: string,
  score: number,
  userId?: string | null
): Promise<Record<string, { score: number; completedAt: string }>> {
  const completedAt = new Date().toISOString();
  const current = await loadProgress(userId);
  const previous = current[lessonId]?.score ?? 0;
  const next = { ...current, [lessonId]: { score: Math.max(previous, score), completedAt } };
  await saveProgressMap(next, userId);
  return next;
}

export async function loadVocab(userId?: string | null): Promise<Record<string, VocabItem>> {
  return readLocal(VOCAB_KEY, userId);
}

export async function saveVocab(
  items: Record<string, VocabItem>,
  userId?: string | null
): Promise<void> {
  await writeScopedItem(VOCAB_KEY, JSON.stringify(items), userId);
}

async function readLocal<T>(key: string, userId?: string | null): Promise<T> {
  try {
    const raw = await readScopedItem(key, userId);
    if (!raw) return {} as T;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as T) : ({} as T);
  } catch {
    return {} as T;
  }
}
