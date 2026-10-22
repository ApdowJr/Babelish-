#!/usr/bin/env node
/**
 * Turns the tutor on for every learner — no app rebuild, no model download.
 *
 * What it does: deploys the `api` Function with the model chain in its
 * environment. The key never enters the app bundle; the client only ever calls
 * your backend.
 *
 * Usage:
 *   AI_API_KEY=sk-or-... npm run deploy:tutor
 *
 * Optional overrides (defaults target OpenRouter's free Qwen3 endpoints, which
 * document all 24 Babelish languages):
 *   AI_API_URL   https://openrouter.ai/api/v1
 *   AI_MODELS    qwen/qwen3-next-80b-a3b-instruct:free,qwen/qwen3-next-80b-a3b-instruct
 *   AI_STT_ENABLED  false  (server transcription is metered per second of audio)
 *
 * Requires an authenticated Neon CLI (`neon auth` or NEON_API_KEY).
 *
 * After the deploy it runs the tutor gate (scripts/check-tutor.mjs) against the
 * live Function: a deploy that leaves `chat:false` — or a key the provider
 * rejects — fails here instead of being discovered by a learner. Set
 * SKIP_TUTOR_GATE=1 to deploy without the check.
 */
import { spawnSync } from 'node:child_process';

const key = process.env.AI_API_KEY?.trim();
if (!key) {
  console.error(
    'Missing AI_API_KEY. Run:\n\n  AI_API_KEY=sk-or-... npm run deploy:tutor\n'
  );
  process.exit(1);
}

const apiUrl = (process.env.AI_API_URL ?? 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const models = (
  process.env.AI_MODELS ??
  'qwen/qwen3-next-80b-a3b-instruct:free,qwen/qwen3-next-80b-a3b-instruct'
)
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean);
const sttEnabled = process.env.AI_STT_ENABLED ?? 'false';
const sttModel = process.env.AI_STT_MODEL ?? 'openai/whisper-large-v3-turbo';

const args = [
  'functions',
  'deploy',
  'api',
  '--src',
  'functions/api/index.ts',
  '--env',
  `AI_API_KEY=${key}`,
  '--env',
  `AI_API_URL=${apiUrl}`,
  '--env',
  `AI_MODELS=${models.join(',')}`,
  '--env',
  `AI_STT_ENABLED=${sttEnabled}`,
  '--env',
  `AI_STT_MODEL=${sttModel}`,
  '--wait',
];

// Print what will happen without leaking the key.
console.log('Deploying the Babelish tutor server');
console.log(`  endpoint : ${apiUrl}`);
console.log(`  models   : ${models.join(' → ')}`);
console.log(`  voice    : ${sttEnabled === 'true' ? `server (${sttModel}, metered)` : 'browser Whisper (free)'}`);
console.log('  key      : set in the Function environment only (not shown, not bundled)\n');

const run = spawnSync('neon', args, { stdio: 'inherit' });

if (run.error) {
  console.error(
    `\nCould not run the Neon CLI (${run.error.message}).\n` +
      'Install it and authenticate, then run this again:\n' +
      '  https://neon.com/docs/reference/neon-cli\n'
  );
  process.exit(1);
}
if (run.status !== 0) {
  console.error('\nDeploy failed — the Function was not updated. Existing settings are preserved.');
  process.exit(run.status ?? 1);
}

// A deploy is not a working tutor until something answers. Probe the live
// Function before declaring success; the app has no way to fix this later.
if (process.env.SKIP_TUTOR_GATE === '1') {
  console.log('\nDeployed. Tutor gate skipped (SKIP_TUTOR_GATE=1).');
  process.exit(0);
}

console.log('\nChecking the deployed tutor…');
const gate = spawnSync(process.execPath, ['scripts/check-tutor.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, TUTOR_URL: process.env.TUTOR_URL ?? undefined },
});

if (gate.status === 3) {
  // Configured correctly, but today's shared budget is already spent. The
  // deploy was fine; the check simply cannot prove a reply until the reset.
  console.log('\nDeployed. The tutor is configured, but today\'s budget is spent —');
  console.log('the gate could not exercise a reply. Re-run it after the reset.');
  process.exit(0);
}
if (gate.status !== 0) {
  console.error(
    '\n✘ Deployed, but the tutor gate failed — the model is not usable from the app.\n' +
      '  Fix the key/model chain on the Function and deploy again:\n' +
      '    AI_API_KEY=sk-or-... npm run deploy:tutor'
  );
  process.exit(gate.status ?? 1);
}

console.log(
  '\nDone. Open the app → Speak: live answers should appear within a few seconds\n' +
    '(tap Retry if it still says Coach mode). Nothing is installed on a phone.'
);
