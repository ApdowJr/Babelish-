/**
 * Pronunciation scoring — pure, dependency-free, script-aware.
 *
 * Compares a learner's utterance (speech transcript or typed practice) against
 * a target phrase and returns a score plus per-word verdicts the UI can color:
 *   exact  — normalized match (accents, case, punctuation, Arabic tashkeel and
 *            spacing never block you)
 *   close  — an honest try: small edit distance on a real-length word
 *   missed  — off target (or an extra word the learner added)
 *
 * Non-spacing scripts (Chinese, Japanese) are scored character by character.
 */

export type TokenKind = 'exact' | 'close' | 'missed';

export type ScoredToken = { text: string; kind: TokenKind };

export type PronunciationScore = {
  /** 0–100. Exact = 1.0, close = 0.6; misses and extras both pull it down. */
  percent: number;
  /** Target words with their verdicts, in order — ready for word chips. */
  tokens: ScoredToken[];
  /** Words the learner added beyond the target. */
  extras: string[];
};

/** Arabic vowel marks + other combining marks that don't change the word. */
const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const LATIN_COMBINING = /[\u0300-\u036f]/g;

/** Lowercase, strip accents/marks/punctuation, collapse whitespace. */
export function normalizeForSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(ARABIC_DIACRITICS, '')
    .normalize('NFD')
    .replace(LATIN_COMBINING, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into scorable tokens. `charBased` is for scripts without word
 * separators (中文, ひらがな…): every character is its own token.
 */
export function tokenizeForSpeech(text: string, opts: { charBased?: boolean } = {}): string[] {
  const norm = normalizeForSpeech(text);
  if (!norm) return [];
  if (opts.charBased) return Array.from(norm).filter((ch) => ch !== ' ');
  return norm.split(' ');
}

/** Classic Levenshtein distance between two short strings. */
export function charDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

/**
 * Word-level alignment (Levenshtein over token arrays) of the learner's
 * utterance against the target phrase.
 */
export function scorePronunciation(
  attempt: string,
  target: string,
  opts: { charBased?: boolean } = {}
): PronunciationScore {
  const a = tokenizeForSpeech(attempt, opts);
  const t = tokenizeForSpeech(target, opts);

  if (t.length === 0) return { percent: 0, tokens: [], extras: [] };
  if (a.length === 0) {
    return {
      percent: 0,
      tokens: t.map((text) => ({ text, kind: 'missed' as TokenKind })),
      extras: [],
    };
  }

  // DP over (attempt index i, target index j) with backpointers.
  const dist: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(t.length + 1).fill(0)
  );
  const back: ('diag' | 'up' | 'left')[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<'diag' | 'up' | 'left'>(t.length + 1).fill('diag')
  );
  for (let i = 1; i <= a.length; i += 1) {
    dist[i][0] = i;
    back[i][0] = 'up';
  }
  for (let j = 1; j <= t.length; j += 1) {
    dist[0][j] = j;
    back[0][j] = 'left';
  }
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const subCost = a[i - 1] === t[j - 1] ? 0 : 1;
      const options = [
        { cost: dist[i - 1][j - 1] + subCost, from: 'diag' as const },
        { cost: dist[i - 1][j] + 1, from: 'up' as const }, // extra learner word
        { cost: dist[i][j - 1] + 1, from: 'left' as const }, // missed target word
      ];
      let best = options[0];
      for (const option of options) if (option.cost < best.cost) best = option;
      dist[i][j] = best.cost;
      back[i][j] = best.from;
    }
  }

  const tokens: ScoredToken[] = [];
  const extras: string[] = [];
  let i = a.length;
  let j = t.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && back[i][j] === 'diag') {
      const attemptWord = a[i - 1];
      const targetWord = t[j - 1];
      if (attemptWord === targetWord) {
        tokens.push({ text: targetWord, kind: 'exact' });
      } else if (!opts.charBased && isCloseTry(attemptWord, targetWord)) {
        tokens.push({ text: targetWord, kind: 'close' });
      } else {
        tokens.push({ text: targetWord, kind: 'missed' });
      }
      i -= 1;
      j -= 1;
    } else if (i > 0 && (j === 0 || back[i][j] === 'up')) {
      extras.unshift(a[i - 1]);
      i -= 1;
    } else {
      tokens.push({ text: t[j - 1], kind: 'missed' });
      j -= 1;
    }
  }
  tokens.reverse();

  const points = tokens.reduce(
    (sum, token) => sum + (token.kind === 'exact' ? 1 : token.kind === 'close' ? 0.6 : 0),
    0
  );
  const denominator = Math.max(t.length, a.length);
  const percent = Math.round((points / denominator) * 100);

  return { percent, tokens, extras };
}

/** A close try: same-ish word (e.g. "kiero" for "quiero"), not a random one. */
function isCloseTry(attemptWord: string, targetWord: string): boolean {
  if (Math.abs(attemptWord.length - targetWord.length) > 1) return false;
  const tolerance = Math.max(1, Math.floor(targetWord.length * 0.35));
  return charDistance(attemptWord, targetWord) <= tolerance;
}

/** Score band used for coloring the big percentage. */
export function scoreBand(percent: number): 'success' | 'warning' | 'danger' {
  if (percent >= 80) return 'success';
  if (percent >= 50) return 'warning';
  return 'danger';
}
