/**
 * Voice input — recording via expo-audio (in Expo Go) + transcription through
 * the OpenAI-compatible endpoint in ai.ts.
 *
 * One recorder instance per screen; `recordingFor` says what the recording is
 * for (a chat turn or a specific practice phrase) so the stop handler knows
 * where to send the transcript.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { createRecorderControl } from '@/lib/recorderControl';

/** Safety cap — the UI stops recording well before this. */
const MAX_RECORD_SECONDS = 30;

/**
 * Asks for microphone access and puts the audio session into recording mode.
 * Returns false when permission is denied.
 */
export async function ensureRecordingReady(): Promise<boolean> {
  const permission = await AudioModule.requestRecordingPermissionsAsync();
  if (!permission.granted) return false;
  await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
  return true;
}

/**
 * One recorder per screen, with all start/stop race handling in
 * `recorderControl` — a pure module unit-tested against a fake recorder, so
 * the stop-during-prepare, stale-poll and double-stop paths are proven on
 * every platform's behalf (see that module for why each rule exists).
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const control = useMemo(() => createRecorderControl(recorder), [recorder]);
  const [isBusy, setIsBusy] = useState(false);

  // Screen went away mid-recording: release the mic once start settles.
  useEffect(() => {
    return () => {
      void control.dispose().catch(() => undefined);
    };
  }, [control]);

  const start = useCallback(async () => {
    setIsBusy(true);
    try {
      await control.start(MAX_RECORD_SECONDS);
    } finally {
      setIsBusy(false);
    }
  }, [control]);

  /** Stops (if recording) and returns the audio URI, or null if there's none. */
  const stop = useCallback(async (): Promise<string | null> => {
    setIsBusy(true);
    try {
      return await control.stop();
    } finally {
      setIsBusy(false);
    }
  }, [control]);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    isBusy,
    start,
    stop,
  };
}
