/**
 * Supabase migration directory must mirror the remote migration history.
 *
 * Why this exists: the "Supabase Preview" GitHub check failed on every
 * push to main with "Remote migration versions not found in local
 * migrations directory." Three migrations had been applied remotely
 * (versions 20261023042259, 20261023042605, 20261023111245) and later
 * committed locally under different, rounded timestamps (…071500,
 * …073000, …110000). Supabase compares migration *versions* (the
 * timestamp prefix), not names, so the directories disagreed even
 * though the SQL was the same.
 *
 * The pinned list below is the remote history of project
 * dvgluivslmdrqsvlscmj as read back with `list_migrations` (and the
 * statements in `supabase_migrations.schema_migrations`) on
 * 2026-10-23. When you apply a NEW migration remotely, add its exact
 * version + name here in the same commit that adds the file —
 * never rename a migration after it has been applied.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dir = path.join(root, 'supabase', 'migrations');
const files = readdirSync(dir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

/** Remote history (version_name), in applied order. */
const REMOTE_HISTORY = [
  '20261023035345_babelish_android_supabase_foundation',
  '20261023035624_content_reports_and_rls_hardening',
  '20261023042259_ai_usage_daily',
  '20261023042605_ai_usage_deny_policy',
  '20261023111245_defaults_refund_and_report_notes',
];

test('every migration file is named <14-digit version>_<name>.sql', () => {
  assert.ok(files.length > 0, 'no migrations found');
  for (const file of files) {
    assert.match(
      file,
      /^\d{14}_[a-z0-9_]+\.sql$/,
      `${file} is not a valid Supabase migration filename`
    );
  }
});

test('migration versions are unique and in ascending order', () => {
  const versions = files.map((file) => file.slice(0, 14));
  assert.deepEqual(versions, [...versions].sort(), 'files must sort by version');
  assert.equal(new Set(versions).size, versions.length, 'duplicate migration version');
});

test('local migration versions exactly match the remote-applied history', () => {
  const local = files.map((file) => file.replace(/\.sql$/, ''));
  assert.deepEqual(
    local,
    REMOTE_HISTORY,
    'local supabase/migrations drifted from the remote history — ' +
      'this is what fails the Supabase Preview check with ' +
      '"Remote migration versions not found in local migrations directory." ' +
      'If you applied a new migration remotely, add its version here.'
  );
});

test('the ai_usage deny policy is created by exactly one migration', () => {
  // It briefly lived in both ai_usage_daily and ai_usage_deny_policy.
  // One owner only, so replaying the directory on a fresh preview
  // database produces the remote schema without surprises.
  const creators = files.filter((file) =>
    /create policy ai_usage_daily_no_client_access/i.test(
      readFileSync(path.join(dir, file), 'utf8')
    )
  );
  assert.deepEqual(creators, ['20261023042605_ai_usage_deny_policy.sql']);
});

test('no migration file is empty', () => {
  for (const file of files) {
    const sql = readFileSync(path.join(dir, file), 'utf8')
      .replace(/--.*$/gm, '')
      .trim();
    assert.ok(sql.length > 0, `${file} contains no SQL statements`);
    assert.ok(sql.endsWith(';'), `${file} must end with a complete statement`);
  }
});
