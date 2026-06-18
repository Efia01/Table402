import { decodeJson, encodeJson } from './encoding';
import { ChargeRequest, type MppChallenge, type MppReceipt } from './types';

/** Build a faithful `WWW-Authenticate: Payment ...` header from a challenge. */
export function buildWwwAuthenticate(challenge: MppChallenge): string {
  const params: Record<string, string> = {
    id: challenge.id,
    nonce: challenge.nonce,
    realm: challenge.realm,
    method: challenge.method,
    intent: challenge.intent,
    expires: challenge.expires,
    request: encodeJson(challenge.request),
    binding: challenge.binding,
  };
  if (challenge.description) params.description = challenge.description;
  if (challenge.opaque) params.opaque = challenge.opaque;
  const parts = Object.entries(params).map(([k, v]) => `${k}="${escapeQuoted(v)}"`);
  return `Payment ${parts.join(', ')}`;
}

function escapeQuoted(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/** Parse a `WWW-Authenticate: Payment ...` header back into a challenge (best-effort). */
export function parseWwwAuthenticate(header: string): MppChallenge | null {
  const match = /^Payment\s+(.*)$/is.exec(header.trim());
  if (!match) return null;
  const params = parseAuthParams(match[1]!);
  if (!params.id || !params.request) return null;
  let request;
  try {
    request = ChargeRequest.parse(decodeJson(params.request));
  } catch {
    return null;
  }
  const intent = params.intent === 'session' ? 'session' : 'charge';
  return {
    id: params.id,
    nonce: params.nonce ?? '',
    realm: params.realm ?? '',
    method: params.method ?? 'tempo',
    intent,
    expires: params.expires ?? '',
    request,
    binding: params.binding ?? '',
    description: params.description,
    opaque: params.opaque,
  };
}

function parseAuthParams(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(\w+)\s*=\s*(?:"((?:[^"\\]|\\.)*)"|([^,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input))) {
    const key = m[1]!;
    const value = m[2] !== undefined ? m[2].replace(/\\(.)/g, '$1') : (m[3] ?? '');
    out[key] = value;
  }
  return out;
}

export function encodeReceiptHeader(receipt: MppReceipt): string {
  return encodeJson(receipt);
}

export function decodeReceiptHeader(header: string): MppReceipt {
  return decodeJson<MppReceipt>(header);
}
