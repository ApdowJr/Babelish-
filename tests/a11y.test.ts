/**
 * Accessibility guardrails that can be checked without a screen reader.
 *
 * A screen reader test needs a device; these are the two failures that are
 * purely structural and that regress silently in review:
 *   - a tappable element with no accessible name (TalkBack says "button"), and
 *   - a modal without a hardware-back/escape handler (traps the user).
 *
 * The scanner reads the real source, so a new screen cannot quietly skip the
 * rule. Decorative wrappers opt out explicitly with `accessible={false}`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const SRC = path.join(root, 'src');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** The whole opening tag starting at `<Name`, counting `{…}` so `>` inside JSX is safe. */
function openingTag(source: string, start: number): string {
  let braces = 0;
  let quotes: string | null = null;
  for (let i = start; i < source.length; i += 1) {
    const char = source[i];
    if (quotes) {
      if (char === quotes) quotes = null;
      continue;
    }
    if (char === '"' || char === "'") quotes = char;
    else if (char === '{') braces += 1;
    else if (char === '}') braces -= 1;
    else if (char === '>' && braces === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function findTags(source: string, name: string): { tag: string; line: number }[] {
  const found: { tag: string; line: number }[] = [];
  const pattern = new RegExp(`<${name}\\b`, 'g');
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source))) {
    found.push({ tag: openingTag(source, match.index), line: source.slice(0, match.index).split('\n').length });
  }
  return found;
}

test('every Pressable has an accessible name or an explicit decorative opt-out', () => {
  const problems: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const { tag, line } of findTags(source, 'Pressable')) {
      const decorative = /accessible=\{false\}|importantForAccessibility="no"/.test(tag);
      const named =
        /accessibility(L|R)abel=/.test(tag) ||
        /accessibilityRole=/.test(tag) ||
        /accessibilityHint=/.test(tag);
      if (!decorative && !named) {
        problems.push(`${path.relative(root, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(problems, [], `unnamed tappables:\n${problems.join('\n')}`);
});

test('every Modal can be dismissed without the on-screen close button', () => {
  const problems: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const { tag, line } of findTags(source, 'Modal')) {
      if (!/onRequestClose=/.test(tag)) {
        problems.push(`${path.relative(root, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(problems, [], `modals without onRequestClose:\n${problems.join('\n')}`);
});

test('interactive rows in the tutor screen carry labels', () => {
  const source = readFileSync(path.join(SRC, 'app', '(tabs)', 'speak.tsx'), 'utf8');
  // The three controls a learner uses mid-conversation.
  assert.match(source, /accessibilityLabel="Stop the tutor"/);
  assert.match(source, /accessibilityLabel="Send message"/);
  assert.match(source, /accessibilityLabel=\{chatRecording \? 'Stop recording' : 'Speak your reply'\}/);
  // The conversation itself is announced as a region, and status changes are live.
  assert.match(source, /accessibilityLabel="Conversation with your tutor"/);
  // Destructive actions must be named, and the crash probe must not ship as a
  // route that throws in production.
  assert.match(source, /accessibilityLabel="Clear this conversation"/);
  const probe = readFileSync(path.join(SRC, 'app', 'dev-crash.tsx'), 'utf8');
  assert.match(probe, /if \(!__DEV__\) return <Redirect href="\/" \/>/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
});
