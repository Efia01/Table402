import { createHash, createHmac } from 'node:crypto';

/** base64url encode a string or bytes (no padding). */
export function base64urlEncode(input: string | Uint8Array): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
  return buf.toString('base64url');
}

export function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

/** Encode any JSON value to a base64url string (used for header payloads). */
export function encodeJson(value: unknown): string {
  return base64urlEncode(JSON.stringify(value));
}

export function decodeJson<T = unknown>(b64: string): T {
  return JSON.parse(base64urlDecode(b64)) as T;
}

/**
 * Canonical JSON (RFC 8785 / JCS-shaped): recursively sort object keys so the
 * exact same logical value always produces the exact same string for hashing,
 * HMAC binding, and signature verification.
 */
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

export function hmacHex(secret: string, input: string): string {
  return createHmac('sha256', secret).update(input, 'utf8').digest('hex');
}
