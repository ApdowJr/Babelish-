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

export const ZELVOCA_EXPORT_VERSION = 1;

/** Every on-device data key. Auth session keys are excluded on purpose —
 * signing out (or account deletion) removes those through the auth layer. */
export const LOCAL_DATA_KEYS = [
  'zelvoca:preferences',
  'zelvoca:profile',
  'zelvoca:analytics',
  'zelvoca:subscription',
  'zelvoca:speaking-stats',
  'zelvoca:report-queue',
  'zelvoca:progress:v1',
  'zelvoca:vocab:v1',
] as const;

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
      format: ZELVOCA_EXPORT_VERSION,
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
