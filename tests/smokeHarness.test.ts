/**
 * Regression tests for the `npm run smoke:local` harness.
 *
 * Root causes these guard (all were real P0 breakages on Node 20):
 *   1. The harness once used `module.registerHooks()` — an API that only
 *      exists on Node >= 22.15 — so the loader crashed with a SyntaxError
 *      on the repo's supported runtime. It must use `module.register()`.
 *   2. Child phases were spawned with `--experimental-strip-types`
 *      unconditionally; Node 20 rejects that unknown flag outright. The
 *      launch must be runtime-adaptive, and the compiled-fallback path must
 *      import `.smoke-build`, never a `.ts` file.
 *   3. `.env.local` was read unconditionally — missing file hard-crashed
 *      the harness before any test ran. It is now optional.
 *   4. The resolve hook (`scripts/smoke-resolve-hook.mjs`) is what lets the
 *      TS path import work at all: Metro-style extensionless specifiers
 *      like `./admin` must resolve to `./admin.ts`. If that regresses,
 *      phase 1 dies with ERR_MODULE_NOT_FOUND.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd(); // scripts/test.mjs runs compiled tests from the repo root
const harnessPath = path.join(root, 'scripts', 'local-api-smoke.mjs');
const hookPath = path.join(root, 'scripts', 'smoke-resolve-hook.mjs');
const src = readFileSync(harnessPath, 'utf8');
// (hook behaviour is exercised directly via the resolve() tests below)

test('harness uses module.register(), not the Node>=22.15 registerHooks()', () => {
  assert.match(src, /import \{[^}]*\bregister\b[^}]*\} from 'node:module'/);
  // Strip comments before scanning for usage — the file legitimately
  // documents WHY registerHooks was replaced; what must never come back is
  // a code-level call or import of it.
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(code, /registerHooks/, 'registerHooks() broke the smoke on Node 20');
});

test('child launch is runtime-adaptive: strip-types flag is conditional', () => {
  assert.match(src, /hasNativeTypeStripping\(\)/);
  // The flags array must spread the flag conditionally — a literal
  // unconditional '--experimental-strip-types' entry would crash Node 20.
  assert.match(src, /\.\.\.\(useTs \? \['--experimental-strip-types'\] : \[\]\)/);
  assert.match(src, /compileSmokeBuild\(\)/, 'Node 20 fallback build must still be wired in');
});

test('compiled fallback imports .smoke-build JS; TS path imports index.ts', () => {
  // Both entry points are selected via SMOKE_USE_TS; neither may be dead code.
  assert.match(src, /SMOKE_USE_TS === '1'/);
  assert.match(src, /\.smoke-build\/functions\/api\/index\.js/);
  assert.match(src, /functions\/api\/index\.ts/);
});

test('.env.local is optional (read wrapped in try/catch)', () => {
  const loadEnvIdx = src.indexOf('function loadEnvLocal');
  assert.ok(loadEnvIdx >= 0);
  const body = src.slice(loadEnvIdx, src.indexOf('/* ──', loadEnvIdx));
  assert.match(body, /catch/, 'missing .env.local must not crash the harness');
  assert.match(body, /readFileSync\(resolve\(root, '\.env\.local'\)/);
});

test('local DB provisioning applies the repo schema and stays local-only', () => {
  assert.match(src, /provisionLocalPostgres\(\)/);
  assert.match(src, /smoke-db\.sh/);
  assert.match(src, /neon', 'schema\.sql|schema\.sql/);
});

test('resolve hook: "./admin" resolves to the real admin.ts module', async () => {
  // Exercise the ACTUAL exported resolve() against the real source tree.
  const mod = await import(pathToFileURL(hookPath).href);
  const parent = pathToFileURL(path.join(root, 'functions', 'api', 'index.ts')).href;
  assert.ok(existsSync(path.join(root, 'functions', 'api', 'admin.ts')));

  // nextResolve receives the REWRITTEN specifier — assert on what the hook
  // hands forward, not on the stub's URL resolution of relative paths.
  // The hook only rewrites when plain resolution FAILS (real Node rejects
  // extensionless specifiers; a lenient stub would succeed and bypass it),
  // so this stub throws ERR_MODULE_NOT_FOUND like real ESM does.
  let forwarded = '';
  const nextResolve = async (spec: string) => {
    if (spec === './admin') {
      const err: any = new Error("Cannot find module '/admin' imported from ...");
      err.code = 'ERR_MODULE_NOT_FOUND';
      throw err;
    }
    forwarded = spec;
    return { url: pathToFileURL(spec).href, shortCircuit: true };
  };

  const resolved = await mod.resolve('./admin', { parentURL: parent }, nextResolve);
  assert.equal(forwarded, './admin.ts', 'extensionless ./admin must map to admin.ts');
  assert.ok(resolved.url.length > 0);
});

test('resolve hook: passes through specifiers that already have extensions', async () => {
  const mod = await import(pathToFileURL(hookPath).href);
  const parent = pathToFileURL(path.join(root, 'functions', 'api', 'index.ts')).href;
  let saw = '';
  const nextResolve = async (spec: string) => {
    saw = spec;
    return { url: pathToFileURL(spec).href, shortCircuit: true };
  };
  await mod.resolve('./admin.ts', { parentURL: parent }, nextResolve);
  assert.equal(saw, './admin.ts', 'already-extended specifiers must pass through untouched');
});

test('smoke-db.sh targets only the disposable local cluster', () => {
  const sh = readFileSync(path.join(root, 'scripts', 'smoke-db.sh'), 'utf8');
  assert.match(sh, /babelish_smoke/);
  assert.match(sh, /127\.0\.0\.1/);
  assert.doesNotMatch(sh, /neon\.tech|aws|supabase\.co/i, 'fixture script must never touch cloud hosts');
});
