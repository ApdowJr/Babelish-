#!/usr/bin/env node
/**
 * Tutor release gate.
 *
 * A deploy that reports `chat:false`, or answers `/api/ai/status` but cannot
 * produce a single reply, is not a working tutor — and until now nothing
 * checked. This script talks to the deployed Function and fails loudly.
 *
 * It is deliberately honest rather than clever:
 *   - it never invents a pass when the network failed;
 *   - it distinguishes "not configured" (exit 1) from "out of daily budget"
 *     (exit 3), because those need different actions;
 *   - it prints no secrets, and the reply it checks is a fixed test phrase.
 *
 * Usage:
 *   npm run check:tutor                 # uses the production Function URL
 *   npm run check:tutor -- --url https://...   # another deployment
 *   npm run check:tutor -- --status-only       # no quota spent
 *
 * Env: TUTOR_URL overrides the URL; TUTOR_CHECK_TIMEOUT_MS tunes the wait.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function defaultUrl() {
  if (process.env.TUTOR_URL) return process.env.TUTOR_URL;
  try {
    const source = readFileSync(resolve(root, 'src/lib/neon.ts'), 'utf8');
    const match = source.match(/const PROD_API_URL =\s*'([^']+)'/);
    if (match) return match[1];
  } catch {
    /* handled below */
  }
  return '';
}

const url = (arg('--url') ?? defaultUrl()).replace(/\/+$/, '');
const statusOnly = process.argv.includes('--status-only');
const timeoutMs = Number(process.env.TUTOR_CHECK_TIMEOUT_MS ?? 60_000);

if (!url) {
  console.error(
    'No tutor URL. Pass --url https://… or set TUTOR_URL.\n' +
      '(Could not read the built-in default from src/lib/neon.ts.)'
  );
  process.exit(2);
}

const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

async function getStatus() {
  const res = await fetch(`${url}/api/ai/status`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  const body = await res.json().catch(() => null);
  return { res, body };
}

async function main() {
  console.log(`Tutor gate → ${url}\n`);

  // Deploys are eventually consistent; the first probe often hits a cold
  // instance that still reports the previous environment.
  let attempt = null;
  for (let i = 0; i < 3; i += 1) {
    try {
      const { res, body } = await getStatus();
      attempt = { res, body };
      if (res.ok && body?.chat === true) break;
    } catch (err) {
      attempt = { error: err instanceof Error ? err.message : String(err) };
    }
    if (i < 2) {
      console.log(`  … not ready yet (attempt ${i + 1}/3), retrying in 5s`);
      await sleep(5_000);
    }
  }

  if (!attempt || attempt.error) {
    console.error(`✘ Could not reach the tutor server: ${attempt?.error ?? 'no response'}`);
    console.error('  Check the URL, the deployment, and that the Function is not paused.');
    process.exit(1);
  }

  const { res, body } = attempt;
  if (!res.ok) {
    console.error(`✘ /api/ai/status answered HTTP ${res.status}`);
    process.exit(1);
  }

  const quota = body?.quota ?? {};
  console.log(`  configured : ${body.chat ? 'yes' : 'no'}`);
  console.log(`  model      : ${body.model ?? '(none)'}`);
  if (Array.isArray(body.models) && body.models.length > 1) {
    console.log(`  fallbacks  : ${body.models.slice(1).join(', ')}`);
  }
  console.log(`  voice      : ${body.stt ? 'server transcription' : 'browser Whisper / typing'}`);
  if (quota.learnerChat) {
    console.log(
      `  daily caps : ${quota.learnerChat} chats / ${quota.learnerStt} voice per learner, ` +
        `${quota.dailyBudget} chats server-wide`
    );
    console.log(`  resets     : ${new Date(quota.resetsAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
  }

  if (body.chat !== true) {
    console.error(
      '\n✘ The tutor is NOT live: the Function reports chat:false.\n' +
        '  Set AI_API_KEY / AI_API_URL / AI_MODELS on the Function, then redeploy:\n' +
        '    AI_API_KEY=sk-or-... npm run deploy:tutor'
    );
    process.exit(1);
  }

  if (statusOnly) {
    console.log('\n✔ Status check passed (chat not exercised, --status-only).');
    process.exit(0);
  }

  // One real turn. A status flag can be set while the key is wrong, the model
  // is retired, or the provider is down — only an answer proves the path.
  let chatRes;
  let chatBody;
  try {
    chatRes = await fetch(`${url}/api/ai/chat`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        languageId: 'es',
        level: 'A1',
        history: [{ role: 'user', text: 'Hola' }],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    chatBody = await chatRes.json().catch(() => null);
  } catch (err) {
    console.error(`\n✘ Chat probe failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  if (chatRes.status === 429 && typeof chatBody?.error === 'string' && chatBody.error.startsWith('daily-')) {
    console.log(`\n! Tutor is configured but today's budget is spent (${chatBody.error}).`);
    console.log(`  ${chatBody.message ?? ''}`);
    console.log('  This is not a configuration failure — re-run after the reset.');
    process.exit(3);
  }

  if (chatRes.status === 503) {
    console.error(`\n✘ Chat answered 503 (${chatBody?.error ?? 'no body'}) — the model is not wired.`);
    process.exit(1);
  }

  if (!chatRes.ok) {
    console.error(`\n✘ Chat answered HTTP ${chatRes.status}: ${chatBody?.message ?? ''}`);
    process.exit(1);
  }

  const reply = typeof chatBody?.reply === 'string' ? chatBody.reply.trim() : '';
  const translation = typeof chatBody?.translation === 'string' ? chatBody.translation.trim() : '';

  if (!reply) {
    console.error('\n✘ Chat answered 200 but the reply was empty — not a working tutor.');
    process.exit(1);
  }
  if (!translation) {
    console.error('\n✘ Chat reply had no translation — the JSON contract is broken.');
    process.exit(1);
  }

  const preview = reply.length > 80 ? `${reply.slice(0, 80)}…` : reply;
  console.log(`\n  sample     : ${JSON.stringify(preview)}`);
  console.log(`  model used : ${chatBody.model ?? body.model}`);
  console.log('\n✔ Tutor gate passed: a real model answered.');
}

await main();
