/**
 * Startup configuration validation.
 *
 * Answers, in one place, "what is actually live right now?" — auth provider,
 * tutor transport, voice input — without ever printing a secret value. Used
 * for:
 *   - a once-per-launch `console.warn` listing anything unavailable, with the
 *     exact variable *names* needed to fix it (Phase B: actionable errors);
 *   - the Profile → APP STATUS rows (honest labels, never fake "Connected").
 */
import { isNeonConfigured, NEON_AUTH_URL } from '@/lib/neon';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getModelSettings } from '@/lib/models/settings';
import { MODE_LABEL } from '@/lib/models/config';

export type ServiceState =
  | { service: 'auth'; mode: 'neon' | 'supabase' | 'demo'; label: string }
  | { service: 'tutor'; mode: 'local' | 'server' | 'browser' | 'offline'; label: string }
  | { service: 'speech-output'; mode: 'device'; label: string };

export function configurationReport(): ServiceState[] {
  const auth: ServiceState = isNeonConfigured
    ? { service: 'auth', mode: 'neon', label: `Neon Auth (${hostOf(NEON_AUTH_URL)})` }
    : isSupabaseConfigured
      ? { service: 'auth', mode: 'supabase', label: 'Supabase' }
      : { service: 'auth', mode: 'demo', label: 'On-device demo accounts' };

  const settings = getModelSettings();
  const tutor: ServiceState =
    settings.mode === 'browser' && settings.browser.enabled
      ? { service: 'tutor', mode: 'browser', label: 'Browser model (on-device)' }
      : settings.mode === 'server'
        ? { service: 'tutor', mode: 'server', label: 'App inference server' }
        : settings.mode === 'offline'
          ? { service: 'tutor', mode: 'offline', label: 'Offline coach (bundled content)' }
          : {
              service: 'tutor',
              mode: 'local',
              label: `Local models · ${MODE_LABEL[settings.mode]}`,
            };

  return [
    auth,
    tutor,
    { service: 'speech-output', mode: 'device', label: 'Device voices' },
  ];
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'configured';
  }
}

/**
 * One-shot, secret-free warnings for anything that will fall back at runtime.
 * Called once from the root layout so the console explains the state instead
 * of the UI silently degrading.
 */
let warned = false;
export function validateConfigurationAtStartup(): string[] {
  if (warned) return [];
  warned = true;
  const warnings: string[] = [];
  if (!isNeonConfigured) {
    warnings.push(
      'Neon backend disabled (EXPO_PUBLIC_NEON_DISABLED=1) — accounts are on-device demo only.'
    );
  }
  const settings = getModelSettings();
  // The tutor is server-hosted; the Speak/Profile probes report whether it
  // actually answered. Startup only flags a configuration that cannot work.
  if (settings.mode === 'offline') {
    warnings.push('Tutor mode is set to the offline coach — no server will be contacted.');
  } else if (settings.mode === 'browser' && !settings.browser.enabled) {
    warnings.push(
      'Browser mode is selected but browser inference is off — the tutor falls back to the coach.'
    );
  }
  if (!isSupabaseConfigured && !isNeonConfigured) {
    warnings.push('No auth provider configured — sign-up is local to this device.');
  }
  for (const w of warnings) console.warn(`[babelish/config] ${w}`);
  return warnings;
}
