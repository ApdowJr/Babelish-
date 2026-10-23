/**
 * Chat adapters.
 *
 * Three runtimes, one interface:
 *   - `ollama`  → POST {base}/api/chat          (Ollama daemon)
 *   - `openai`  → POST {base}/chat/completions  (llama.cpp, LM Studio, LocalAI…)
 *   - `gateway` → POST {base}/api/ai/chat       (Babelish's own Function)
 *
 * All three are *open* endpoints: no paid provider is ever called, and no
 * credential is required for a local server. The gateway uses the signed-in
 * learner's JWT; its upstream provider key lives only on the server.
 */
import { getLanguage } from '../../data/languages';
import { browserChat } from './browser';
import {
  chatCandidates,
  languageSupport,
  modelForRuntime,
  type EngineContext,
  type ModelSettings,
} from './config';
import type { ChatAnswer, ChatCall, ChatMeta, ChatTurn, RuntimeId } from './types';
import { isQuotaResponse } from '../quota';
import {
  EngineFailed,
  EngineUnavailable,
  QuotaExceeded,
  RequestCancelled,
  classifyFetchError,
  linkedAbort,
} from './types';

function requireSupport(
  runtime: RuntimeId,
  model: string,
  settings: ModelSettings,
  languageId: string | undefined
): void {
  if (!languageId || runtime === 'gateway') return;
  // The gateway owns model selection and enforces its own script validation.
  // "server" is a transport label, not a catalogue model, so checking it here
  // would incorrectly block every server-backed language unless users opted
  // into unverified models in Settings.
  const support = languageSupport(model, languageId, settings.allowUnverified);
  if (support === 'ok') return;
  const language = getLanguage(languageId);
  throw new EngineUnavailable(
    support === 'unverified'
      ? `${model} does not document ${language.name}. Enable “use unverified languages” in Settings if you want to try it anyway.`
      : `${model} does not support ${language.name}.`,
    runtime
  );
}

/* ── Runtime probes ────────────────────────────────────────────────────── */

export type EngineProbe = {
  chatRuntime: RuntimeId | null;
  chatModel: string | null;
  sttRuntime: RuntimeId | null;
  sttModel: string | null;
  /** True when nothing ran — the offline coach is what the learner gets. */
  offline: boolean;
  /** Human-readable, secret-free explanation of the outcome. */
  detail: string;
  ollamaModels: string[];
  browserSupported: boolean;
  gateway: { configured: boolean; chat: boolean; stt: boolean; model?: string } | null;
};

async function getJson(
  url: string,
  init: RequestInit,
  timeoutMs = 2_500
): Promise<{ ok: boolean; status: number; json: unknown }> {
  const linked = linkedAbort(undefined, timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: linked.signal });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, json };
  } finally {
    linked.dispose();
  }
}

/** Lists locally available Ollama models. Throws EngineUnavailable if down. */
export async function probeOllama(base: string): Promise<string[]> {
  try {
    const res = await getJson(`${base}/api/tags`, { method: 'GET' });
    if (!res.ok) throw new EngineUnavailable(`Ollama answered HTTP ${res.status}.`, 'ollama');
    const data = res.json as { models?: { name?: string; model?: string }[] } | null;
    return (data?.models ?? [])
      .map((m) => m.name ?? m.model ?? '')
      .filter((name): name is string => Boolean(name));
  } catch (err) {
    throw classifyFetchError(err, 'ollama', 'Ollama');
  }
}

/** Health-checks an OpenAI-compatible server. */
export async function probeOpenAI(base: string): Promise<string[]> {
  try {
    const res = await getJson(`${base}/models`, { method: 'GET' });
    if (!res.ok) throw new EngineUnavailable(`Local server answered HTTP ${res.status}.`, 'openai');
    const data = res.json as { data?: { id?: string }[] } | null;
    return (data?.data ?? [])
      .map((m) => m.id ?? '')
      .filter((id): id is string => Boolean(id));
  } catch (err) {
    throw classifyFetchError(err, 'openai', 'Local model server');
  }
}

