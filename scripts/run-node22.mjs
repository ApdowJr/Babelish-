#!/usr/bin/env node
/**
 * Gate for the two repo scripts that literally require Node >= 22.6
 * (`--experimental-strip-types`): neon:e2e and review:dashboard.
 *
 * Why this exists: on Node 20 those npm scripts died with an opaque
 * "bad option" error. Rather than pretend they run everywhere, we fail
 * with a precise, actionable message. (The smoke harness is different: it
 * ADAPTS to Node 20 via a compiled scratch build — see local-api-smoke.mjs.)
 */
import { spawnSync } from 'node:child_process';

const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  console.error(
    `This script needs Node >= 22.6 (--experimental-strip-types). Running ${process.version}.\n` +
      'Switch with e.g. `nvm use 22` — everything else in the repo gates runs on Node 20.'
  );
  process.exit(2);
}
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('usage: run-node22.mjs <script.mjs> [args…]');
  process.exit(2);
}
const r = spawnSync(process.execPath, ['--experimental-strip-types', ...args], { stdio: 'inherit' });
process.exit(r.status ?? 1);
