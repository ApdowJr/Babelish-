/**
 * Offline packs — what actually works without a network. Babelish's curriculum
 * ships inside the bundle, so every language pack is installed from first
 * launch; this module gives that fact a testable shape (sizes, copy).
 */

export type OfflinePack = {
  languageId: string;
  /** Always true: content is bundled, nothing to download, nothing to rent. */
  installed: boolean;
  chapters: number;
  exercises: number;
  phrases: number;
  /** Deterministic size estimate used for the packs UI. */
  kb: number;
};

/**
 * Deterministic size model (bundle-derived content is tiny — that's the
 * point of bundling): chapters dominate, exercises add a little, phrase
 * cards are per-item.
 */
export function estimatePackKb(input: {
  chapters: number;
  exercises: number;
  phrases: number;
}): number {
  return Math.max(
    1,
    Math.round(input.chapters * 180 + input.exercises * 6 + input.phrases * 1.5)
  );
}

export function buildPack(input: {
  languageId: string;
  chapters: number;
  exercises: number;
  phrases: number;
}): OfflinePack {
  return {
    languageId: input.languageId,
    installed: true,
    chapters: input.chapters,
    exercises: input.exercises,
    phrases: input.phrases,
    kb: estimatePackKb(input),
  };
}

export function formatPackSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${kb} KB`;
}

/** Honest capability copy — online-only features are named, not hidden. */
export const OFFLINE_CAPABILITIES = {
  lessons: 'Lessons, phrasebook & tutor chat style practice: available offline',
  tts: 'Voice playback: works offline (on-device speech)',
  stt: 'Voice input: needs internet (cloud transcription)',
  sync: 'Progress syncs automatically when you are back online',
} as const;

export function offlineSummary(packs: OfflinePack[]): { languages: number; installed: number; totalKb: number } {
  return {
    languages: packs.length,
    installed: packs.filter((p) => p.installed).length,
    totalKb: packs.reduce((sum, p) => sum + p.kb, 0),
  };
}
