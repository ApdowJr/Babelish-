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
