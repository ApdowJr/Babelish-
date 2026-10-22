/**
 * The offline coach is the promise that Babelish stays useful with no model
 * and no network. It must answer for every atlas language and say plainly
 * that it is not a language model.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '../src/data/languages';
import { offlineCardCount, offlineTutorReply } from '../src/lib/models/offlineTutor';

test('every language gets a real offline card, never an empty reply', () => {
  for (const language of LANGUAGES) {
    const reply = offlineTutorReply({ languageId: language.id, turn: 0 });
    assert.ok(reply.text.trim().length > 0, `${language.id}: text`);
    assert.ok(reply.translation.trim().length > 0, `${language.id}: translation`);
    assert.ok(reply.tip.includes('Offline coach'), `${language.id}: labelled`);
    assert.ok(reply.total > 0, `${language.id}: cards expected`);
    assert.equal(offlineCardCount(language.id), reply.total, `${language.id}: count`);
  }
});

test('starter packs cycle through all 22 words without repeating early', () => {
  const seen = new Set<string>();
  for (let turn = 0; turn < 22; turn += 1) {
    const reply = offlineTutorReply({ languageId: 'es', turn });
    assert.equal(reply.source, 'starter');
    seen.add(reply.text);
  }
  assert.equal(seen.size, 22);
  // Turn 22 wraps around deterministically.
  assert.equal(
    offlineTutorReply({ languageId: 'es', turn: 22 }).text,
    offlineTutorReply({ languageId: 'es', turn: 0 }).text
  );
});

test('curated scenario phrases are used when the scenario has them', () => {
  const reply = offlineTutorReply({ languageId: 'es', scenarioId: 'cafe', turn: 0 });
  assert.equal(reply.source, 'scenario');
  assert.ok(reply.total >= 2);
  assert.match(reply.translation, /café|cuenta|cuanto|cuánto/i);

  const fallback = offlineTutorReply({ languageId: 'es', scenarioId: 'not-a-scenario', turn: 0 });
  assert.equal(fallback.source, 'scenario');
  assert.ok(fallback.total > 0);
});

test('non-Latin cards keep the target script and add a romanisation tip', () => {
  const reply = offlineTutorReply({ languageId: 'ja', turn: 0 });
  assert.match(reply.text, /[\u3040-\u30FF\u4E00-\u9FFF]/);
  assert.ok(reply.tip.length > 0);
});
