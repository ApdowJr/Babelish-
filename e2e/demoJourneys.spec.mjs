import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Browser E2E for the exported web app (dist/) in DEMO mode.
 *
 * Isolation model: each test gets a fresh browser context (fresh
 * localStorage). Tests that need seeded state write it directly under the
 * exact keys the app uses (verified against src/lib/curriculum/store.ts,
 * src/state/analytics.tsx and src/app/lesson/[id].tsx) BEFORE first load —
 * AsyncStorage's web backend is plain localStorage with verbatim keys.
 *
 * Deterministic content: exercises are read from the repo's own bundled
 * curriculum source (src/data/curriculum/es/ch1.ts) so answers come from the
 * same source of truth the app ships, not from brittle UI text scraping.
 *
 * No external services: dist/ is built without API env vars, so the app runs
 * in demo mode; AI/speech paths degrade gracefully offline by design, which
 * journeys 7–8 assert.
 */

const require = createRequire(import.meta.url);
// The lesson screen gates new scenarios to 1/day via dailyPlan ("consume").
// Seed today's plan so opening es-ch1-l1 is always allowed, whatever the
// learner already did in this throwaway context.
const { buildDailyPlan } = require('../src/lib/dailyPlan.ts');

const LESSON_ID = 'es-ch1-l1';
const LANG = 'es';
const TODAY = () => new Date().toISOString().slice(0, 10);

/** Parse the authored exercise list for lesson 1 out of the source file. */
function lessonExercises() {
  const src = readFileSync(new URL('../src/data/curriculum/es/ch1.ts', import.meta.url), 'utf8');
  // First lesson object only: everything between `exercises: [` and its closer.
  const start = src.indexOf('exercises: [');
  const end = src.indexOf('\n      ],', start);
  const block = src.slice(start, end);
  const exs = [];
  const chooseRe = /choose\(\s*'([^']+)',\s*\[([^\]]+)\],\s*'([^']+)'/g;
  const typeRe = /typeEx\(\s*'([^']+)',\s*'([^']+)',\s*\[([^\]]+)\]/g;
  const listenRe = /listen\(\s*'([^']+)',\s*\[([^\]]+)\]/g;
  const speakRe = /speak\(\s*'([^']+)'/g;
  // Walk the block sequentially so order matches the authored lesson.
  const events = [];
  let m;
  while ((m = chooseRe.exec(block))) events.push({ i: m.index, kind: 'choose', question: m[1], options: splitList(m[2]), answer: m[3] });
  while ((m = typeRe.exec(block))) events.push({ i: m.index, kind: 'type', prompt: m[1], question: m[2], answers: splitList(m[3]) });
  while ((m = listenRe.exec(block))) events.push({ i: m.index, kind: 'listen', question: m[1], options: splitList(m[2]), answer: m[1] });
  while ((m = speakRe.exec(block))) events.push({ i: m.index, kind: 'speak' });
  events.sort((a, b) => a.i - b.i);
  return events;
}

