/**
 * Privacy tooling — data export builder + the exact list of on-device keys.
 * Pure and dependency-free (node-testable); the AsyncStorage wipe and the
 * Share sheet live in the screens that offer them.
 *
 * Babelish's privacy stance (docs/PRIVACY.md):
 *  - practice events, XP, streaks and profile live ON THIS DEVICE;
 *  - cloud sync covers progress + vocabulary only, under the learner's own
 *    Neon account — never ads, never third-party trackers;
 *  - microphone audio is transcribed (when cloud STT is configured) and then
 *    discarded — it is never stored by Babelish.
 */

export const EXPORT_VERSION = 1;

/**
 * Every on-device data key under the current `babelish:*` prefix. Auth session
 * keys are excluded on purpose — signing out (or account deletion) removes
 * those through the auth layer.
 */
export const LOCAL_DATA_KEYS = [
  'babelish:preferences',
  'babelish:profile',
  'babelish:analytics',
  'babelish:subscription',
  'babelish:speaking-stats',
  'babelish:report-queue',
  'babelish:progress:v1',
  'babelish:vocab:v1',
] as const;

/**
 * The same data under the pre-rename `nativa:*` prefix.
 *
 * Kept in the wipe set deliberately: src/lib/storageMigration.ts carries these
 * values over on first launch and then deletes the originals, but a learner may
 * exercise their right to erase before that ever runs — or the migration may
 * have failed on their device and left the originals in place. Erasing a key
 * that no longer exists is a harmless no-op, so listing both is strictly safer
 * than assuming the migration succeeded.
 */
export const LEGACY_LOCAL_DATA_KEYS = [
  'nativa:preferences',
  'nativa:profile',
  'nativa:analytics',
  'nativa:subscription',
  'nativa:speaking-stats',
  'nativa:report-queue',
  'nativa:progress:v1',
  'nativa:vocab:v1',
] as const;

/** What an erase must actually remove: current keys plus any un-migrated legacy copy. */
export const ALL_LOCAL_DATA_KEYS = [...LOCAL_DATA_KEYS, ...LEGACY_LOCAL_DATA_KEYS] as const;

export type DataExportInput = {
  profile: unknown;
  preferences: unknown;
  progress: unknown;
  vocab: unknown;
  analytics: unknown;
};

/**
 * Machine-readable export for GDPR/Play data-portability: everything the app
 * knows about the learner, with metadata stating what is NOT included.
 */
export function buildDataExport(input: DataExportInput, now = new Date()): string {
  return JSON.stringify(
    {
      app: 'Babelish',
      format: EXPORT_VERSION,
      exportedAt: now.toISOString(),
      includesAudio: false,
      includesAdIdentifiers: false,
      note: 'Practice events stay on your device. Microphone audio is transcribed on demand and never stored.',
      data: {
        profile: input.profile ?? null,
        preferences: input.preferences ?? null,
        progress: input.progress ?? null,
        vocab: input.vocab ?? null,
        analytics: input.analytics ?? null,
      },
    },
    null,
    2
  );
}