/** Health-checks the app owner's gateway. */
export async function probeGateway(
  base: string,
  jwt?: string | null,
  apiKey?: string | null
) {
  try {
    const res = await getJson(
      `${base}/api/ai/status`,
      {
        method: 'GET',
        headers: {
          ...(apiKey ? { apikey: apiKey } : {}),
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
      },
      3_000
    );
    // Signed out (or an owner-hosted keyless gateway): not an error, just a
    // tutor that is not usable from here — the coach covers it.
    if (res.status === 401 || res.status === 403) {
      throw new EngineUnavailable('Sign in to use the tutor server.', 'gateway');
    }
    if (!res.ok) throw new EngineUnavailable(`Tutor server answered HTTP ${res.status}.`, 'gateway');
    const data = res.json as { chat?: boolean; stt?: boolean; model?: string } | null;
    return {
      chat: data?.chat === true,
      stt: data?.stt === true,
      model: typeof data?.model === 'string' ? data.model : undefined,
    };
  } catch (err) {
    throw classifyFetchError(err, 'gateway', 'App inference server');
  }
}

/**
 * Probes every configured runtime once. Never throws: the result is what the
 * UI shows as "available right now", with a plain-language detail line.
 */
export async function probeEngines(
  settings: ModelSettings,
  ctx: EngineContext
): Promise<EngineProbe> {
  const browserSupported = ctx.browserSupported !== false && typeof WebAssembly === 'object';
  const notes: string[] = [];
  let chatRuntime: RuntimeId | null = null;
  let chatModel: string | null = null;
  let sttRuntime: RuntimeId | null = null;
  let sttModel: string | null = null;
  let ollamaModels: string[] = [];
  let gateway: EngineProbe['gateway'] = null;

  const ollamaUrl = settings.mode === 'local' || settings.mode === 'auto' ? settings.ollamaUrl : '';
  const openaiUrl = settings.mode === 'local' || settings.mode === 'auto' ? settings.openaiUrl : '';

  const tasks: Promise<void>[] = [];

  if (ollamaUrl) {
    tasks.push(
      probeOllama(ollamaUrl)
        .then((models) => {
          ollamaModels = models;
          if (!chatRuntime) {
            chatRuntime = 'ollama';
            chatModel = settings.ollamaModel;
          }
          if (!models.includes(settings.ollamaModel)) {
            notes.push(
              `Ollama is running but “${settings.ollamaModel}” is not downloaded (run: ollama pull ${settings.ollamaModel}).`
            );
          } else {
            notes.push(`Ollama ready (${settings.ollamaModel}).`);
          }
        })
        .catch((err: Error) => {
          notes.push(err.message);
        })
    );
  }

  if (openaiUrl) {
    tasks.push(
      probeOpenAI(openaiUrl)
        .then((models) => {
          if (!chatRuntime) {
            chatRuntime = 'openai';
            chatModel = settings.openaiModel;
          }
          notes.push(`Local server ready (${models.length} model${models.length === 1 ? '' : 's'}).`);
        })
        .catch((err: Error) => {
          notes.push(err.message);
        })
    );
  }

  const gatewayBase = ctx.gatewayBase ?? null;
  if (gatewayBase && settings.mode !== 'local' && settings.mode !== 'offline') {
    tasks.push(
      probeGateway(gatewayBase, ctx.jwt, ctx.apiKey)
        .then((status) => {
          gateway = { configured: true, chat: status.chat, stt: status.stt, model: status.model };
          if (status.chat && !chatRuntime) {
            chatRuntime = 'gateway';
            chatModel = status.model ?? settings.ollamaModel;
          }
          if (status.stt && settings.mode !== 'local' && settings.mode !== 'browser') {
            sttRuntime = 'gateway';
            sttModel = status.model ?? settings.sttModel;
          }
          notes.push(
            status.chat
              ? `App server ready${status.model ? ` (${status.model})` : ''}.`
              : 'App server reachable, but no model is configured on it.'
          );
        })
        .catch((err: Error) => {
          notes.push(err.message);
        })
    );
  }

  await Promise.all(tasks);

  const browserChatAllowed =
    settings.mode === 'browser' || (settings.mode === 'auto' && settings.browser.enabled);
  const browserSttAllowed =
    settings.mode === 'browser' ||
    ((settings.mode === 'auto' || settings.mode === 'server') && settings.browser.enabled);

  if (browserChatAllowed || browserSttAllowed) {
    if (!browserSupported) {
      notes.push('Browser inference needs a web build with WebAssembly.');
    } else {
      if (browserChatAllowed && !chatRuntime) {
        chatRuntime = 'browser';
        chatModel = settings.browser.chatModel;
      }
      if (browserSttAllowed && !sttRuntime) {
        sttRuntime = 'browser';
        sttModel = settings.browser.sttModel;
      }
      notes.push('Browser models load on first use (first run downloads them).');
    }
  }

  if (settings.mode === 'offline') {
    notes.push('Offline coach selected — no model will be contacted.');
  } else if (!chatRuntime) {
    notes.push('No model is reachable right now — the offline coach is used until one is.');
  }

  return {
    chatRuntime,
    chatModel,
    sttRuntime,
    sttModel,
    offline: !chatRuntime && !sttRuntime,
    detail: notes.join(' '),
    ollamaModels,
    browserSupported,
    gateway,
  };
}

/* ── Chat execution ────────────────────────────────────────────────────── */

/** Stable conversation body shared by the gateway adapter. */
function gatewayBody(call: ChatCall) {
  const meta: ChatMeta = call.meta ?? {};
  const history = call.messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', text: m.content }));
  return {
    languageId: meta?.languageId ?? call.languageId ?? 'es',
    level: meta?.level,
    scenarioTitle: meta?.scenarioTitle,
    learnerName: meta?.learnerName,
    explanationLanguage: meta?.explanationLanguage,
    profile: meta?.profile,
    lessonId: meta?.lessonId,
    history: history.length > 0 ? history : [{ role: 'user', text: 'Hello!' }],
  };
}

async function runOllama(
  settings: ModelSettings,
  call: ChatCall,
  model: string
): Promise<ChatAnswer> {
  const base = settings.ollamaUrl;
  const started = Date.now();
  const linked = linkedAbort(call.signal, 120_000);
  try {
    const res = await fetch(`${base}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: linked.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: call.messages,
        options: {
          temperature: call.temperature ?? 0.7,
          num_predict: call.maxTokens ?? 320,
        },
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      message?: { content?: string };
      error?: string;
    } | null;
    if (!res.ok) {
      throw new EngineFailed(
        res.status === 404
          ? `Ollama does not have “${model}”. Run: ollama pull ${model}`
          : json?.error || `Ollama answered HTTP ${res.status}.`,
        'ollama'
      );
    }
    const text = String(json?.message?.content ?? '').trim();
    if (!text) throw new EngineFailed('Ollama returned an empty answer.', 'ollama');
    return { text, runtime: 'ollama', model, ms: Date.now() - started };
  } catch (err) {
    throw classifyFetchError(err, 'ollama', 'Ollama');
  } finally {
    linked.dispose();
  }
}

async function runOpenAI(
  settings: ModelSettings,
  call: ChatCall,
  model: string
): Promise<ChatAnswer> {
  const base = settings.openaiUrl;
  if (!base) throw new EngineUnavailable('No local server URL is configured.', 'openai');
  const started = Date.now();
  const linked = linkedAbort(call.signal, 120_000);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: linked.signal,
      body: JSON.stringify({
        model,
        temperature: call.temperature ?? 0.7,
        max_tokens: call.maxTokens ?? 320,
        messages: call.messages,
      }),
    });
    const json = (await res.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
    } | null;
    if (!res.ok) {
      const detail =
        typeof json?.error === 'string' ? json.error : json?.error?.message ?? `HTTP ${res.status}`;
      throw new EngineFailed(`Local model server: ${detail}`, 'openai');
    }
    const text = String(json?.choices?.[0]?.message?.content ?? '').trim();
    if (!text) throw new EngineFailed('The local model returned an empty answer.', 'openai');
    return { text, runtime: 'openai', model, ms: Date.now() - started };
  } catch (err) {
    throw classifyFetchError(err, 'openai', 'Local model server');
  } finally {
    linked.dispose();
  }
}

async function runGateway(
  settings: ModelSettings,
  call: ChatCall,
  ctx: EngineContext
): Promise<ChatAnswer> {
  const base = ctx.gatewayBase;
  if (!base) throw new EngineUnavailable('Tutor server is not configured.', 'gateway');
  const started = Date.now();
  const linked = linkedAbort(call.signal, 60_000);
  try {
    const res = await fetch(`${base}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ctx.apiKey ? { apikey: ctx.apiKey } : {}),
        ...(ctx.jwt ? { Authorization: `Bearer ${ctx.jwt}` } : {}),
      },
      body: JSON.stringify(gatewayBody(call)),
      signal: linked.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      reply?: string;
      translation?: string;
      tip?: string;
      error?: string;
      message?: string;
      model?: string;
      resetsAt?: string;
    } | null;
    if (res.status === 429 && isQuotaResponse(json)) {
      throw new QuotaExceeded(json.message, json.resetsAt, 'gateway');
    }
    if (res.status === 503 && json?.error === 'ai-not-configured') {
      throw new EngineUnavailable('The tutor server has no model configured.', 'gateway');
    }
    // 401/403 = no session for a protected gateway; fall through to the coach
    // instead of showing the learner an auth error mid-conversation.
    if (res.status === 401 || res.status === 403) {
      throw new EngineUnavailable('Sign in to use the tutor server.', 'gateway');
    }
    if (!res.ok) {
      throw new EngineFailed(
        json?.message || json?.error || `App server answered HTTP ${res.status}.`,
        'gateway'
      );
    }
    if (!json?.reply || !json.reply.trim()) {
      throw new EngineFailed('The app server returned an empty answer.', 'gateway');
    }
    // Re-shape as the tutor JSON so the caller's parser/guardrail runs on it.
    return {
      text: JSON.stringify({
        reply: json.reply,
        translation: json.translation ?? '',
        tip: json.tip,
      }),
      runtime: 'gateway',
      model: json.model ?? settings.ollamaModel,
      ms: Date.now() - started,
    };
  } catch (err) {
    throw classifyFetchError(err, 'gateway', 'App inference server');
  } finally {
    linked.dispose();
  }
}

