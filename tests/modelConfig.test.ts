/**
 * Model-layer contract tests: URL safety, settings validation, runtime
 * planning and the per-language coverage gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SETTINGS,
  chatCandidates,
  languageSupport,
  normalizeSettings,
  sanitizeBaseUrl,
  sttCandidates,
  voiceUnavailableMessage,
  type ModelSettings,
} from '../src/lib/models/config';
import {
  MODELS,
  coverageFor,
  coverageSummary,
  findModel,
  modelsFor,
  runnableModelsFor,
} from '../src/lib/models/catalog';

const local: ModelSettings = {
  ...DEFAULT_SETTINGS,
  mode: 'local',
  ollamaUrl: 'http://localhost:11434',
  openaiUrl: '',
};

test('sanitizeBaseUrl accepts plain http(s) endpoints and normalises slashes', () => {
  assert.equal(sanitizeBaseUrl('http://localhost:11434/'), 'http://localhost:11434');
  assert.equal(sanitizeBaseUrl('https://models.example.org/v1/'), 'https://models.example.org/v1');
  assert.equal(sanitizeBaseUrl('  http://192.168.1.20:1234/v1  '), 'http://192.168.1.20:1234/v1');
});

test('sanitizeBaseUrl rejects credentials, non-http schemes and query strings', () => {
  assert.equal(sanitizeBaseUrl('https://user:pass@example.org'), null);
  assert.equal(sanitizeBaseUrl('javascript:alert(1)'), null);
  assert.equal(sanitizeBaseUrl('file:///etc/passwd'), null);
  assert.equal(sanitizeBaseUrl('https://example.org/?key=sk-secret'), null);
  assert.equal(sanitizeBaseUrl('http://example.org/#token'), null);
  assert.equal(sanitizeBaseUrl(''), null);
  assert.equal(sanitizeBaseUrl('not a url'), null);
});

test('normalizeSettings falls back on malformed values instead of trusting them', () => {
  const settings = normalizeSettings({
    mode: 'hacked',
    ollamaUrl: 'https://u:p@evil.example',
    ollamaModel: 'bad model<script>',
    level: 'Z9',
    allowUnverified: 'yes',
    browser: { enabled: 'true', runtimeUrl: 'ftp://x', chatModel: '' },
  });
  assert.equal(settings.mode, DEFAULT_SETTINGS.mode);
  assert.equal(settings.ollamaUrl, DEFAULT_SETTINGS.ollamaUrl);
  assert.equal(settings.ollamaModel, DEFAULT_SETTINGS.ollamaModel);
  assert.equal(settings.level, 'auto');
  assert.equal(settings.allowUnverified, false);
  assert.equal(settings.browser.enabled, false);
  assert.equal(settings.browser.runtimeUrl, DEFAULT_SETTINGS.browser.runtimeUrl);
});

test('normalizeSettings keeps valid custom configuration', () => {
  const settings = normalizeSettings({
    mode: 'browser',
    ollamaUrl: 'http://192.168.0.5:11434',
    ollamaModel: 'qwen2.5:7b',
    sttModel: 'whisper-small',
    browser: { enabled: true, chatModel: 'onnx-community/Qwen2.5-0.5B-Instruct' },
    allowUnverified: true,
    level: 'B1',
  });
  assert.equal(settings.mode, 'browser');
  assert.equal(settings.ollamaModel, 'qwen2.5:7b');
  assert.equal(settings.sttModel, 'whisper-small');
  assert.equal(settings.browser.enabled, true);
  assert.equal(settings.browser.chatModel, 'onnx-community/Qwen2.5-0.5B-Instruct');
  assert.equal(settings.allowUnverified, true);
  assert.equal(settings.level, 'B1');
});

test('runtime planning follows the selected mode and never includes a paid API', () => {
  const auto = chatCandidates(
    { ...local, mode: 'auto', browser: { ...DEFAULT_SETTINGS.browser, enabled: true } },
    { gatewayBase: 'https://api.example.org', browserSupported: true }
  );
  assert.deepEqual(auto, ['ollama', 'gateway', 'browser']);

  assert.deepEqual(chatCandidates(local, {}), ['ollama']);
  assert.deepEqual(chatCandidates({ ...local, mode: 'server' }, {}), []);
  assert.deepEqual(
    chatCandidates({ ...local, mode: 'server' }, { gatewayBase: 'https://api.example.org' }),
    ['gateway']
  );
  assert.deepEqual(chatCandidates({ ...local, mode: 'offline' }, { gatewayBase: 'x' }), []);
  assert.ok(auto.every((runtime) => !['paid', 'openai-paid'].includes(runtime)));
});

test('STT planning mirrors the same modes', () => {
  assert.deepEqual(sttCandidates({ ...local, mode: 'offline' }, {}), []);
  // `local` means this device/LAN: audio is never posted to the app's server.
  assert.deepEqual(sttCandidates(local, { gatewayBase: 'https://api.example.org' }), []);
  assert.deepEqual(
    sttCandidates({ ...local, mode: 'server' }, { gatewayBase: 'https://api.example.org' }),
    ['gateway']
  );
  assert.deepEqual(
    sttCandidates(
      { ...local, openaiUrl: 'http://192.168.1.9:1234/v1' },
      { gatewayBase: 'https://api.example.org' }
    ),
    ['openai']
  );
  assert.deepEqual(
    sttCandidates(
      { ...local, browser: { ...DEFAULT_SETTINGS.browser, enabled: true } },
      { browserSupported: true }
    ),
    ['browser']
  );
  assert.match(voiceUnavailableMessage({ ...local, mode: 'offline' }, {}), /offline coach/i);
});

test('a model is only allowed for documented languages unless opted in', () => {
  assert.equal(languageSupport('qwen2.5:1.5b', 'es', false), 'ok');
  assert.equal(languageSupport('qwen2.5:1.5b', 'ja', false), 'ok');
  // Bengali is not in Qwen2.5's documented table.
  assert.equal(languageSupport('qwen2.5:1.5b', 'bn', false), 'unverified');
  assert.equal(languageSupport('qwen2.5:1.5b', 'bn', true), 'ok');
  // Whisper documents every atlas language.
  for (const id of ['es', 'sw', 'bn', 'ar', 'th', 'he']) {
    assert.equal(languageSupport('whisper-large-v3-turbo', id, false), 'ok', id);
  }
  // A model the catalogue does not know cannot be verified either.
  assert.equal(languageSupport('my-finetune:latest', 'es', false), 'unverified');
  assert.equal(languageSupport('my-finetune:latest', 'es', true), 'ok');
});

test('the catalogue is internally consistent', () => {
  assert.ok(MODELS.length >= 10);
  const ids = new Set<string>();
  for (const model of MODELS) {
    assert.ok(model.id.length > 0);
    assert.ok(!ids.has(model.id), `duplicate model id ${model.id}`);
    ids.add(model.id);
    assert.ok(model.label.length > 0);
    assert.ok(model.license.name.length > 0);
    assert.ok(['yes', 'check', 'no'].includes(model.license.commercial));
    assert.ok(model.roles.length >= 0);
  }
  assert.ok(modelsFor('chat').length >= 4);
  assert.ok(runnableModelsFor('tts').some((model) => model.id === 'device'));
  assert.equal(findModel('does-not-exist'), null);
});

test('coverage summaries only count documented languages', () => {
  const qwen = coverageSummary('qwen2.5:1.5b');
  assert.equal(qwen.total, 24);
  assert.ok(qwen.documented.includes('es'));
  assert.ok(qwen.documented.includes('zh'));
  assert.ok(!qwen.documented.includes('bn'));
  assert.equal(qwen.pct, qwen.documented.length / 24);

  const whisper = coverageSummary('whisper-large-v3-turbo');
  assert.equal(whisper.documented.length, 24);
  assert.equal(whisper.pct, 1);

  assert.equal(coverageFor('whisper-large-v3-turbo', 'bn'), 'documented');
  assert.equal(coverageFor('qwen2.5:1.5b', 'bn'), 'unverified');
  assert.equal(coverageFor('unknown-model', 'es'), 'unverified');
});

test('non-commercial weights are labelled as such', () => {
  assert.equal(findModel('aya-expanse:8b')?.license.commercial, 'no');
  assert.equal(findModel('qwen2.5:3b')?.license.commercial, 'no');
  assert.equal(findModel('qwen2.5:1.5b')?.license.commercial, 'yes');
});
