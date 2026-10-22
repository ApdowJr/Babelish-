/**
 * Course data validation. These tests are the guard against a language being
 * advertised as learnable while shipping placeholder records.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '../src/data/languages';
import { bundledCurriculum, hasBundledCurriculum } from '../src/data/curriculum';
import { catalogueCompleteness, courseStatus } from '../src/lib/curriculum/status';

const VALID_TYPES = new Set(['choose', 'type', 'listen', 'speak']);

test('every atlas language ships a real course', () => {
  for (const language of LANGUAGES) {
    assert.equal(hasBundledCurriculum(language.id), true, `${language.id}: bundled`);
    const chapters = bundledCurriculum(language.id);
    assert.ok(chapters.length >= 4, `${language.id}: at least 4 chapters`);
    const lessons = chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
    assert.ok(lessons >= 8, `${language.id}: at least 8 lessons`);
    for (const chapter of chapters) {
      assert.ok(chapter.title.trim().length > 0, `${language.id}: chapter title`);
      assert.ok(chapter.description.trim().length > 0, `${language.id}: chapter description`);
      assert.match(chapter.cefr, /^A1|A2|B1|B2|C1|C2$/, `${language.id}: CEFR`);
      assert.ok(chapter.lessons.length > 0, `${language.id}/${chapter.id}: has lessons`);
    }
  }
});

test('lesson and exercise ids are stable, unique and hydrated', () => {
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();
  for (const language of LANGUAGES) {
    for (const chapter of bundledCurriculum(language.id)) {
      for (const lesson of chapter.lessons) {
        assert.equal(lessonIds.has(lesson.id), false, `duplicate lesson ${lesson.id}`);
        lessonIds.add(lesson.id);
        assert.equal(lesson.languageId, language.id);
        assert.equal(lesson.chapterId, chapter.id);
        assert.ok(lesson.title.trim().length > 0, `${lesson.id}: title`);
        assert.ok(lesson.goal.trim().length > 0, `${lesson.id}: goal`);
        assert.ok(lesson.exercises.length >= 3, `${lesson.id}: needs exercises, not a stub`);
        lesson.exercises.forEach((exercise, index) => {
          assert.equal(exercise.id, `${lesson.id}-e${index + 1}`);
          assert.equal(exercise.lessonId, lesson.id);
          assert.equal(exercise.orderIndex, index);
          assert.equal(exerciseIds.has(exercise.id), false, `duplicate exercise ${exercise.id}`);
          exerciseIds.add(exercise.id);
        });
      }
    }
  }
  assert.ok(lessonIds.size > 190);
  assert.ok(exerciseIds.size > 1_600);
});

test('every exercise is answerable and internally consistent', () => {
  for (const language of LANGUAGES) {
    for (const chapter of bundledCurriculum(language.id)) {
      for (const lesson of chapter.lessons) {
        for (const exercise of lesson.exercises) {
          assert.ok(VALID_TYPES.has(exercise.type), `${exercise.id}: type`);
          assert.ok(exercise.prompt.trim().length > 0, `${exercise.id}: prompt`);
          assert.ok(exercise.question.trim().length > 0, `${exercise.id}: question`);
          assert.ok(exercise.answer.length > 0, `${exercise.id}: answer`);
          assert.ok(exercise.answer.every((answer) => answer.trim().length > 0));

          if (exercise.type === 'choose' || exercise.type === 'listen') {
            assert.ok(exercise.options && exercise.options.length >= 3, `${exercise.id}: options`);
            const unique = new Set(exercise.options);
            assert.equal(unique.size, exercise.options!.length, `${exercise.id}: duplicate option`);
            // Options are matched case-insensitively by the lesson player.
            const lowered = new Set(exercise.options.map((option) => option.toLowerCase()));
            for (const answer of exercise.answer) {
              assert.ok(lowered.has(answer.toLowerCase()), `${exercise.id}: answer missing from options`);
            }
          }
          if (exercise.vocab) {
            assert.ok(exercise.vocab.target.trim().length > 0, `${exercise.id}: vocab target`);
            assert.ok(exercise.vocab.translation.trim().length > 0, `${exercise.id}: vocab meaning`);
          }
        }
      }
    }
  }
});

test('generated starter courses cover all four skills, not just multiple choice', () => {
  for (const language of LANGUAGES) {
    if (language.id === 'es') continue;
    const exercises = bundledCurriculum(language.id).flatMap((chapter) =>
      chapter.lessons.flatMap((lesson) => lesson.exercises)
    );
    const types = new Set(exercises.map((exercise) => exercise.type));
    for (const type of ['choose', 'type', 'listen', 'speak']) {
      assert.ok(types.has(type as never), `${language.id}: missing ${type} exercises`);
    }
    assert.ok(exercises.length >= 60, `${language.id}: ${exercises.length} exercises`);
  }
});

test('Spanish keeps its hand-authored course with grammar notes', () => {
  const chapters = bundledCurriculum('es');
  assert.equal(chapters.length, 5);
  const lessons = chapters.reduce((sum, chapter) => sum + chapter.lessons.length, 0);
  assert.equal(lessons, 20);
  const notes = chapters
    .flatMap((chapter) => chapter.lessons)
    .flatMap((lesson) => lesson.exercises)
    .filter((exercise) => Boolean(exercise.note));
  assert.ok(notes.length > 20, 'grammar/culture notes expected');
});

test('course status never overstates what exists', () => {
  const spanish = courseStatus('es');
  assert.equal(spanish.tier, 'authored');
  assert.equal(spanish.status, 'in-progress');
  assert.equal(spanish.grammarNotes, true);
  assert.match(spanish.note, /in progress/i);

  for (const language of LANGUAGES) {
    if (language.id === 'es') continue;
    const status = courseStatus(language.id);
    assert.equal(status.tier, 'starter');
    assert.equal(status.status, 'starter');
    assert.equal(status.grammarNotes, false);
    assert.match(status.note, /starter course/i);
    assert.ok(status.lessons >= 8);
    assert.ok(status.words >= 22);
  }
});

test('catalogue totals match the per-language sums', () => {
  const totals = catalogueCompleteness();
  assert.equal(totals.languages, LANGUAGES.length);
  assert.equal(totals.authored, 1);
  assert.equal(totals.starter, LANGUAGES.length - 1);
  const chapters = LANGUAGES.reduce((sum, language) => sum + courseStatus(language.id).chapters, 0);
  assert.equal(totals.chapters, chapters);
  assert.equal(
    totals.exercises,
    LANGUAGES.reduce((sum, language) => sum + courseStatus(language.id).exercises, 0)
  );
  assert.ok(totals.exercises > 1_600);
  assert.equal(totals.starterShare, (LANGUAGES.length - 1) / LANGUAGES.length);
});