/** The browser adapter itself is small; the model runtime it loads is not. */
async function runBrowser(
  settings: ModelSettings,
  call: ChatCall
): Promise<ChatAnswer> {
  return browserChat({
    settings,
    messages: call.messages,
    maxTokens: call.maxTokens,
    temperature: call.temperature,
    signal: call.signal,
    onProgress: call.onProgress,
  });
}

/**
 * Runs a chat completion through the first working runtime.
 *
 * Returns `null` only when *no transport ran* (nothing configured / all
 * unavailable), which the caller turns into the offline coach. A transport
 * that ran and failed throws `EngineFailed` — never silently replaced.
 */
export async function runChat(
  settings: ModelSettings,
  call: ChatCall,
  ctx: EngineContext
): Promise<ChatAnswer | null> {
  const candidates = chatCandidates(settings, ctx);

  if (candidates.length === 0) return null;

  for (const runtime of candidates) {
    // Already stopped: do not even open a request.
    if (call.signal?.aborted) throw new RequestCancelled(runtime);
    const model = modelForRuntime(settings, runtime);
    try {
      // Enforced per runtime: an unverified model is skipped, not guessed at.
      requireSupport(runtime, model, settings, call.languageId);
      if (runtime === 'ollama') return await runOllama(settings, call, model);
      if (runtime === 'openai') return await runOpenAI(settings, call, model);
      if (runtime === 'gateway') return await runGateway(settings, call, ctx);
      if (runtime === 'browser') return await runBrowser(settings, call);
    } catch (err) {
      // A caller abort must not be mistaken for a timeout (both surface as
      // AbortError) and must not fall through to the next engine: that would
      // start a second request the learner did not ask for.
      if (call.signal?.aborted) throw new RequestCancelled(runtime);
      if (err instanceof EngineUnavailable) continue;
      throw err;
    }
  }
  return null;
}

/** Turns `ChatTurn[]` into something printable for logs/tests (no user text). */
export function describeMessages(messages: ChatTurn[]): string {
  return messages.map((m) => `${m.role}:${m.content.length}`).join(' ');
}
