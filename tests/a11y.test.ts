/**
 * Accessibility guardrails that can be checked without a device.
 *
 * Two failures are structural and invisible in review until a screen reader
 * is on: a tappable element with no accessible name (TalkBack reads "button"),
 * and a modal that cannot be dismissed with the hardware back button. This
 * scans the real source so a new screen cannot quietly omit either.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve(process.cwd(), 'src');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (name.endsWith('.tsx')) out.push(full);
  }
  return out;
}

/** The opening tag of every `<Name ...>` occurrence, brackets balanced. */
function tags(source: string, name: string): { tag: string; line: number }[] {
  const found: { tag: string; line: number }[] = [];
  const needle = `<${name}`;
  let index = source.indexOf(needle);
  while (index !== -1) {
    let depth = 0;
    let end = index;
    for (; end < source.length; end += 1) {
      const char = source[end];
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) break;
    }
    found.push({
      tag: source.slice(index, end + 1),
      line: source.slice(0, index).split('\n').length,
    });
    index = source.indexOf(needle, end + 1);
  }
  return found;
}

test('every Pressable is named, or explicitly marked decorative', () => {
  const problems: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const { tag, line } of tags(source, 'Pressable')) {
      const decorative =
        tag.includes('accessible={false}') || tag.includes('importantForAccessibility="no"');
      const named = tag.includes('accessibilityLabel') || tag.includes('accessibilityRole');
      if (!decorative && !named) {
        problems.push(`${path.relative(SRC, file)}:${line}`);
      }
    }
  }
  assert.deepEqual(problems, [], `Pressables without a name or opt-out:\n${problems.join('\n')}`);
});

test('every Modal can be dismissed with the hardware back button', () => {
  const problems: string[] = [];
  for (const file of tsxFiles(SRC)) {
    const source = readFileSync(file, 'utf8');
    for (const { tag, line } of tags(source, 'Modal')) {
      if (!tag.includes('onRequestClose')) problems.push(`${path.relative(SRC, file)}:${line}`);
    }
  }
  assert.deepEqual(problems, [], `Modals without onRequestClose:\n${problems.join('\n')}`);
});

test('the Speak screen exposes the controls a screen-reader user needs', () => {
  const source = readFileSync(path.join(SRC, 'app', '(tabs)', 'speak.tsx'), 'utf8');
  // The three controls a learner uses mid-conversation.
  assert.match(source, /accessibilityLabel="Stop the tutor"/);
  assert.match(source, /accessibilityLabel="Send message"/);
  assert.match(source, /accessibilityLabel=\{chatRecording \? 'Stop recording' : 'Speak your reply'\}/);
  // The conversation itself is announced as a region, and status changes are live.
  assert.match(source, /accessibilityLabel="Conversation with your tutor"/);
  assert.match(source, /accessibilityLiveRegion="polite"/);
});

test('the settings screen and splash are reachable and labelled', () => {
  const settings = readFileSync(path.join(SRC, 'app', 'settings.tsx'), 'utf8');
  assert.match(settings, /accessibilityLabel=\{t\("Search settings"\)\}/);
  assert.match(settings, /accessibilityLabel=\{t\("Go back"\)\}/);
  assert.match(settings, /accessibilityRole="switch"/);
  assert.match(settings, /accessibilityState=\{\{ selected: option.active \}\}/);

  const splash = readFileSync(path.join(SRC, 'components', 'AnimatedSplash.tsx'), 'utf8');
  assert.match(splash, /accessibilityRole="progressbar"/);
  assert.match(splash, /accessibilityLabel="Babelish is starting"/);

  const layout = readFileSync(path.join(SRC, 'app', '_layout.tsx'), 'utf8');
  // The app behind the splash must be inert, not merely invisible.
  assert.match(layout, /importantForAccessibility=\{splashDone \? 'auto' : 'no-hide-descendants'\}/);
});
