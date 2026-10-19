#!/usr/bin/env node
/**
 * Babelish curriculum draft generator (Phase 1).
 *
 * Drafts a new A1 chapter with the connected AI API and saves it as a
 * REVIEWABLE DRAFT file — it never writes to Supabase and never publishes.
 * Approval stays manual (flip status to 'approved' in SQL) until the Phase 4
 * content pipeline lands.
 *
 * Usage:
 *   node scripts/generate-curriculum.mjs <languageId> "Chapter title" [--lessons 4] [--cefr A1]
 *
 * Example:
 *   node scripts/generate-curriculum.mjs es "En el restaurante" --lessons 4
 *
 * Requires in .env (or the shell):
 *   EXPO_PUBLIC_AI_API_URL   (default https://api.openai.com/v1)
 *   EXPO_PUBLIC_AI_API_KEY
 *   EXPO_PUBLIC_AI_MODEL     (default gpt-4o-mini)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const [languageId, title, ...flags] = process.argv.slice(2);

if (!languageId || !title) {
  console.error(
    'Usage: node scripts/generate-curriculum.mjs <languageId> "Chapter title" [--lessons 4] [--cefr A1]'
  );
  process.exit(1);
}

function flagValue(name, fallback) {
  const index = flags.indexOf(name);
  return index >= 0 && flags[index + 1] ? flags[index + 1] : fallback;
}

const lessonCount = Number(flagValue('--lessons', '4'));
const cefr = flagValue('--cefr', 'A1');
const apiUrl = (process.env.EXPO_PUBLIC_AI_API_URL ?? 'https://api.openai.com/v1').replace(/\/$/, '');
const apiKey = process.env.EXPO_PUBLIC_AI_API_KEY;
const model = process.env.EXPO_PUBLIC_AI_MODEL ?? 'gpt-4o-mini';

if (!apiKey) {
  console.error('Missing EXPO_PUBLIC_AI_API_KEY — set it in the project .env or export it first.');
  process.exit(1);
}

const SYSTEM_PROMPT = `You write CEFR language-learning content for the app Babelish.
Return ONLY raw JSON (no markdown fences, no commentary) with this exact shape:

{
  "cefr": "A1",
  "title": "chapter title in the TARGET language's study context (usually English is fine)",
  "description": "one-line promise of what the learner will be able to do",
  "lessons": [
    {
      "title": "lesson title",
      "goal": "one line describing the communicative goal",
      "exercises": [
        {
          "type": "choose" | "type" | "listen",
          "prompt": "short instruction shown above the exercise",
          "question": "the content: word/sentence to translate, or the line to hear",
          "options": ["4 distinct options — only for choose/listen; must contain the answer exactly"],
          "answer": ["canonical answer first, then accepted variants"],
          "hint": "optional short hint",
          "note": "optional grammar/culture note shown after answering",
          "vocab": { "target": "target-language word/phrase", "translation": "english meaning" }
        }
      ]
    }
  ]
}

Hard rules:
- Content must be linguistically ACCURATE and natural for native speakers.
- "type" exercises: prompt states the direction (e.g. "Translate into Spanish").
  Give every accepted spelling variant in answer (include unaccented forms).
- "choose" and "listen": options must have exactly 4 entries, all distinct,
  and options[answer[0]] must appear verbatim in options.
- At least half of exercises must carry a "vocab" entry (missed words feed
  the spaced-repetition system).
- 8 to 10 exercises per lesson. Real-life, immediately useful situations.`;

async function generate() {
  console.log(`\nDrafting "${title}" for language "${languageId}" (${cefr}, ${lessonCount} lessons)…`);
  console.log(`Model: ${model} @ ${apiUrl}\n`);

  const response = await fetch(`${apiUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Write chapter "${title}" for ${languageId} at ${cefr} level with exactly ${lessonCount} lessons. Remember: raw JSON only.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI API ${response.status}: ${body.slice(0, 300)}`);
  }

  const payload = await response.json();
  const raw = payload.choices?.[0]?.message?.content ?? '';
  const jsonText = raw.replace(/```(?:json)?/g, '').trim();
  const start = jsonText.indexOf('{');
  const end = jsonText.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new Error(`Model did not return JSON. First 300 chars:\n${raw.slice(0, 300)}`);
  }
  return JSON.parse(jsonText.slice(start, end + 1));
}

function validate(chapter) {
  const problems = [];
  if (!chapter.title) problems.push('missing title');
  if (!Array.isArray(chapter.lessons) || chapter.lessons.length === 0) {
    problems.push('lessons must be a non-empty array');
  }
  for (const [li, lesson] of (chapter.lessons ?? []).entries()) {
    if (!lesson.title || !lesson.goal) problems.push(`lesson ${li + 1}: missing title/goal`);
    if (!Array.isArray(lesson.exercises) || lesson.exercises.length < 4) {
      problems.push(`lesson ${li + 1}: needs at least 4 exercises`);
    }
    for (const [ei, ex] of (lesson.exercises ?? []).entries()) {
      const at = `lesson ${li + 1} exercise ${ei + 1}`;
      if (!['choose', 'type', 'listen'].includes(ex.type)) {
        problems.push(`${at}: type must be choose|type|listen (speaking is Phase 2)`);
      }
      if (!ex.prompt || !ex.question || !Array.isArray(ex.answer) || ex.answer.length === 0) {
        problems.push(`${at}: missing prompt/question/answer`);
      }
      if (['choose', 'listen'].includes(ex.type)) {
        if (!Array.isArray(ex.options) || ex.options.length !== 4) {
          problems.push(`${at}: needs exactly 4 options`);
        } else if (!ex.options.includes(ex.answer[0])) {
          problems.push(`${at}: options do not contain the canonical answer`);
        }
      }
    }
  }
  return problems;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

try {
  const chapter = await generate();

  const problems = validate(chapter);
  if (problems.length > 0) {
    console.error('Draft failed validation — rerun the script:\n  - ' + problems.join('\n  - '));
    process.exit(2);
  }

  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const dir = path.join(root, 'src', 'data', 'curriculum', 'drafts');
  const file = path.join(dir, `${languageId}-${slugify(chapter.title)}.ts`);

  const fileContent = `import type { ChapterSource } from '@/lib/curriculum/types';

/**
 * AI-generated DRAFT — NOT wired into the app bundle.
 * Review every exercise for accuracy, then publish via Supabase:
 *   1. Insert the chapter with status = 'draft'.
 *   2. Add its lessons + exercises.
 *   3. After human review, flip status to 'approved' (SQL — manual until Phase 4).
 * Only approved chapters are served to learners (see supabase/schema.sql).
 */
export const draft: ChapterSource & { status: 'draft' } = ${JSON.stringify(
    { ...chapter, cefr: chapter.cefr ?? cefr, status: 'draft' },
    null,
    2
  )};
`;

  await mkdir(dir, { recursive: true });
  await writeFile(file, fileContent, 'utf8');

  console.log(`✅ Draft written to ${path.relative(root, file)}`);
  console.log('\nNext steps:');
  console.log('  1. REVIEW the draft — you are the accuracy gate; fix anything wrong.');
  console.log('  2. It is intentionally NOT imported by src/data/curriculum/index.ts.');
  console.log('  3. Publish by inserting it into Supabase with status=\'draft\',');
  console.log('     then flip to \'approved\' once you have reviewed it.');
} catch (error) {
  console.error(`\n❌ ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
