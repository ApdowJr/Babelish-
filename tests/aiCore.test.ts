/**
 * Contract tests for the shared AI core used by BOTH the client and the
 * backend proxy: request validation (untrusted input), the native-speaker
 * system prompt, reply parsing, and the non-Latin-script guardrail that keeps
 * the tutor in the target language.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSystemPrompt,
  extractTutorReply,
  parseAiChatRequest,
  parseTutorPayload,
  scriptMatches,
} from '../src/lib/aiCore';
import { getLanguage, LANGUAGES } from '../src/data/languages';

const es = getLanguage('es');
const ar = getLanguage('ar');
const zh = getLanguage('zh');
const ru = getLanguage('ru');

/* ── parseAiChatRequest: the server's only gate on untrusted bodies ─────── */

test('parseAiChatRequest: rejects non-objects and unknown languages', () => {
  assert.equal(parseAiChatRequest(null).ok, false);
  assert.equal(parseAiChatRequest('hi').ok, false);
  assert.equal(parseAiChatRequest({}).ok, false);
  assert.equal(parseAiChatRequest({ languageId: 'xx', history: [{ role: 'user', text: 'a' }] }).ok, false);
});

test('getLanguage falls back to the first language for unknown ids (why validation must not use it)', () => {
  assert.equal(getLanguage('definitely-not-a-language').id, LANGUAGES[0].id);
});

function validHistory(n: number, text = 'hello tutor') {
  return Array.from({ length: n }, (_, i) => ({
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    text,
  }));
}

test('parseAiChatRequest: accepts a minimal valid request', () => {
  const parsed = parseAiChatRequest({ languageId: 'es', history: validHistory(2) });
  assert.ok(parsed.ok);
  assert.equal(parsed.request.languageId, 'es');
  assert.equal(parsed.request.history.length, 2);
  assert.equal(parsed.request.level, undefined);
});

test('parseAiChatRequest: history must be present, well-formed, bounded', () => {
  assert.equal(parseAiChatRequest({ languageId: 'es', history: [] }).ok, false);
  assert.equal(parseAiChatRequest({ languageId: 'es', history: validHistory(41) }).ok, false);
  assert.equal(
    parseAiChatRequest({ languageId: 'es', history: [{ role: 'tool', text: 'x' }] }).ok,
    false,
    'non user/assistant roles rejected'
  );
  assert.equal(
    parseAiChatRequest({ languageId: 'es', history: [{ role: 'user', text: '   ' }] }).ok,
    false,
    'blank text rejected'
  );
  assert.equal(
    parseAiChatRequest({ languageId: 'es', history: [{ role: 'user', text: 'x'.repeat(4001) }] }).ok,
    false,
    'oversized message rejected'
  );
  assert.ok(parseAiChatRequest({ languageId: 'es', history: validHistory(40) }).ok, '40 is allowed');
});

