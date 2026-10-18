import AsyncStorage from '@react-native-async-storage/async-storage';
import { postReport, type ReportPayload } from '@/lib/neonApi';

/**
 * Learner reporting — "this sounds wrong" from any content surface.
 *
 * Reports are durable before they are fast: every report is written to an
 * on-device queue first, then the queue is flushed to the backend. When the
 * Function is unreachable (offline, or `/api/reports` not deployed yet) the
 * item simply stays queued and syncs on the next successful flush — reporting
 * never fails in the learner's face.
 */

const QUEUE_KEY = 'nativa:report-queue';
const MAX_QUEUE = 50;

export type ReportOutcome = 'sent' | 'queued';

type QueuedReport = ReportPayload & { localId: string; at: string };

function newLocalId(): string {
  return `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function loadReportQueue(): Promise<QueuedReport[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
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

async function saveQueue(items: QueuedReport[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  } catch {
    // best-effort — a lost local report is not worth crashing over
  }
}

/**
 * Sends everything queued; on the first failure it stops and keeps the rest
 * (so a missing endpoint doesn't hammer retries). Never throws.
 */
export async function flushReportQueue(
  getToken: () => Promise<string | null>
): Promise<{ sent: number; remaining: number }> {
  const queue = await loadReportQueue();
  if (queue.length === 0) return { sent: 0, remaining: 0 };

  let jwt: string | null = null;
  try {
    jwt = await getToken();
  } catch {
    jwt = null;
  }
  if (!jwt) return { sent: 0, remaining: queue.length };

  let sent = 0;
  let failureIndex = -1;
  for (let i = 0; i < queue.length; i++) {
    const { localId: _localId, at: _at, ...payload } = queue[i];
    try {
      await postReport(jwt, payload);
      sent += 1;
    } catch {
      failureIndex = i;
      break;
    }
  }
  const remaining = failureIndex === -1 ? [] : queue.slice(failureIndex);
  await saveQueue(remaining);
  return { sent, remaining: remaining.length };
}

/**
 * Queue-first submit: persists locally, then tries a full flush.
 * Returns whether THIS report made it to the backend.
 */
export async function sendReport(
  getToken: () => Promise<string | null>,
  report: ReportPayload
): Promise<ReportOutcome> {
  const queue = await loadReportQueue();
  const item: QueuedReport = {
    ...report,
    quote: report.quote.slice(0, 600),
    reason: report.reason.slice(0, 400),
    localId: newLocalId(),
    at: new Date().toISOString(),
  };
  await saveQueue([...queue, item].slice(-MAX_QUEUE));
  const { remaining } = await flushReportQueue(getToken);
  return remaining === 0 ? 'sent' : 'queued';
}
