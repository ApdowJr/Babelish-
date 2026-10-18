/**
 * Voice input — recording via expo-audio (in Expo Go) + transcription through
 * the OpenAI-compatible endpoint in ai.ts.
 *
 * One recorder instance per screen; `recordingFor` says what the recording is
 * for (a chat turn or a specific practice phrase) so the stop handler knows
 * where to send the transcript.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

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

export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder);
  const [isBusy, setIsBusy] = useState(false);

  // Stop if the screen goes away mid-recording.
  useEffect(() => {
    return () => {
      if (state.isRecording) recorder.stop().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setIsBusy(true);
    try {
      await recorder.prepareToRecordAsync();
      recorder.recordForDuration(MAX_RECORD_SECONDS);
    } finally {
      setIsBusy(false);
    }
  }, [recorder]);

  /** Stops (if recording) and returns the audio URI, or null if there's none. */
  const stop = useCallback(async (): Promise<string | null> => {
    setIsBusy(true);
    try {
      if (state.isRecording) await recorder.stop();
      return recorder.uri ?? null;
    } finally {
      setIsBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder]);

  return {
    isRecording: state.isRecording,
    durationMs: state.durationMillis,
    isBusy,
    start,
    stop,
  };
}
