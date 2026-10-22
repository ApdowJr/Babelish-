/**
 * Module-resolution loader for `npm run smoke:local`.
 *
 * Registered by scripts/local-api-smoke.mjs via `module.register()` (Node
 * >= 20.6 — the previous inline `registerHooks` API required Node >= 22.15
 * and broke the harness on the repo's supported runtime). Runs on the
 * dedicated loader thread, so it applies to every import in this process,
 * including the child-phase processes that spawn with
 * --experimental-strip-types.
 *
 * Purpose: the app's sources use Metro-style extensionless relative imports
 * (./admin, ../../src/lib/aiCore) that plain Node ESM rejects. This hook
 * resolves them to .ts / index.ts / .js / .mjs; everything else passes
 * through untouched.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (
      (specifier.startsWith('./') || specifier.startsWith('../')) &&
      !/\.[cm]?[jt]s$/.test(specifier)
    ) {
      // Resolve the parent URL once; then probe candidate paths directly.
      // Probing the filesystem avoids relying on nextResolve error shapes,
      // which differ between Node versions.
      const parentPath = fileURLToPath(context.parentURL);
      const baseDir = new URL('.', context.parentURL);
      for (const suffix of ['.ts', '/index.ts', '.js', '.mjs']) {
        const candidate = fileURLToPath(new URL(specifier + suffix, baseDir));
        if (parentPath && existsSync(candidate)) {
          return nextResolve(specifier + suffix, context);
        }
      }
    }
    throw err;
  }
}
