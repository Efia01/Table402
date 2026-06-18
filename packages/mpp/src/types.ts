import { z } from 'zod';

/**
 * Wire types modelled directly on the Machine Payments Protocol (mpp.dev).
 * Amounts are **strings of atomic units** as required by the spec.
 */

export const PaymentIntent = z.enum(['charge', 'session']);
export type PaymentIntent = z.infer<typeof PaymentIntent>;

/** Decoded `request` object carried (base64url) inside the challenge. */
export const ChargeRequest = z.object({
  amount: z.string(),
  currency: z.string(),
  recipient: z.string(),
});
export type ChargeRequest = z.infer<typeof ChargeRequest>;

export const MppChallenge = z.object({
  id: z.string(),
  nonce: z.string(),
  realm: z.string(),
  method: z.string(),
  intent: PaymentIntent,
  expires: z.string(),
  description: z.string().optional(),
  request: ChargeRequest,
  /** base64url server-correlation data (opaque to clients). */
  opaque: z.string().optional(),
  /** HMAC over the canonical challenge terms — lets the server detect tampering. */
  binding: z.string(),
});
export type MppChallenge = z.infer<typeof MppChallenge>;

export const PaymentPayload = z.object({
  type: z.enum(['transaction', 'hash', 'proof']),
  signature: z.string(),
  /** The exact canonical message that was signed (transparency / debugging). */
  signedMessage: z.string().optional(),
});
export type PaymentPayload = z.infer<typeof PaymentPayload>;

export const MppCredential = z.object({
  challenge: MppChallenge,
  /** did:pkh:eip155:<chainId>:<address> of the payer. */
  source: z.string(),
  payload: PaymentPayload,
  idempotencyKey: z.string().optional(),
});
export type MppCredential = z.infer<typeof MppCredential>;

export const Settlement = z.object({
  amount: z.string(),
  currency: z.string(),
});
export type Settlement = z.infer<typeof Settlement>;

export const MppReceipt = z.object({
  challengeId: z.string(),
  method: z.string(),
  intent: PaymentIntent,
  reference: z.string(),
  settlement: Settlement,
  status: z.literal('success'),
  timestamp: z.string(),
  receiptHash: z.string(),
  idempotencyKey: z.string(),
  /** Convenience metadata (not part of the hashed core). */
  source: z.string(),
  recipient: z.string(),
  /** Session-only extras. */
  channelId: z.string().optional(),
  spent: z.string().optional(),
  acceptedCumulative: z.string().optional(),
  units: z.number().optional(),
  txHash: z.string().optional(),
});
export type MppReceipt = z.infer<typeof MppReceipt>;

export const MppSession = z.object({
  id: z.string(),
  source: z.string(),
  recipient: z.string(),
  currency: z.string(),
  deposit: z.string(),
  maxDeposit: z.string(),
  spent: z.string(),
  acceptedCumulative: z.string(),
  units: z.number(),
  status: z.enum(['open', 'closed']),
  openedAt: z.string(),
  closedAt: z.string().optional(),
});
export type MppSession = z.infer<typeof MppSession>;

/** Client-supplied authorization to open a session/channel. */
export const SessionAuthorization = z.object({
  source: z.string(),
  recipient: z.string(),
  currency: z.string(),
  deposit: z.string(),
  maxDeposit: z.string(),
  nonce: z.string(),
  signature: z.string(),
});
export type SessionAuthorization = z.infer<typeof SessionAuthorization>;

/** RFC 9457 problem+json. */
export interface MppProblem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  code?: string;
  challenge?: MppChallenge;
}

export const PROBLEM_BASE = 'https://paymentauth.org/problems/';

export type ProblemCode =
  | 'payment-required'
  | 'payment-insufficient'
  | 'payment-expired'
  | 'verification-failed'
  | 'method-unsupported'
  | 'malformed-credential'
  | 'invalid-challenge'
  | 'budget-exceeded';

export class MppError extends Error {
  code: ProblemCode;
  status: number;
  constructor(code: ProblemCode, status: number, detail: string) {
    super(detail);
    this.name = 'MppError';
    this.code = code;
    this.status = status;
  }
  toProblem(challenge?: MppChallenge): MppProblem {
    return {
      type: `${PROBLEM_BASE}${this.code}`,
      title: this.code
        .split('-')
        .map((w) => w[0]!.toUpperCase() + w.slice(1))
        .join(' '),
      status: this.status,
      detail: this.message,
      code: this.code,
      challenge,
    };
  }
}
