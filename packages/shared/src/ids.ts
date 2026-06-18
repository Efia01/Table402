/**
 * Isomorphic id/time helpers using the Web Crypto API (available in both Node 20+
 * and browsers), so `@table402/shared` stays safe to import from the web bundle.
 */

type WebCryptoLike = {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
  randomUUID?: () => string;
};

function webCrypto(): WebCryptoLike {
  const c = (globalThis as { crypto?: WebCryptoLike }).crypto;
  if (!c || typeof c.getRandomValues !== 'function') {
    throw new Error('Web Crypto API is not available in this runtime');
  }
  return c;
}

export function newId(prefix: string): string {
  const bytes = new Uint8Array(10);
  webCrypto().getRandomValues(bytes);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

export function newUuid(): string {
  const c = webCrypto();
  if (typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback (should not be needed on supported runtimes).
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function nowMs(): number {
  return Date.now();
}
