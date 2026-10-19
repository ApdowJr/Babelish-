#!/usr/bin/env node
/**
 * Unit-test runner for Nativa — zero extra dependencies.
 *
 * Flow:
 *   1. Compile `tests/*.test.ts` (plus the pure source modules they import)
 *      to a temp dir with the project's own TypeScript, as CommonJS.
 *   2. Run each compiled file with `node --test` (node:test is built in).
 *
 * Why this shape: the app's TS uses RN/Metro conventions (extensionless
 * relative imports, no ESM package type) that plain Node cannot execute
 * directly, and adding a test framework dependency would change the
 * dependency surface for no benefit. Fail (non-zero) on ANY compile or test
 * failure so CI/gates can gate on `npm test`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'tests');
const scratch = '/tmp/opencode'; // pre-approved scratch area for this workspace

const testFiles = readdirSync(testsDir)
  .filter((f) => f.endsWith('.test.ts'))
  .sort();
if (testFiles.length === 0) {
  console.error('No tests found in tests/');
  process.exit(1);
}
const entryPoints = testFiles.map((f) => path.join(testsDir, f));

mkdirSync(scratch, { recursive: true });
const outDir = mkdtempSync(path.join(scratch, 'nativa-tests-'));

console.log(`Compiling ${testFiles.length} test file(s)…`);
const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
const compile = spawnSync(
  process.execPath,
  [
    tsc,
    ...entryPoints,
    `--ignoreConfig`, // TS6: files on the CLI bypass tsconfig.json
    `--rootDir`, root,
    `--outDir`, outDir,
    `--module`, 'node16', // CJS output (package has no "type": "module")
    `--target`, 'es2022',
    `--strict`,
    `--esModuleInterop`,
    `--skipLibCheck`,
    `--types`, 'node',
  ],
  { stdio: 'inherit', cwd: root }
);
if (compile.status !== 0) {
  rmSync(outDir, { recursive: true, force: true });
  console.error('Test compilation failed.');
  process.exit(compile.status ?? 1);
}

let failed = 0;
for (const file of testFiles) {
  const compiled = path.join(outDir, 'tests', file.replace(/\.ts$/, '.js'));
  console.log(`\n── ${file} ${'─'.repeat(Math.max(0, 48 - file.length))}`);
  const run = spawnSync(process.execPath, ['--test', compiled], {
    stdio: 'inherit',
    cwd: root,
  });
  if (run.status !== 0) failed += 1;
}

rmSync(outDir, { recursive: true, force: true });
if (failed === 0) {
  console.log(`\n✔ all ${testFiles.length} test file(s) passed`);
  process.exit(0);
}
console.error(`\n✘ ${failed}/${testFiles.length} test file(s) FAILED`);
process.exit(1);
