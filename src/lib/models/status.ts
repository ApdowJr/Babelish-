/**
 * Capability probe → the app's honest status object.
 *
 * The UI should be able to say three different things with no ambiguity:
 *   "Live — Ollama on this device" / "Live — app server" / "Offline coach".
 */
import { probeEngines, type EngineProbe } from './chat';
import type { EngineContext, ModelSettings } from './config';
import type { RuntimeId } from './types';

export type AiStatusSource = 'local' | 'gateway' | 'browser' | 'none';

export type AiStatus = {
  /** A language model can answer right now. */
  chat: boolean;
  /** A speech model can transcribe right now. */
  stt: boolean;
  source: AiStatusSource;
  chatRuntime: RuntimeId | null;
  sttRuntime: RuntimeId | null;
  model: string | null;
  /** Secret-free, human explanation for the settings/status rows. */
  detail: string;
  /** True when the bundled (non-AI) coach is what a turn would use. */
  offlineCoach: boolean;
  probe: EngineProbe;
};

function sourceFor(runtime: RuntimeId | null, probe: EngineProbe): AiStatusSource {
  if (!runtime) return 'none';
  if (runtime === 'gateway') return 'gateway';
  if (runtime === 'browser') return 'browser';
  if (runtime === 'ollama' || runtime === 'openai') return 'local';
  return probe.gateway?.chat ? 'gateway' : 'none';
}

export async function fetchAiStatus(
  settings: ModelSettings,
  ctx: EngineContext
): Promise<AiStatus> {
  const probe = await probeEngines(settings, ctx);
  return {
    chat: Boolean(probe.chatRuntime),
    stt: Boolean(probe.sttRuntime),
    source: sourceFor(probe.chatRuntime, probe),
    chatRuntime: probe.chatRuntime,
    sttRuntime: probe.sttRuntime,
    model: probe.chatModel,
    detail: probe.detail,
    offlineCoach: !probe.chatRuntime,
    probe,
  };
}
