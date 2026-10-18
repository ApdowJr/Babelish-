import type { ExerciseSource } from '@/lib/curriculum/types';

/**
 * Authoring helpers — keep content files compact and type-checked.
 * Prompts default per type; pass `opts` to override or add hint/note/vocab.
 */
type Opts = {
  prompt?: string;
  hint?: string;
  note?: string;
  vocab?: { target: string; translation: string };
};

/** Multiple choice. `question` is usually the target-language side. */
export function choose(
  question: string,
  options: string[],
  correct: string,
  opts: Opts = {}
): ExerciseSource {
  return {
    type: 'choose',
    prompt: opts.prompt ?? 'Choose the correct answer',
    question,
    options,
    answer: [correct],
    hint: opts.hint,
    note: opts.note,
    vocab: opts.vocab,
  };
}

/**
 * Typed answer — `question` is the prompt sentence (state the direction in
 * `prompt`, e.g. "Translate into Spanish"). `answers` lists all accepted
 * spellings (accents are matched leniently by the player).
 */
export function typeEx(
  prompt: string,
  question: string,
  answers: string[],
  opts: Opts = {}
): ExerciseSource {
  return {
    type: 'type',
    prompt,
    question,
    answer: answers,
    hint: opts.hint,
    note: opts.note,
    vocab: opts.vocab,
  };
}

/** Listen with native TTS — you hear `question`, pick what you heard. */
export function listen(question: string, options: string[], opts: Opts = {}): ExerciseSource {
  return {
    type: 'listen',
    prompt: opts.prompt ?? 'Listen and choose what you hear',
    question,
    options,
    answer: [question],
    hint: opts.hint,
    note: opts.note,
    vocab: opts.vocab,
  };
}

/** Speaking exercise — locked until Phase 2 (speech recognition). */
export function speak(question: string, opts: Opts = {}): ExerciseSource {
  return {
    type: 'speak',
    prompt: opts.prompt ?? 'Say it out loud',
    question,
    answer: [question],
    hint: opts.hint,
    note: opts.note,
    vocab: opts.vocab,
  };
}
