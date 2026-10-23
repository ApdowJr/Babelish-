/**
 * Pure AI gateway resolution — shared by `src/lib/ai.ts`, `SpeakScreen` and
 * `SettingsScreen` so no caller can accidentally drop the learner's JWT when
 * `EXPO_PUBLIC_AI_GATEWAY_URL` is left unset (the documented default).
 */

export type ResolvedAiGateway = {
  apiBase: string;
  jwt: string | null;
  apiKey?: string | null;
};

/** Normalises a configured gateway URL, falling back to the Supabase Edge Function. */
export function resolveGatewayBase(
  explicitBase?: string | null,
  envGatewayUrl?: string | null,
  supabaseFunctionsUrl?: string | null
): string {
  const fromCaller = (explicitBase ?? '').trim().replace(/\/+$/, '');
  if (fromCaller) return fromCaller;

  const fromEnv = (envGatewayUrl ?? '').trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;

  const fnBase = (supabaseFunctionsUrl ?? '').trim().replace(/\/+$/, '');
  return fnBase ? `${fnBase}/babelish-ai` : '';
}

/**
 * Builds the transport object for `fetchAiStatus`, `tutorReply`, and
 * `transcribeSpeech`. Preserves `jwt` whenever a gateway URL is available.
 */
export function buildAiGatewayTransport(input: {
  jwt?: string | null;
  explicitBase?: string | null;
  envGatewayUrl?: string | null;
  supabaseFunctionsUrl?: string | null;
  supabasePublishableKey?: string | null;
}): ResolvedAiGateway | null {
  const apiBase = resolveGatewayBase(
    input.explicitBase,
    input.envGatewayUrl,
    input.supabaseFunctionsUrl
  );
  if (!apiBase) return null;

  const isSupabaseEdge = Boolean(
    input.supabaseFunctionsUrl &&
      apiBase.startsWith(input.supabaseFunctionsUrl.trim().replace(/\/+$/, ''))
  );
  const cleanKey = (input.supabasePublishableKey ?? '').trim();
  const apiKey =
    isSupabaseEdge && cleanKey && !cleanKey.includes('your-') && !cleanKey.includes('replace_with')
      ? cleanKey
      : null;

  return {
    apiBase,
    jwt: input.jwt ?? null,
    ...(apiKey ? { apiKey } : {}),
  };
}
