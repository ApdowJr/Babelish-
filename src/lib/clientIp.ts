/**
 * Normalises the address a request claims to come from.
 *
 * Guests get a stricter daily budget than signed-in learners, keyed by
 * `anon:<ip>`. Two things matter here:
 *
 *  1. **Validation.** The header is attacker-controlled. Without a limit, a
 *     learner could send a megabyte of junk, and that string becomes a
 *     primary-key-ish value in `public.ai_usage` and in the rate limiter maps.
 *  2. **Honesty.** Spoofing *is* possible: a caller can claim any address and
 *     get a fresh guest allowance. That is why the server-wide budget — not
 *     the per-IP cap — is the real spend guard, and why this function's job is
 *     to produce a bounded, well-formed key rather than to authenticate.
 *
 * The first `X-Forwarded-For` entry is used because it is the one the client
 * claims; taking the last one would collapse every guest onto the proxy's own
 * address when the platform terminates TLS in front of the Function.
 */

const MAX_LENGTH = 45; // longest textual IPv6 form
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6 = /^[0-9a-fA-F:.]+$/;

/** One candidate address → a valid address, or `null`. */
function oneAddress(raw: string): string | null {
  let value = raw.trim().replace(/^"(.*)"$/, '$1');
  if (!value) return null;
  // IPv4 with a port (`1.2.3.4:5678`) — keep the address only.
  const v4Port = value.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d{1,5}$/);
  if (v4Port) value = v4Port[1];
  // IPv4-mapped IPv6 (`::ffff:1.2.3.4`) → the IPv4 address.
  value = value.replace(/^::ffff:/i, '');
  if (value.length > MAX_LENGTH) return null;

  const v4 = value.match(IPV4);
  if (v4) {
    const octets = v4.slice(1).map(Number);
    return octets.every((octet) => octet >= 0 && octet <= 255) ? value : null;
  }
  if (IPV6.test(value) && value.includes(':')) return value;
  return null;
}

/**
 * `X-Forwarded-For` (+ `X-Real-IP` fallback) → a safe key.
 * Anything malformed becomes `unknown`, which shares one guest bucket.
 */
export function normalizeClientIp(
  forwardedFor?: string | null,
  realIp?: string | null
): string {
  const candidates = [
    ...(forwardedFor ?? '').split(','),
    ...(realIp ? [realIp] : []),
  ];
  for (const candidate of candidates) {
    const address = oneAddress(candidate);
    if (address) return address;
  }
  return 'unknown';
}
