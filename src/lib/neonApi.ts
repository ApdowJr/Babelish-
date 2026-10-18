import { NEON_API_URL } from '@/lib/neon';

/**
 * Client for the `api` Neon Function — the app's backend. Every call carries
 * a Managed Auth JWT (15-minute EdDSA token); the Function verifies it against
 * the branch JWKS and derives the user id from the `sub` claim.
 */

export type NeonStatePayload = {
  progress: Record<string, { score: number; completedAt: string }>;
  vocab: Record<string, unknown>;
};

export type NeonState = NeonStatePayload & { updatedAt: string | null };

async function call<T>(
  path: string,
  jwt: string,
  opts: { method?: string; body?: unknown } = {}
): Promise<T> {
  const res = await fetch(`${NEON_API_URL}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${jwt}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(`Neon API ${path} failed with status ${res.status}`);
  return (await res.json()) as T;
}

/** Loads the learner's server-side state (empty state when none exists yet). */
export async function fetchNeonState(jwt: string): Promise<NeonState> {
  return call<NeonState>('/api/state', jwt);
}

/** Upserts the learner's progress + vocabulary. */
export async function saveNeonState(
  jwt: string,
  payload: NeonStatePayload
): Promise<{ updatedAt: string }> {
  return call<{ updatedAt: string }>('/api/state', jwt, { method: 'PUT', body: payload });
}

/** Asks the Function for a presigned upload URL in the caller's own prefix. */
export async function requestUploadUrl(
  jwt: string,
  name: string,
  contentType: string
): Promise<{ uploadUrl: string; key: string }> {
  return call<{ uploadUrl: string; key: string }>('/api/storage/sign', jwt, {
    method: 'POST',
    body: { name, contentType },
  });
}

/** Asks the Function for a presigned download URL of one of the user's objects. */
export async function requestDownloadUrl(jwt: string, key: string): Promise<{ url: string }> {
  return call<{ url: string }>(
    `/api/storage/url?key=${encodeURIComponent(key)}`,
    jwt
  );
}

export type ReportPayload = {
  languageId: string;
  kind: string;
  quote: string;
  reason: string;
};

/** Files a "this sounds wrong" report into the human review queue. */
export async function postReport(jwt: string, report: ReportPayload): Promise<{ id: string }> {
  return call<{ id: string }>('/api/reports', jwt, { method: 'POST', body: report });
}

export type LeagueInfo = {
  week: string;
  total: number;
  /** null = the learner hasn't logged XP this week (never a fake rank). */
  rank: number | null;
  xp: number;
};

/** Weekly XP claim — an absolute value; the server keeps the greatest. */
export async function postWeeklyXp(
  jwt: string,
  week: string,
  xp: number
): Promise<{ week: string; xp: number }> {
  return call<{ week: string; xp: number }>('/api/league/xp', jwt, {
    method: 'POST',
    body: { week, xp },
  });
}

/** Own weekly rank — privacy-first: field size + your position, no identities. */
export async function fetchLeague(jwt: string, week: string): Promise<LeagueInfo> {
  return call<LeagueInfo>(`/api/league?week=${encodeURIComponent(week)}`, jwt);
}

/** GDPR/Play data-deletion: server wipes every row keyed to this account. */
export async function deleteAccount(
  jwt: string
): Promise<{ deleted: { state: number; league: number; reports: number } }> {
  return call<{ deleted: { state: number; league: number; reports: number } }>('/api/me', jwt, {
    method: 'DELETE',
  });
}

/** Uploads bytes to a presigned URL (S3-compatible; content type is signed). */
export async function uploadWithPresignedUrl(
  uploadUrl: string,
  bytes: Uint8Array,
  contentType: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: bytes as unknown as BodyInit,
  });
  if (!res.ok) throw new Error(`Object upload failed with status ${res.status}`);
}
