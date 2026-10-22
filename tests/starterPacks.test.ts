/**
 * Contract tests for the 2.0 atlas: every advertised language must ship a
 * complete, playable starter pack. These guard the "every language is free"
 * promise against a flag being added without content.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LANGUAGES,
  LANGUAGE_COUNT,
  getLanguage,
  searchLanguages,
} from '../src/data/languages';
import { STARTERS, starterWords } from '../src/data/starters';

test('the atlas has 24 unique, well-formed languages', () => {
  assert.equal(LANGUAGE_COUNT, 25);
  assert.equal(new Set(LANGUAGES.map((language) => language.id)).size, LANGUAGES.length);
  for (const language of LANGUAGES) {
    assert.ok(language.name.length > 0, `${language.id}: name`);
    assert.ok(language.nativeName.length > 0, `${language.id}: nativeName`);
    assert.match(language.ttsLocale, /^[a-z]{2}-[A-Z]{2}$/, `${language.id}: tts locale`);
    assert.ok(language.dialects.length >= 1, `${language.id}: dialects`);
    assert.ok(language.greeting.text.length > 0, `${language.id}: greeting`);
    assert.ok(language.scenarios.length >= 3, `${language.id}: scenarios`);
    assert.ok([1, 2, 3].includes(language.difficulty), `${language.id}: difficulty`);
  }
});

test('every language ships 12 essentials + numbers 1–10, with no duplicates', () => {
  for (const language of LANGUAGES) {
    const pack = STARTERS[language.id];
    assert.ok(pack, `${language.id}: missing starter pack`);
    assert.equal(pack.essentials.length, 12, `${language.id}: essentials`);
    assert.equal(pack.numbers.length, 10, `${language.id}: numbers`);

    const targets = new Set(pack.essentials.concat(pack.numbers).map((word) => word.target));
    assert.equal(
      targets.size,
      pack.essentials.length + pack.numbers.length,
      `${language.id}: duplicate target words`
    );
    const english = new Set(pack.essentials.map((word) => word.english));
    assert.equal(english.size, pack.essentials.length, `${language.id}: duplicate meanings`);

    assert.deepEqual(
      pack.numbers.map((word) => word.english),
      ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'],
      `${language.id}: numbers must be 1–10 in order`
    );
    for (const word of pack.essentials.concat(pack.numbers)) {
      assert.ok(word.target.trim().length > 0, `${language.id}: empty target`);
      assert.ok(word.english.trim().length > 0, `${language.id}: empty meaning`);
    }
  }
});

test('non-Latin scripts carry a transliteration so beginners can read them', () => {
  const nonLatin = LANGUAGES.filter(
    (language) => !/latin/i.test(language.script) && !language.script.startsWith('Latin')
  );
  assert.ok(nonLatin.length >= 8);
  for (const language of nonLatin) {
    const words = starterWords(language.id).map(({ word }) => word);
    assert.ok(
      words.every((word) => Boolean(word.roman && word.roman.trim())),
      `${language.id}: every starter word needs a romanization`
    );
  }
});

test('starterWords returns essentials first, then numbers', () => {
  const words = starterWords('es');
  assert.equal(words.length, 22);
  assert.equal(words[0].category, 'essentials');
  assert.equal(words[0].word.target, 'hola');
  assert.equal(words[21].category, 'numbers');
  assert.equal(words[21].word.english, 'ten');
});

test('search finds native names, scripts and regions', () => {
  assert.ok(searchLanguages('日本語').some((language) => language.id === 'ja'));
  assert.ok(searchLanguages('arabic').some((language) => language.id === 'ar'));
  assert.ok(searchLanguages('somali').some((language) => language.id === 'so'));
  assert.ok(searchLanguages('Soomaali').some((language) => language.id === 'so'));
  assert.ok(searchLanguages('hangul').some((language) => language.id === 'ko'));
  assert.ok(searchLanguages('', 'africa').every((language) => language.regions.includes('africa')));
  assert.ok(searchLanguages('', 'africa').some((language) => language.id === 'sw'));
  assert.ok(searchLanguages('', 'africa').some((language) => language.id === 'so'));
  assert.equal(searchLanguages('definitely-not-a-language').length, 0);
});

test('unknown ids fall back to the first language (as the app expects)', () => {
  assert.equal(getLanguage('xx-unknown').id, 'es');
});

test('language scripts include the marker the AI guardrail looks for', () => {
  // scriptMatches() reads these substrings; a mismatch silently disables the
  // "reply in the target script" guard for that language.
  const markers: Record<string, string> = {
    ar: 'Arabic',
    fa: 'Arabic',
    he: 'Hebrew',
    hi: 'देवनागरी',
    bn: 'বাংলা',
    zh: '中文',
    ja: 'ひらがな',
    ko: 'Hangul',
    th: 'Thai',
    el: 'Greek',
    ru: 'Cyrillic',
    uk: 'Cyrillic',
  };
  for (const [id, marker] of Object.entries(markers)) {
    assert.ok(
      getLanguage(id).script.includes(marker),
      `${id}: script must include "${marker}"`
    );
  }
});
