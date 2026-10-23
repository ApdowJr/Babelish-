import { supabase } from '@/lib/supabase';
import { readScopedItem, writeScopedItem } from '@/lib/scopedStorage';

type ReportPayload = { languageId: string; kind: string; quote: string; reason: string };

/**
 * Learner reporting — "this sounds wrong" from any content surface.
 *
 * Reports are durable before they are fast: every report is written to an
 * account-scoped on-device queue first, then the queue is flushed to Supabase.
 * Scoping by `userId` ensures an offline report queued by User A is never
 * flushed under User B's account if the device changes hands.
 */

const QUEUE_KEY = 'zelvoca:report-queue';
const MAX_QUEUE = 50;

export type ReportOutcome = 'sent' | 'queued';

type QueuedReport = ReportPayload & { localId: string; at: string };

function newLocalId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadReportQueue(userId?: string | null): Promise<QueuedReport[]> {
  try {
    const raw = await readScopedItem(QUEUE_KEY, userId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is QueuedReport =>
        Boolean(item) && typeof item.localId === 'string' && typeof item.reason === 'string'
    );
  } catch {
    return [];
  }
}

async function saveQueue(items: QueuedReport[], userId?: string | null): Promise<void> {
  await writeScopedItem(QUEUE_KEY, JSON.stringify(items), userId);
}

/**
 * Sends everything queued for the current user; on the first failure it stops
 * and keeps the rest. Never throws.
 */
export async function flushReportQueue(
  getToken: () => Promise<string | null>,
  userId?: string | null
): Promise<{ sent: number; remaining: number }> {
  const queue = await loadReportQueue(userId);
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  let jwt: string | null = null;
  try {
    jwt = await getToken();
  } catch {
    jwt = null;
  }
  if (!jwt) return { sent: 0, remaining: queue.length };

  let activeUserId: string | null = null;
  try {
    if (!supabase) return { sent: 0, remaining: queue.length };
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) return { sent: 0, remaining: queue.length };
    if (userId && user.id !== userId) return { sent: 0, remaining: queue.length };
    activeUserId = user.id;
  } catch {
    return { sent: 0, remaining: queue.length };
  }

  let sent = 0;
  let failureIndex = -1;
  for (let i = 0; i < queue.length; i++) {
    const { localId: _localId, at: _at, ...payload } = queue[i];
    try {
      const { error } = await supabase!.from('content_reports').insert({
        user_id: activeUserId,
        language_id: payload.languageId,
        kind: payload.kind,
        quote: payload.quote,
        reason: payload.reason,
      });
      if (error) throw error;
      sent += 1;
    } catch {
      failureIndex = i;
      break;
    }
  }
  const remaining = failureIndex === -1 ? [] : queue.slice(failureIndex);
  await saveQueue(remaining, userId ?? activeUserId);
  return { sent, remaining: remaining.length };
}

/**
 * Queue-first submit: persists locally under `userId`, then tries a full flush.
 * Returns whether THIS report made it to the backend.
 */
export async function sendReport(
  getToken: () => Promise<string | null>,
  report: ReportPayload,
  userId?: string | null
): Promise<ReportOutcome> {
  const queue = await loadReportQueue(userId);
  const item: QueuedReport = {
    ...report,
    quote: report.quote.slice(0, 600),
    reason: report.reason.slice(0, 400),
    localId: newLocalId(),
    at: new Date().toISOString(),
  };
  await saveQueue([...queue, item].slice(-MAX_QUEUE), userId);
  const { remaining } = await flushReportQueue(getToken, userId);
  return remaining === 0 ? 'sent' : 'queued';
}