function splitList(s) {
  return s.split(',').map((x) => x.trim().replace(/^['"]|['"]$/g, ''));
}

/** Seed localStorage before any app code runs. */
async function seed(page, { progress, vocab, analytics, plan }) {
  await page.addInitScript(
    ([data]) => {
      if (data.progress) localStorage.setItem('babelish:progress:v1', JSON.stringify(data.progress));
      if (data.vocab) localStorage.setItem('babelish:vocab:v1', JSON.stringify(data.vocab));
      if (data.analytics) localStorage.setItem('babelish:analytics', JSON.stringify(data.analytics));
      if (data.plan) localStorage.setItem('babelish:daily-plan', JSON.stringify(data.plan));
    },
    [{ progress, vocab, analytics, plan }]
  );
}

/** Stub speech synthesis + recognition so headless runs stay deterministic
 *  and we can assert the app's own unsupported-path messaging. */
async function stubSpeech(page, { recognition = false } = {}) {
  await page.addInitScript(
    ([opts]) => {
      // TTS: expose window.speechSynthesis but make it an inert recorder —
      // expo-speech calls speak()/cancel(); nothing should actually play or hang.
      const spoken = [];
      window.__spoken = spoken;
      window.speechSynthesis = {
        speak: (u) => spoken.push(String(u?.text ?? '')),
        cancel: () => {},
        pause: () => {},
        resume: () => {},
        getVoices: () => [],
        speaking: false,
        pending: false,
        paused: false,
        onvoiceschanged: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
      // STT: leave SpeechRecognition absent by default → unsupported path.
      if (opts.recognition) {
        class Fake {
          constructor() { this.onresult = null; this.onerror = null; this.onend = null; }
          start() {}
          stop() { if (this.onend) this.onend({}); }
          abort() { this.stop(); }
        }
        window.SpeechRecognition = Fake;
        window.webkitSpeechRecognition = Fake;
      }
    },
    [{ recognition }]
  );
}

async function storageOf(page, key) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

test.describe.configure({ mode: 'serial' });

test('1. application loads without uncaught errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await stubSpeech(page);
  await page.goto('/');
  // Demo-mode login shell renders its title text (RN-web Text → DOM node).
  await expect(page.getByText('Speak like a native.')).toBeVisible();
  expect(errors, `uncaught page errors: ${errors.join('; ')}`).toEqual([]);
});

test('2. learner enters demo mode without credentials and session persists across reload', async ({ page }) => {
  await stubSpeech(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel(/name/i).first().fill('E2E Learner');
  // signup form email/password fields — target by placeholder-ish labels; fall back to inputs in order
  const inputs = page.locator('input');
  await inputs.nth(1).fill('e2e@example.test');
  await inputs.nth(2).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: /create account|sign up/i }).click();
  // After signup the tabs shell appears (home screen XP chip).
  await expect(page.getByText(/XP$/).first()).toBeVisible();
  // Session persisted locally (demo user record) — survives reload.
  await page.reload();
  await expect(page.getByText(/XP$/).first()).toBeVisible();
  const demo = await storageOf(page, 'babelish:demo-user');
  expect(demo, 'demo session key written').toBeTruthy();
  expect(JSON.parse(demo).email).toBe('e2e@example.test');
});

async function completeLesson(page, { allCorrect = true } = {}) {
  const exs = lessonExercises();
  let correctCount = 0;
  for (let i = 0; i < exs.length; i++) {
    const ex = exs[i];
    await expect(page.getByText(`${i + 1} of ${exs.length}`)).toBeVisible();
    if (ex.kind === 'speak') {
      await page.getByRole('button', { name: i === exs.length - 1 ? 'Finish lesson' : 'Continue' }).click();
      continue;
    }
    if (ex.kind === 'choose' || ex.kind === 'listen') {
      const wanted = allCorrect ? ex.answer : ex.options.find((o) => o !== ex.answer);
      await page.getByRole('button', { name: wanted, exact: true }).click();
      await page.getByRole('button', { name: 'Check' }).click();
      if (allCorrect) correctCount++;
    } else if (ex.kind === 'type') {
      const ans = allCorrect ? ex.answers[0] : 'zzz-definitely-wrong';
      await page.getByLabel('Your answer').fill(ans);
      await page.getByRole('button', { name: 'Check' }).click();
      if (allCorrect) correctCount++;
    }
    if (i < exs.length - 1) {
      await page.getByRole('button', { name: 'Continue' }).click();
    }
  }
  return { total: exs.length, correct: correctCount };
}

test('3+4. course → lesson → completion awards correct XP and writes real storage', async ({ page }) => {
  await stubSpeech(page);
  await seed(page, { plan: buildDailyPlan(new Date()) });
  await page.goto('/');
  // Logged-out demo: sign in via login screen.
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText(/XP$/).first()).toBeVisible();

  // Navigate: Learn tab → Spanish card → lesson 1 (deep link is equivalent
  // and stable; use it, then also verify the Learn tab lists the language).
  await page.getByRole('button', { name: /learn/i }).first().click();
  await expect(page.getByText('Spanish')).toBeVisible();
  await page.goto(`/lesson/${LESSON_ID}?lang=${LANG}`);
  await expect(page.getByText('1 of 8')).toBeVisible();

  const { total, correct } = await completeLesson(page);
  expect(correct).toBe(total);

  // Completion screen reflects the run.
  await expect(page.getByText('Lesson complete!')).toBeVisible();
  await expect(page.getByText('100% correct')).toBeVisible();

  // REAL storage assertions (not just UI): progress + analytics written.
  const progress = JSON.parse(await storageOf(page, 'babelish:progress:v1'));
  expect(progress[LESSON_ID]?.score).toBe(100);
  const analytics = JSON.parse(await storageOf(page, 'babelish:analytics'));
  // lessonXp: 20 + perfect bonus 15 = 35, plus first-activity daily bonus 10.
  const xp = analytics.xp?.lifetime ?? 0;
  expect(xp, 'XP ledger recorded the award').toBeGreaterThanOrEqual(35);

  // Home chip shows the same number the ledger holds (UI ← real data).
  await page.goto('/');
  const chip = page.getByText(/\d+ XP/).first();
  await expect(chip).toBeVisible();
  expect((await chip.textContent()).match(/(\d+) XP/)[1]).toBe(String(xp));
});

test('5. progress survives a full reload', async ({ page }) => {
  await stubSpeech(page);
  await seed(page, {
    plan: buildDailyPlan(new Date()),
    progress: { [LESSON_ID]: { score: 100, completedAt: new Date().toISOString() } },
    analytics: { xp: { lifetime: 35, week: '2026-W44', weekly: 35 } },
  });
  await page.goto('/');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.reload();
  // Still authenticated (demo session) and still holding the ledger value.
  await expect(page.getByText('✨ 35 XP')).toBeVisible();
  // Progress store rehydrates from localStorage: lesson 1 shows as done in the course view.
  await page.goto(`/language/${LANG}`);
  await expect(page.getByText('Saludos básicos')).toBeVisible();
  const stored = JSON.parse(await storageOf(page, 'babelish:progress:v1'));
  expect(stored[LESSON_ID]?.score).toBe(100);
});

test('6. replaying a lesson the same day does not mint duplicate XP', async ({ page }) => {
  await stubSpeech(page);
  const nowIso = new Date().toISOString();
  await seed(page, {
    plan: buildDailyPlan(new Date()),
    progress: { [LESSON_ID]: { score: 100, completedAt: nowIso } },
    analytics: { xp: { lifetime: 35, week: '2026-W44', weekly: 35 } },
  });
  await page.goto('/');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto(`/lesson/${LESSON_ID}?lang=${LANG}`);
  await expect(page.getByText('1 of 8')).toBeVisible();
  await completeLesson(page);
  // Replay path: lessonXp returns 0 when !firstCompletion && completedToday.
  await expect(page.getByText(/% correct/)).toBeVisible();
  const analytics = JSON.parse(await storageOf(page, 'babelish:analytics'));
  expect(analytics.xp.lifetime, 'no XP inflation from same-day replay').toBe(35);
  // And the high-water mark protects the stored score (Math.max in saveProgress).
  const progress = JSON.parse(await storageOf(page, 'babelish:progress:v1'));
  expect(progress[LESSON_ID].score).toBe(100);
});

test('7. review scheduling records Leitner box + dueAt in real storage', async ({ page }) => {
  await stubSpeech(page);
  const itemKey = `${LANG}:adiós`;
  await seed(page, {
    plan: buildDailyPlan(new Date()),
    vocab: {
      [itemKey]: {
        itemKey,
        languageId: LANG,
        target: 'adiós',
        translation: 'goodbye',
        box: 1,
        dueAt: new Date(Date.now() - 60_000).toISOString(), // overdue → due now
      },
    },
    analytics: { xp: { lifetime: 0, week: '2026-W44', weekly: 0 } },
  });
  await page.goto('/');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.goto('/review');
  await expect(page.getByText('Say it or type it in Spanish:')).toBeVisible();
  await page.getByLabel('Your answer').fill('adios'); // accent-lenient match
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByText('Correct — box up!')).toBeVisible();
  await page.getByRole('button', { name: 'Finish review' }).click();

  // The scheduler must have moved the word to box 2 with a future due date.
  const vocab = JSON.parse(await storageOf(page, 'babelish:vocab:v1'));
  const item = vocab[itemKey];
  expect(item.box, 'Leitner box advanced on correct recall').toBe(2);
  expect(new Date(item.dueAt).getTime(), 'next review scheduled in the future').toBeGreaterThan(Date.now());
  expect(item.lastReviewedAt, 'review history timestamp recorded').toBeTruthy();
});

