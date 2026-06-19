import type { WalletClient } from 'viem';

function canonicalize(value: unknown): string {
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

export interface MppChallenge {
  id: string;
  nonce: string;
  intent: string;
  request: { amount: string; currency: string; recipient: string };
}

export interface MppReceipt {
  challengeId: string;
  source: string;
  settlement: { amount: string; currency: string };
  receiptHash: string;
  timestamp: string;
  txHash?: string;
}

function chargeSigningMessage(challenge: MppChallenge): string {
  return canonicalize({
    type: 'mpp-charge',
    challengeId: challenge.id,
    nonce: challenge.nonce,
    intent: challenge.intent,
    amount: challenge.request.amount,
    currency: challenge.request.currency,
    recipient: challenge.request.recipient,
  });
}

function encodeJson(value: unknown): string {
  const json = JSON.stringify(value);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomKey(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}_${hex}`;
}

async function parseChallenge(res: Response): Promise<MppChallenge | null> {
  try {
    const body = (await res.clone().json()) as { challenge?: MppChallenge };
    if (body && body.challenge) return body.challenge;
  } catch {
    return null;
  }
  return null;
}

export interface PaidJoinResult {
  ok: boolean;
  error?: string;
  agentId?: string;
  did?: string;
  seatIndex?: number;
  receipt?: MppReceipt;
}

export async function payAndJoin(opts: {
  apiBase: string;
  tableId: string;
  client: WalletClient;
  address: `0x${string}`;
  did: string;
  name?: string;
  buyIn?: number;
}): Promise<PaidJoinResult> {
  const url = `${opts.apiBase}/tables/${opts.tableId}/join`;
  const bodyObj: Record<string, unknown> = { human: true };
  if (opts.name) bodyObj.name = opts.name;
  if (opts.buyIn) bodyObj.buyIn = opts.buyIn;
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(bodyObj),
  };

  const first = await fetch(url, init);
  if (first.status !== 402) {
    const data = (await first.json().catch(() => ({}))) as PaidJoinResult;
    return first.ok ? { ...data, ok: true } : { ok: false, error: data.error ?? `HTTP ${first.status}` };
  }

  const challenge = await parseChallenge(first);
  if (!challenge) return { ok: false, error: 'Could not parse the 402 seat-fee challenge.' };

  const message = chargeSigningMessage(challenge);
  const signature = await opts.client.signMessage({ account: opts.address, message });

  const credential = {
    challenge,
    source: opts.did,
    payload: { type: 'transaction', signature, signedMessage: message },
    idempotencyKey: randomKey('idem'),
  };

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Payment ${encodeJson(credential)}`);
  const second = await fetch(url, { ...init, headers });

  let receipt: MppReceipt | undefined;
  const receiptHeader = second.headers.get('Payment-Receipt');
  if (receiptHeader) {
    try {
      const json = decodeURIComponent(
        escape(atob(receiptHeader.replace(/-/g, '+').replace(/_/g, '/'))),
      );
      receipt = JSON.parse(json) as MppReceipt;
    } catch {
      receipt = undefined;
    }
  }

  const data = (await second.json().catch(() => ({}))) as PaidJoinResult;
  if (!second.ok || data.ok === false) {
    return { ok: false, error: data.error ?? `HTTP ${second.status}` };
  }
  return { ...data, ok: true, receipt };
}

export async function fundWallet(apiBase: string, address: string, label?: string): Promise<void> {
  await fetch(`${apiBase}/faucet`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, label }),
  }).catch(() => undefined);
}
