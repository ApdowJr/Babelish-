/**
 * Speech-to-text adapters.
 *
 *   gateway → POST {base}/api/ai/stt        (JWT, server-owned model)
 *   openai  → POST {base}/audio/transcriptions (local Whisper server)
 *   browser → Transformers.js Whisper (on-device)
 *
 * The recording is never uploaded anywhere unless the learner actually uses
 * voice input, and it is never persisted: `prepareAudioPart` reads the take,
 * uploads it, and the object URL is revoked immediately.
 */
import { Platform } from 'react-native';
import { getLanguage } from '../../data/languages';
import { appendTranscriptionFields, prepareAudioPart } from '../sttUpload';
import { readAudioBytes } from './audio';
import { browserTranscribe } from './browser';
import { languageSupport, sttCandidates, sttModelForRuntime, type EngineContext, type ModelSettings } from './config';
import type { RuntimeId, TranscribeAnswer } from './types';
import { isQuotaResponse } from '../quota';
import {
  EngineFailed,
  EngineUnavailable,
  QuotaExceeded,
  RequestCancelled,
  classifyFetchError,
  linkedAbort,
} from './types';

async function transcribeViaForm(input: {
  url: string;
  headers: Record<string, string>;
  audioUri: string;
  model: string;
  languageId: string;
  runtime: RuntimeId;
  signal?: AbortSignal;
}): Promise<string> {
  const audio = await prepareAudioPart(input.audioUri, Platform.OS);
  const form = new FormData();
  appendTranscriptionFields(form, audio, { model: input.model, languageId: input.languageId });

  const linked = linkedAbort(input.signal, 60_000);
  try {
    const res = await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: form,
      signal: linked.signal,
    });
    const json = (await res.json().catch(() => null)) as {
      text?: string;
      error?: string | { message?: string };
      message?: string;
    } | null;
    if (res.status === 429 && isQuotaResponse(json)) {
      throw new QuotaExceeded(json.message, json.resetsAt, input.runtime);
    }
    if (!res.ok) {
      const detail =
        typeof json?.error === 'string' ? json.error : json?.error?.message ?? json?.message;
      throw new EngineFailed(
        detail || `Transcription failed (HTTP ${res.status}) — try again or type instead.`,
        input.runtime
      );
    }
    const text = String(json?.text ?? '').trim();
    if (!text) {
      throw new EngineFailed("I couldn't catch that — try again or type instead.", input.runtime);
    }
    return text;
  } catch (err) {
    throw classifyFetchError(err, input.runtime, 'Transcription');
  } finally {
    linked.dispose();
  }
}

function assertCoverage(settings: ModelSettings, model: string, languageId: string, runtime: RuntimeId) {
  const support = languageSupport(model, languageId, settings.allowUnverified);
  if (support === 'ok') return;
  const language = getLanguage(languageId);
  throw new EngineUnavailable(
    support === 'unsupported'
      ? `${model} cannot transcribe ${language.name}.`
      : `${model} does not document ${language.name} transcription yet.`,
    runtime
  );
}

/**
 * Tries the configured transcription runtimes in order. Returns `null` when
 * none ran (offline / not configured), which the caller turns into “type
 * instead”; a runtime that ran and failed throws.
 */
export async function runTranscribe(
  settings: ModelSettings,
  audioUri: string,
  languageId: string,
  ctx: EngineContext,
  opts: {
    signal?: AbortSignal;
    onProgress?: (p: { loaded: number; total: number; pct: number; label: string }) => void;
  } = {}
): Promise<TranscribeAnswer | null> {
  const candidates = sttCandidates(settings, ctx);
  for (const runtime of candidates) {
    // Already stopped: do not even open a request (or load a model).
    if (opts.signal?.aborted) throw new RequestCancelled(runtime);
    const model = sttModelForRuntime(settings, runtime);
    try {
      assertCoverage(settings, model, languageId, runtime);
      const started = Date.now();

      if (runtime === 'gateway') {
        if (!ctx.gatewayBase || !ctx.jwt) {
          throw new EngineUnavailable('App server is not configured.', 'gateway');
        }
        const text = await transcribeViaForm({
          url: `${ctx.gatewayBase}/api/ai/stt`,
          headers: { Authorization: `Bearer ${ctx.jwt}` },
          audioUri,
          model,
          languageId,
          runtime,
          signal: opts.signal,
        });
        return { text, runtime, model, ms: Date.now() - started };
      }

      if (runtime === 'openai') {
        const base = settings.openaiUrl;
        if (!base) throw new EngineUnavailable('No local server URL is configured.', 'openai');
        const text = await transcribeViaForm({
          url: `${base}/audio/transcriptions`,
          headers: {},
          audioUri,
          model,
          languageId,
          runtime,
          signal: opts.signal,
        });
        return { text, runtime, model, ms: Date.now() - started };
      }

      if (runtime === 'browser') {
        const bytes = await readAudioBytes(audioUri);
        const answer = await browserTranscribe({
          settings,
          audio: bytes,
          languageId,
          signal: opts.signal,
          onProgress: opts.onProgress,
        });
        return { ...answer, ms: Date.now() - started };
      }
    } catch (err) {
      // A cancelled take is not a failed take; never retry it on another
      // runtime (the learner has already stopped waiting).
      if (opts.signal?.aborted) throw new RequestCancelled(runtime);
      if (err instanceof EngineUnavailable) continue;
      // A server without credits or a valid key cannot transcribe, but the
      // next candidate (on-device Whisper) can — and it is free. Only move on
      // for credential/quota failures; a real transcription error is surfaced.
      if (
        err instanceof EngineFailed &&
        runtime === 'gateway' &&
        /(credit|quota|rate|402|401|403|rejected|unauthor)/i.test(err.message)
      ) {
        continue;
      }
      throw err;
    }
  }
  return null;
}