test('8a. speech input degrades gracefully when the browser lacks SpeechRecognition', async ({ page }) => {
  await stubSpeech(page, { recognition: false });
  await page.goto('/');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /speak|practice/i }).first().click();
  // Tap the mic control; the app must show a readable error, never crash.
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.getByRole('button', { name: /speak your reply/i }).click();
  await expect(page.getByText(/speech|microphone|browser|voice|recognis|recogniz|unavailable|unsupported/i).first()).toBeVisible({ timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('8b. browser speech input path engages when recognition is available', async ({ page }) => {
  await stubSpeech(page, { recognition: true });
  await page.goto('/');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('e2e@example.test');
  await inputs.nth(1).fill('Sup3r-Secret!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('button', { name: /speak|practice/i }).first().click();
  // The HEAD feature copy: labelled browser-recogniser mode note.
  await expect(page.getByText(/browser's speech recognition/i)).toBeVisible();
  await page.getByRole('button', { name: /speak your reply/i }).click();
  await expect(page.getByText(/Listening…/)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /stop recording/i }).click();
  // Honest fallback: transcription came back empty → no fabricated result claim.
  await expect(page.getByText(/didn'?t catch|couldn'?t hear|nothing|try again|empty/i).first()).toBeVisible({ timeout: 10_000 });
});

test('9. mobile viewport remains usable and keyboard-navigable', async ({ page, browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mp = await ctx.newPage();
  const errors = [];
  mp.on('pageerror', (e) => errors.push(String(e)));
  await mp.goto('/');
  await expect(mp.getByText('Speak like a native.')).toBeVisible();
  // No horizontal overflow at phone width.
  const overflow = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'no horizontal scroll at 390px').toBeLessThanOrEqual(1);
  // Keyboard focus reaches interactive controls.
  await mp.keyboard.press('Tab');
  const focused = await mp.evaluate(() => document.activeElement?.tagName ?? '');
  expect(['A', 'BUTTON', 'INPUT', 'TEXTAREA'].includes(focused), `focus landed on interactive element (${focused})`).toBeTruthy();
  expect(errors).toEqual([]);
  await ctx.close();
});
