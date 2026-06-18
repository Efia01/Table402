import {
  amountFromWire,
  amountToWire,
  newId,
  nowIso,
  PAYMENT_METHOD,
  NETWORK,
  type FeeKind,
} from '@table402/shared';
import { canonicalize, encodeJson, hmacHex, sha256Hex } from './encoding';
import { computeReceiptHash } from './receipt';
import { didToAddress, verifySignature } from './identity';
import { chargeSigningMessage, sessionSigningMessage } from './signing';
import type { MppProvider } from './provider';
import {
  MppCredential,
  MppError,
  SessionAuthorization,
  type MppChallenge,
  type MppReceipt,
  type MppSession,
  type PaymentIntent,
} from './types';

export interface ChallengeRecord {
  challenge: MppChallenge;
  createdAt: string;
  used: boolean;
}

/** Single-use challenge + idempotency tracking. Defaults to in-memory. */
export interface ChallengeStore {
  put(record: ChallengeRecord): void;
  get(id: string): ChallengeRecord | undefined;
  markUsed(id: string): void;
  getReceiptByIdempotencyKey(key: string): MppReceipt | undefined;
  saveReceipt(key: string, receipt: MppReceipt): void;
}

class InMemoryChallengeStore implements ChallengeStore {
  private challenges = new Map<string, ChallengeRecord>();
  private receipts = new Map<string, MppReceipt>();
  put(record: ChallengeRecord): void {
    this.challenges.set(record.challenge.id, record);
  }
  get(id: string): ChallengeRecord | undefined {
    return this.challenges.get(id);
  }
  markUsed(id: string): void {
    const r = this.challenges.get(id);
    if (r) r.used = true;
  }
  getReceiptByIdempotencyKey(key: string): MppReceipt | undefined {
    return this.receipts.get(key);
  }
  saveReceipt(key: string, receipt: MppReceipt): void {
    this.receipts.set(key, receipt);
  }
}

/** Metadata carried alongside a payment for persistence + the receipt graph. */
export interface PaymentMeta {
  kind?: FeeKind;
  handId?: string;
  service?: string;
  unlocks?: string;
  fromId?: string;
  fromLabel?: string;
  toId?: string;
  toLabel?: string;
}

export interface CreateChallengeArgs {
  intent?: PaymentIntent;
  amount: number;
  currency: string;
  recipient: string;
  description?: string;
  opaque?: Record<string, unknown>;
}

export interface MppServerOptions {
  secret: string;
  provider: MppProvider;
  realm?: string;
  method?: string;
  challengeTtlMs?: number;
  store?: ChallengeStore;
  onReceipt?: (receipt: MppReceipt, meta: PaymentMeta) => void;
}

/**
 * Issues 402 challenges, verifies credentials (binding + single-use + real
 * signature + settlement), and mints receipts. Also manages payment sessions.
 */
export class MppServer {
  readonly provider: MppProvider;
  readonly realm: string;
  readonly method: string;
  private secret: string;
  private ttlMs: number;
  private store: ChallengeStore;
  private onReceipt?: (receipt: MppReceipt, meta: PaymentMeta) => void;
  private sessions = new Map<string, MppSession>();

  constructor(opts: MppServerOptions) {
    this.provider = opts.provider;
    this.secret = opts.secret;
    this.realm = opts.realm ?? NETWORK.realm;
    this.method = opts.method ?? PAYMENT_METHOD;
    this.ttlMs = opts.challengeTtlMs ?? 5 * 60_000;
    this.store = opts.store ?? new InMemoryChallengeStore();
    this.onReceipt = opts.onReceipt;
  }

  private bindingFor(c: Omit<MppChallenge, 'binding'>): string {
    return hmacHex(
      this.secret,
      canonicalize({
        id: c.id,
        nonce: c.nonce,
        realm: c.realm,
        intent: c.intent,
        expires: c.expires,
        request: c.request,
      }),
    );
  }

  createChallenge(args: CreateChallengeArgs): MppChallenge {
    const base: Omit<MppChallenge, 'binding'> = {
      id: newId('ch'),
      nonce: newId('nonce'),
      realm: this.realm,
      method: this.method,
      intent: args.intent ?? 'charge',
      expires: new Date(Date.now() + this.ttlMs).toISOString(),
      description: args.description,
      request: {
        amount: amountToWire(args.amount),
        currency: args.currency,
        recipient: args.recipient,
      },
      opaque: args.opaque ? encodeJson(args.opaque) : undefined,
    };
    const challenge: MppChallenge = { ...base, binding: this.bindingFor(base) };
    this.store.put({ challenge, createdAt: nowIso(), used: false });
    return challenge;
  }

  private buildReceipt(args: {
    challengeId: string;
    intent: PaymentIntent;
    reference: string;
    amount: number;
    currency: string;
    source: string;
    recipient: string;
    idempotencyKey: string;
    txHash?: string;
    channelId?: string;
    spent?: string;
    acceptedCumulative?: string;
    units?: number;
  }): MppReceipt {
    const core = {
      challengeId: args.challengeId,
      method: this.method,
      intent: args.intent,
      reference: args.reference,
      settlement: { amount: amountToWire(args.amount), currency: args.currency },
      status: 'success' as const,
      timestamp: nowIso(),
      source: args.source,
      recipient: args.recipient,
    };
    const receiptHash = sha256Hex(canonicalize(core));
    return {
      ...core,
      receiptHash,
      idempotencyKey: args.idempotencyKey,
      txHash: args.txHash,
      channelId: args.channelId,
      spent: args.spent,
      acceptedCumulative: args.acceptedCumulative,
      units: args.units,
    };
  }

