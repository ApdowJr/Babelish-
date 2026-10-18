/**
 * Turns the learner's profile into system-prompt lines so the AI tutor
 * uses their real life as example material. Pure and testable; ai.ts
 * splices the result into the native-speaker prompt.
 */

export type ProfileContext = {
  job?: string;
  interests?: string[];
  goals?: string[];
  nativeLanguageName?: string;
};

const MAX_LIST = 3;

function cleanList(items: string[] | undefined): string {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, MAX_LIST)
    .join(', ');
}

export function formatProfileContext(profile: ProfileContext | undefined): string[] {
  if (!profile) return [];
  const lines: string[] = [];

  const job = profile.job?.trim();
  if (job) {
    // Phrased neutrally so both "nurse" and "a nurse" read correctly.
    lines.push(
      `The learner's occupation or studies: ${job}. When natural, invent examples and small talk from that world.`
    );
  }

  const interests = cleanList(profile.interests);
  if (interests) {
    lines.push(`They are into: ${interests}. Use these as conversation topics and example sentences.`);
  }

  const goals = cleanList(profile.goals);
  if (goals) {
    lines.push(
      `Their goals for learning: ${goals}. Lean practice vocabulary toward those situations.`
    );
  }

  const native = profile.nativeLanguageName?.trim();
  if (native) {
    lines.push(
      `They speak ${native} natively — a one-line contrast with ${native} can help when something is genuinely confusing, but your replies stay in the target language.`
    );
  }

  return lines;
}
