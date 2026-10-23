/**
 * Best-effort, in-memory rate limiting for the API Function.
 *
 * Honest about its scope: a serverless function can run several instances, so these
 * are per-instance guardrails — they cap the damage a single caller can do to
 * a provider bill (AI proxy) or to credential guessing (admin gate), they are
 * not a global quota. Pure and clock-injected so they are unit-testable.
 */

export type WindowCounter = {
  /** True while this key may make another attempt. */
  blocked(key: string): boolean;
  /** Record a failure/attempt against the key's current window. */
  hit(key: string): void;
};

const PRUNE_THRESHOLD = 10_000;

/**
 * Fixed-window counter: `max` hits per `windowMs` per key, measured from the
 * first hit of the window.
 */
export function createFailureLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now
): WindowCounter {
  const buckets = new Map<string, { count: number; start: number }>();

  function prune(t: number): void {
    if (buckets.size <= PRUNE_THRESHOLD) return;
    for (const [key, bucket] of buckets) {
      if (t - bucket.start >= windowMs) buckets.delete(key);
    }
  }

  return {
    blocked(key: string): boolean {
      const bucket = buckets.get(key);
      if (!bucket) return false;
      if (now() - bucket.start >= windowMs) {
        buckets.delete(key); // window elapsed — fresh start
        return false;
      }
      return bucket.count >= max;
    },
    hit(key: string): void {
      const t = now();
      prune(t);
      const bucket = buckets.get(key);
      if (!bucket || t - bucket.start >= windowMs) {
        buckets.set(key, { count: 1, start: t });
        return;
      }
      bucket.count += 1;
    },
  };
}

/**
 * Admission limiter for paid-path routes (chat/transcription): `take` returns
 * false once the key exhausted its current window.
 */
export type AdmissionLimiter = { take(key: string): boolean };

export function createLimiter(
  max: number,
  windowMs: number,
  now: () => number = Date.now
): AdmissionLimiter {
  const failures = createFailureLimiter(max, windowMs, now);
  // blocked() before hit(): the (max+1)-th request is refused, max go through.
  return {
    take(key: string): boolean {
      if (failures.blocked(key)) return false;
      failures.hit(key);
      return true;
    },
  };
}
