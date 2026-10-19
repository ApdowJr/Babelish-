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
import { isAIConfigured } from '@/lib/ai';
import { isSupabaseConfigured } from '@/lib/supabase';

export type ServiceState =
  | { service: 'auth'; mode: 'neon' | 'supabase' | 'demo'; label: string }
  | { service: 'tutor'; mode: 'live' | 'demo'; label: string }
  | { service: 'speech-output'; mode: 'device'; label: string };

export function configurationReport(): ServiceState[] {
  const auth: ServiceState = isNeonConfigured
    ? { service: 'auth', mode: 'neon', label: `Neon Auth (${hostOf(NEON_AUTH_URL)})` }
    : isSupabaseConfigured
      ? { service: 'auth', mode: 'supabase', label: 'Supabase' }
      : { service: 'auth', mode: 'demo', label: 'On-device demo accounts' };

  const tutor: ServiceState = isAIConfigured
    ? { service: 'tutor', mode: 'live', label: 'AI connected' }
    : { service: 'tutor', mode: 'demo', label: 'Demo tutor (scripted lines)' };

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
  if (!isAIConfigured) {
    warnings.push(
      'AI tutor not configured — set EXPO_PUBLIC_AI_API_URL + EXPO_PUBLIC_AI_API_KEY (dev) or ' +
        'AI_API_KEY on the api Function (production proxy). Scripted demo lines are used, labeled as demo.'
    );
  }
  if (!isSupabaseConfigured && !isNeonConfigured) {
    warnings.push('No auth provider configured — sign-up is local to this device.');
  }
  for (const w of warnings) console.warn(`[zelvoca/config] ${w}`);
  return warnings;
}
