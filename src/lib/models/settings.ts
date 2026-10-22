/**
 * Model settings store.
 *
 * A tiny external store (no provider needed) so the Speak screen, Profile and
 * Settings always read the same values. Persisted on-device — a model URL is
 * device-specific and never syncs to the cloud.
 */
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, normalizeSettings, type ModelSettings } from './config';

const STORAGE_KEY = 'babelish:model-settings:v1';

let current: ModelSettings = DEFAULT_SETTINGS;
let ready = false;
let loading: Promise<ModelSettings> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function getModelSettings(): ModelSettings {
  return current;
}

export function areModelSettingsReady(): boolean {
  return ready;
}

export async function loadModelSettings(): Promise<ModelSettings> {
  if (ready) return current;
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      current = normalizeSettings(raw ? JSON.parse(raw) : null);
    } catch {
      current = normalizeSettings(null);
    } finally {
      ready = true;
      loading = null;
      emit();
    }
    return current;
  })();
  return loading;
}

export async function saveModelSettings(patch: Partial<ModelSettings>): Promise<ModelSettings> {
  current = normalizeSettings({ ...current, ...patch });
  ready = true;
  emit();
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // The in-memory value still applies for this session.
  }
  return current;
}

export async function resetModelSettings(): Promise<ModelSettings> {
  current = normalizeSettings(null);
  ready = true;
  emit();
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return current;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook — re-renders whenever settings change anywhere in the app. */
export function useModelSettings(): { settings: ModelSettings; ready: boolean } {
  const settings = useSyncExternalStore(subscribe, getModelSettings, getModelSettings);
  return { settings, ready };
}
