/**
 * lib/session-cookie.js — Tamper-evident session cookie encoding.
 *
 * The `user` cookie is HMAC-signed with SESSION_SECRET so its payload cannot be
 * forged or modified client-side. Format:
 *
 *   <base64url(JSON.stringify(payload))>.<hmacSHA256Hex>
 *
 * This module is intentionally free of any `next/headers` import so it can be
 * imported from both the Node-runtime middleware and server-side lib code.
 */
import crypto from 'crypto';

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  return typeof secret === 'string' && secret.length > 0 ? secret : null;
}

function hmac(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

/**
 * Signs a session payload object. Throws if SESSION_SECRET is missing — a misconfigured
 * environment must never silently emit unsigned cookies.
 */
export function signPayload(obj) {
  const secret = getSecret();
  if (!secret) throw new Error('SESSION_SECRET is not set — cannot sign session cookie');

  const b64 = Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
  return `${b64}.${hmac(secret, b64)}`;
}

/**
 * Verifies a signed cookie value and returns the parsed payload, or null if the value is
 * malformed, the signature does not match, or SESSION_SECRET is unset (fail closed).
 */
export function verifyCookie(value) {
  const secret = getSecret();
  if (!secret || typeof value !== 'string') return null;

  const dot = value.lastIndexOf('.');
  if (dot <= 0) return null;

  const b64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = hmac(secret, b64);

  // Constant-time compare — both are fixed-length lowercase hex, so length matches on valid input.
  const sigBuf = Buffer.from(sig, 'utf8');
  const expBuf = Buffer.from(expected, 'utf8');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    return JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}