  /** Verify a credential against its echoed challenge, settle, and mint a receipt. */
  async verifyCredential(credential: unknown, meta: PaymentMeta = {}): Promise<MppReceipt> {
    const parsed = MppCredential.safeParse(credential);
    if (!parsed.success) {
      throw new MppError('malformed-credential', 400, 'Malformed payment credential');
    }
    const cred = parsed.data;
    const challenge = cred.challenge;

    if (cred.idempotencyKey) {
      const existing = this.store.getReceiptByIdempotencyKey(cred.idempotencyKey);
      if (existing) return existing;
    }

    if (this.bindingFor(challenge) !== challenge.binding) {
      throw new MppError('verification-failed', 402, 'Challenge binding mismatch — terms were tampered');
    }

    const record = this.store.get(challenge.id);
    if (!record) throw new MppError('invalid-challenge', 402, 'Unknown challenge');
    if (record.used) throw new MppError('invalid-challenge', 402, 'Challenge already used (single-use)');
    if (new Date(challenge.expires).getTime() < Date.now()) {
      throw new MppError('payment-expired', 402, 'Challenge expired');
    }

    const signer = didToAddress(cred.source);
    const message = chargeSigningMessage(challenge);
    const signatureOk = await verifySignature(signer, message, cred.payload.signature);
    if (!signatureOk) {
      throw new MppError('verification-failed', 402, 'Invalid payment signature');
    }

    const amount = amountFromWire(challenge.request.amount);
    const idempotencyKey = cred.idempotencyKey ?? newId('idem');
    const settle = this.provider.settleCharge({
      from: signer,
      to: challenge.request.recipient,
      currency: challenge.request.currency,
      amount,
      reference: challenge.id,
    });

    const receipt = this.buildReceipt({
      challengeId: challenge.id,
      intent: challenge.intent,
      reference: settle.reference,
      amount,
      currency: challenge.request.currency,
      source: cred.source,
      recipient: challenge.request.recipient,
      idempotencyKey,
      txHash: settle.txHash,
    });

    this.store.markUsed(challenge.id);
    this.store.saveReceipt(idempotencyKey, receipt);
    this.onReceipt?.(receipt, meta);
    return receipt;
  }

  // ---- Sessions (payment channels) ----

  async openSession(authorization: unknown): Promise<MppSession> {
    const parsed = SessionAuthorization.safeParse(authorization);
    if (!parsed.success) {
      throw new MppError('malformed-credential', 400, 'Malformed session authorization');
    }
    const auth = parsed.data;
    const signer = didToAddress(auth.source);
    const message = sessionSigningMessage(auth);
    const ok = await verifySignature(signer, message, auth.signature);
    if (!ok) throw new MppError('verification-failed', 402, 'Invalid session authorization signature');

    const channelId = newId('chan');
    this.provider.openChannel({
      channelId,
      from: signer,
      to: auth.recipient,
      currency: auth.currency,
      deposit: amountFromWire(auth.deposit),
    });
    const session: MppSession = {
      id: channelId,
      source: auth.source,
      recipient: auth.recipient,
      currency: auth.currency,
      deposit: auth.deposit,
      maxDeposit: auth.maxDeposit,
      spent: '0',
      acceptedCumulative: '0',
      units: 0,
      status: 'open',
      openedAt: nowIso(),
    };
    this.sessions.set(channelId, session);
    return session;
  }

  /** Server-initiated voucher debit, authorized by the open session's escrow. */
  debitSession(args: { channelId: string; amount: number; reference?: string; meta?: PaymentMeta }): MppReceipt {
    const session = this.sessions.get(args.channelId);
    if (!session || session.status !== 'open') {
      throw new MppError('invalid-challenge', 409, 'Session is not open');
    }
    const reference = args.reference ?? newId('vch');
    const settle = this.provider.settleVoucher({ channelId: args.channelId, amount: args.amount, reference });
    const newSpent = amountFromWire(session.spent) + args.amount;
    session.spent = String(newSpent);
    session.acceptedCumulative = String(newSpent);
    session.units += 1;

    const receipt = this.buildReceipt({
      challengeId: reference,
      intent: 'session',
      reference: settle.reference,
      amount: args.amount,
      currency: session.currency,
      source: session.source,
      recipient: session.recipient,
      idempotencyKey: newId('idem'),
      txHash: settle.txHash,
      channelId: args.channelId,
      spent: session.spent,
      acceptedCumulative: session.acceptedCumulative,
      units: session.units,
    });
    this.onReceipt?.(receipt, args.meta ?? {});
    return receipt;
  }

  closeSession(channelId: string): MppSession | undefined {
    const session = this.sessions.get(channelId);
    if (!session) return undefined;
    if (session.status === 'closed') return session;
    this.provider.closeChannel(channelId);
    session.status = 'closed';
    session.closedAt = nowIso();
    return session;
  }

  getSession(channelId: string): MppSession | undefined {
    return this.sessions.get(channelId);
  }

  /** Recompute a receipt's hash to confirm integrity (used by receipt-graph verify). */
  recomputeReceiptHash(receipt: MppReceipt): string {
    return computeReceiptHash(receipt);
  }
}
