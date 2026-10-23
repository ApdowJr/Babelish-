/**
 * Startup configuration validation.
 *
 * Reports configured auth and tutor services without logging secret values.
 */
import { isSupabaseConfigured } from '@/lib/supabase';
import { getModelSettings } from '@/lib/models/settings';
import { MODE_LABEL } from '@/lib/models/config';

export type ServiceState =
  | { service: 'auth'; mode: 'supabase' | 'demo'; label: string }
  | { service: 'tutor'; mode: 'local' | 'server' | 'browser' | 'offline'; label: string }
  | { service: 'speech-output'; mode: 'device'; label: string };

export function configurationReport(): ServiceState[] {
  const auth: ServiceState = isSupabaseConfigured
    ? { service: 'auth', mode: 'supabase', label: 'Supabase Auth' }
    : { service: 'auth', mode: 'demo', label: 'On-device demo accounts' };

  const settings = getModelSettings();
  const tutor: ServiceState =
    settings.mode === 'browser' && settings.browser.enabled
      ? { service: 'tutor', mode: 'browser', label: 'Browser model (on-device)' }
      : settings.mode === 'server'
        ? { service: 'tutor', mode: 'server', label: 'App inference server' }
        : settings.mode === 'offline'
          ? { service: 'tutor', mode: 'offline', label: 'Coach mode (bundled content)' }
          : { service: 'tutor', mode: 'local', label: `Local models · ${MODE_LABEL[settings.mode]}` };

  return [auth, tutor, { service: 'speech-output', mode: 'device', label: 'Device voices' }];
}

let warned = false;
export function validateConfigurationAtStartup(): string[] {
  if (warned) return [];
  warned = true;
  const warnings: string[] = [];
  if (!isSupabaseConfigured) {
    warnings.push('Supabase credentials are missing — auth is using on-device demo accounts.');
  }
  const settings = getModelSettings();
  if (settings.mode === 'offline') {
    warnings.push('Tutor mode is set to the offline coach — no server will be contacted.');
  } else if (settings.mode === 'browser' && !settings.browser.enabled) {
    warnings.push('Browser mode is selected but browser inference is off — the tutor falls back to the coach.');
  }
  for (const warning of warnings) console.warn(`[babelish/config] ${warning}`);
  return warnings;
}
