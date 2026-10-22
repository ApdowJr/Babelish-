/**
 * Guest-identity tests.
 *
 * `X-Forwarded-For` is attacker-controlled, and the value becomes part of a
 * database key (`anon:<ip>`). These pin two properties: a well-formed address
 * is extracted from the noise, and anything malformed collapses to `unknown`
 * instead of becoming an unbounded string.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientIp } from '../src/lib/clientIp';

test('the first forwarded address is used', () => {
  assert.equal(normalizeClientIp('203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientIp('203.0.113.7, 10.0.0.1, 172.16.0.9'), '203.0.113.7');
  assert.equal(normalizeClientIp('  203.0.113.7  ,10.0.0.1'), '203.0.113.7');
});

test('ports and IPv4-mapped IPv6 are reduced to the address', () => {
  assert.equal(normalizeClientIp('203.0.113.7:44321'), '203.0.113.7');
  assert.equal(normalizeClientIp('::ffff:203.0.113.7'), '203.0.113.7');
  assert.equal(normalizeClientIp('[2001:db8::1]'), 'unknown', 'brackets are not an address');
  assert.equal(normalizeClientIp('2001:db8::1'), '2001:db8::1');
});

test('malformed input never becomes a key', () => {
  assert.equal(normalizeClientIp(undefined), 'unknown');
  assert.equal(normalizeClientIp(''), 'unknown');
  assert.equal(normalizeClientIp(' , , '), 'unknown');
  assert.equal(normalizeClientIp('999.999.999.999'), 'unknown', 'octets out of range');
  assert.equal(normalizeClientIp('1.2.3'), 'unknown');
  assert.equal(normalizeClientIp('not-an-ip'), 'unknown');
  assert.equal(normalizeClientIp('1.2.3.4\nX-Injected: yes'), 'unknown');
  assert.equal(normalizeClientIp('a'.repeat(500)), 'unknown');
  assert.equal(normalizeClientIp('1.2.3.4 ' + 'x'.repeat(400)), 'unknown');
});

test('X-Real-IP is the fallback when the forwarded header is unusable', () => {
  assert.equal(normalizeClientIp('garbage', '198.51.100.4'), '198.51.100.4');
  assert.equal(normalizeClientIp(undefined, '198.51.100.4'), '198.51.100.4');
  assert.equal(normalizeClientIp('garbage', 'also garbage'), 'unknown');
});

test('a spoofed address is a new bucket, not a crash — and the budget is the real cap', () => {
  // Documenting the residual risk honestly: anyone can claim any address.
  assert.equal(normalizeClientIp('203.0.113.7'), '203.0.113.7');
  assert.notEqual(normalizeClientIp('203.0.113.7'), normalizeClientIp('203.0.113.8'));
});
