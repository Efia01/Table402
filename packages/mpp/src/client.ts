import { decodeJson, encodeJson } from './encoding';
import { parseWwwAuthenticate } from './headers';
import { createCredential, createSessionAuthorization, type SessionTermInput } from './credential';
import type { MppIdentity } from './identity';
import { MppChallenge, MppError, type MppReceipt, type SessionAuthorization } from './types';

export interface MppClientOptions {
  identity: MppIdentity;
  fetchImpl?: typeof fetch;
  /** Global per-charge budget cap (atomic units). A 402 above this is rejected unpaid. */
  maxAmount?: number;
  onReceipt?: (receipt: MppReceipt, info: { url: string }) => void;
  onChallenge?: (challenge: MppChallenge, info: { url: string }) => void;
}

export interface FetchResult {
  response: Response;
  receipt?: MppReceipt;
  challenge?: MppChallenge;
  paid: boolean;
}

/**
 * The payer side. `fetch()` performs the full MPP dance: request -> 402 ->
 * sign credential (real viem signature) -> retry -> capture the receipt.
 * Enforces budget caps before paying.
 */
export class MppClient {
  readonly identity: MppIdentity;
  private fetchImpl: typeof fetch;
  private maxAmount?: number;
  private onReceipt?: MppClientOptions['onReceipt'];
  private onChallenge?: MppClientOptions['onChallenge'];

  constructor(opts: MppClientOptions) {
    this.identity = opts.identity;
    this.fetchImpl = opts.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.maxAmount = opts.maxAmount;
    this.onReceipt = opts.onReceipt;
    this.onChallenge = opts.onChallenge;
  }

  async fetch(
    url: string,
    init?: RequestInit,
    opts?: { maxAmount?: number },
  ): Promise<FetchResult> {
    const first = await this.fetchImpl(url, init);
    if (first.status !== 402) {
      return { response: first, paid: false };
    }

    const challenge = await parseChallenge(first);
    if (!challenge) {
      throw new MppError('invalid-challenge', 402, `Could not parse 402 challenge from ${url}`);
    }
    this.onChallenge?.(challenge, { url });

    const amount = Number(challenge.request.amount);
    const cap = opts?.maxAmount ?? this.maxAmount;
    if (cap != null && amount > cap) {
      throw new MppError(
        'budget-exceeded',
        402,
        `Charge of ${amount} exceeds budget cap ${cap} for ${url}`,
      );
    }

    const credential = await createCredential(this.identity, challenge);
    const headers = new Headers(init?.headers);
    headers.set('Authorization', `Payment ${encodeJson(credential)}`);
    const second = await this.fetchImpl(url, { ...init, headers });

    let receipt: MppReceipt | undefined;
    const receiptHeader = second.headers.get('Payment-Receipt');
    if (receiptHeader) {
      try {
        receipt = decodeJson<MppReceipt>(receiptHeader);
      } catch {
        receipt = undefined;
      }
    }
    if (receipt) this.onReceipt?.(receipt, { url });
    return { response: second, receipt, challenge, paid: true };
  }

  /** Convenience: fetch + parse JSON body of the (paid) response. */
  async fetchJson<T = unknown>(
    url: string,
    init?: RequestInit,
    opts?: { maxAmount?: number },
  ): Promise<{ data: T; receipt?: MppReceipt; status: number }> {
    const result = await this.fetch(url, init, opts);
    const data = (await result.response.json()) as T;
    return { data, receipt: result.receipt, status: result.response.status };
  }

  createSessionAuthorization(terms: SessionTermInput): Promise<SessionAuthorization> {
    return createSessionAuthorization(this.identity, terms);
  }
}

async function parseChallenge(res: Response): Promise<MppChallenge | null> {
  const header = res.headers.get('WWW-Authenticate');
  if (header) {
    const fromHeader = parseWwwAuthenticate(header);
    if (fromHeader && fromHeader.binding) return fromHeader;
  }
  try {
    const body = (await res.clone().json()) as { challenge?: unknown };
    if (body && body.challenge) return MppChallenge.parse(body.challenge);
  } catch {
    /* ignore */
  }
  return null;
}