test('parseAiChatRequest: sanitizes optional fields instead of trusting them', () => {
  const parsed = parseAiChatRequest({
    languageId: 'ja',
    level: 'B2',
    scenarioTitle: 's'.repeat(200),
    learnerName: 'n'.repeat(100),
    profile: {
      job: 'j'.repeat(200),
      interests: ['x'.repeat(100), 1, 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'],
      goals: ['travel'],
      nativeLanguageName: 'English',
    },
    history: validHistory(1),
  });
  assert.ok(parsed.ok);
  const r = parsed.request;
  assert.equal(r.level, 'B2');
  assert.equal(r.scenarioTitle?.length, 120);
  assert.equal(r.learnerName?.length, 60);
  assert.equal(r.profile?.job?.length, 120);
  assert.deepEqual(r.profile?.interests?.length, 8, 'capped at 8 valid strings');
  assert.equal(r.profile?.interests?.some((i) => typeof i !== 'string'), false, 'non-strings dropped');
  assert.equal(r.profile?.interests?.[0]?.length, 60, 'each entry trimmed to 60');
  assert.deepEqual(r.profile?.goals, ['travel']);

  const badLevel = parseAiChatRequest({ languageId: 'es', level: 'banana', history: validHistory(1) });
  assert.ok(badLevel.ok);
  assert.equal(badLevel.request.level, undefined, 'unknown CEFR levels are dropped, not rejected');
});

/* ── buildSystemPrompt: the "stay in the target language" guarantee ─────── */

test('buildSystemPrompt: carries language, level, scenario, learner and profile', () => {
  const sys = buildSystemPrompt({
    language: es,
    level: 'A2',
    scenarioTitle: 'At the market',
    learnerName: 'Sam',
    profile: { job: 'nurse', interests: ['chess'] },
  });
  assert.match(sys, /You ALWAYS reply in Spanish/);
  assert.match(sys, /CEFR level is A2/);
  assert.match(sys, /At the market/);
  assert.match(sys, /learner's name is Sam/);
  assert.match(sys, /STRICT JSON/);
  assert.ok(sys.includes('nurse'), 'profile job lands in the prompt');
  assert.ok(sys.includes('chess'), 'profile interests land in the prompt');
  assert.ok(!sys.includes('undefined'), 'no template holes');
});

test('buildSystemPrompt: omits optional parts without leaving artifacts', () => {
  const sys = buildSystemPrompt({ language: es, level: 'B1' });
  assert.ok(!sys.includes('learner\'s name is'), 'no learner line without a name');
  assert.ok(!sys.includes('At the'), 'no scenario line without a scenario');
  assert.match(sys, /two friends talking/, 'everyday fallback scenario');
});

/* ── parseTutorPayload / extractTutorReply: no fabricated or leaked text ── */

test('parseTutorPayload: extracts JSON through a chatty preamble', () => {
  const parsed = parseTutorPayload('Sure thing! {"reply":"Hola","translation":"Hi","tip":"Nice"}');
  assert.equal(parsed.text, 'Hola');
  assert.equal(parsed.translation, 'Hi');
  assert.equal(parsed.tip, 'Nice');
});

test('parseTutorPayload: plain text falls back untouched', () => {
  const parsed = parseTutorPayload('¡Qué tal!');
  assert.equal(parsed.text, '¡Qué tal!');
  assert.equal(parsed.translation, '');
});

test('parseTutorPayload: valid JSON without a reply is EMPTY, never the raw JSON', () => {
  const parsed = parseTutorPayload('{"reply":"","translation":""}');
  assert.equal(parsed.text, '', 'an empty contract answer must read as empty');

  const noKey = parseTutorPayload('{"foo":1}');
  assert.equal(noKey.text, '', 'a non-contract JSON object must not leak as tutor text');
});

test('parseTutorPayload: non-JSON braces stay in the raw text', () => {
  const parsed = parseTutorPayload('Fill in the {placeholder} first.');
  assert.equal(parsed.text, 'Fill in the {placeholder} first.');
});

test('extractTutorReply: strict pass/fail for real mode', () => {
  const ok = extractTutorReply('{"reply":"Hola, ¿qué tal?","translation":"Hi, how are you?"}', es);
  assert.equal(ok.text, 'Hola, ¿qué tal?');

  const plain = extractTutorReply('¡Muy bien!', es);
  assert.equal(plain.text, '¡Muy bien!');

  assert.throws(
    () => extractTutorReply('{"reply":"","translation":""}', es),
    /empty reply/,
    'empty reply surfaces as an error — never demo content'
  );
  assert.throws(
    () => extractTutorReply('{"reply":"hello there","translation":"hello"}', ar),
    /wrong script/
  );
  assert.throws(
    () => extractTutorReply('{"reply":"hello there","translation":"hello"}', zh),
    /wrong script/
  );
});

/* ── scriptMatches: which languages get the guardrail ───────────────────── */

test('scriptMatches: non-Latin languages must answer in their script', () => {
  assert.equal(scriptMatches('مرحبا', ar), true);
  assert.equal(scriptMatches('hello', ar), false);
  assert.equal(scriptMatches('你好', zh), true);
  assert.equal(scriptMatches('hello', zh), false);
  assert.equal(scriptMatches('привет', ru), true, 'Cyrillic rule matches Russian');
});

test('scriptMatches: Latin-script languages accept anything', () => {
  assert.equal(scriptMatches('anything at all', es), true);
  assert.equal(scriptMatches('anything at all', getLanguage('sw')), true);
});
