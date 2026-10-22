/**
 * Offline coach — what the tutor does with no model at all.
 *
 * This is *not* fake AI. It is a deterministic phrase coach built from the
 * content the learner already has: curated scenario phrases when they exist,
 * otherwise the language's starter pack. Every reply says so in its tip line,
 * and the UI labels the source "Offline coach" so a learner is never misled
 * into thinking a model answered.
 *
 * It also powers the app's lowest-bandwidth mode: text-only, no downloads,
 * no network, works on any phone.
 */
import { getLanguage } from '../../data/languages';
import { getPracticePhrases } from '../../data/practice';
import { starterWords } from '../../data/starters';

export type OfflineReply = {
  text: string;
  translation: string;
  tip: string;
  /** Which bundled source the card came from (for the UI badge). */
  source: 'scenario' | 'starter';
  index: number;
  total: number;
};

type Card = { target: string; english: string; roman?: string };

function cardsFor(languageId: string, scenarioId?: string | null): { cards: Card[]; source: OfflineReply['source'] } {
  if (scenarioId) {
    const phrases = getPracticePhrases(languageId, scenarioId);
    if (phrases.length > 0) {
      return {
        cards: phrases.map((phrase) => ({ target: phrase.target, english: phrase.translation })),
        source: 'scenario',
      };
    }
  }
  const words = starterWords(languageId);
  if (words.length === 0) return { cards: [], source: 'starter' };
  return {
    cards: words.map(({ word }) => ({
      target: word.target,
      english: word.english,
      roman: word.roman,
    })),
    source: 'starter',
  };
}

export function offlineCardCount(languageId: string, scenarioId?: string | null): number {
  return cardsFor(languageId, scenarioId).cards.length;
}

/**
 * Builds the next offline tutor turn. `turn` is the number of previous
 * assistant messages, so cards advance through the pack without repeats.
 */
export function offlineTutorReply(input: {
  languageId: string;
  scenarioId?: string | null;
  turn: number;
}): OfflineReply {
  const language = getLanguage(input.languageId);
  const { cards, source } = cardsFor(input.languageId, input.scenarioId);

  if (cards.length === 0) {
    // No bundled content for this language (should not happen — a test guards
    // the atlas). Say so instead of inventing a phrase.
    return {
      text: language.greeting.text,
      translation: `${language.greeting.meaning} (${language.name})`,
      tip: 'Offline coach — no model is running and this language has no bundled cards yet.',
      source: 'starter',
      index: 0,
      total: 0,
    };
  }

  const index = Math.max(0, input.turn) % cards.length;
  const card = cards[index];
  const label = source === 'scenario' ? 'your scenario' : 'your starter pack';
  const base = `Offline coach — card ${index + 1} of ${cards.length} from ${label}.`;
  const tip = card.roman
    ? `${base} Say it as “${card.roman}”. No language model is running, so I can’t correct or explain yet.`
    : `${base} The tutor server isn’t available, so I can only show bundled phrases right now — no corrections or explanations.`;

  return {
    text: card.target,
    translation: card.english,
    tip,
    source,
    index,
    total: cards.length,
  };
}

/** Honest one-liner for the Speak screen's status pill. */
export const OFFLINE_COACH_NOTE =
  'Coach mode: bundled phrases only — the tutor server is not answering. Lessons, reviews and the phrasebook still work.';
