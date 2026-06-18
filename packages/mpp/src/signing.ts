import { canonicalize } from './encoding';
import type { MppChallenge } from './types';

/**
 * The exact canonical message a payer signs to authorize a charge. Binds the
 * signature to the precise payment terms (amount/currency/recipient + challenge
 * id/nonce), so a signature cannot be replayed against different terms.
 */
export function chargeSigningMessage(challenge: MppChallenge): string {
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

export interface SessionTerms {
  source: string;
  recipient: string;
  currency: string;
  deposit: string;
  maxDeposit: string;
  nonce: string;
}

/** The canonical message a payer signs to authorize opening a session/channel. */
export function sessionSigningMessage(terms: SessionTerms): string {
  return canonicalize({
    type: 'mpp-session-open',
    source: terms.source,
    recipient: terms.recipient,
    currency: terms.currency,
    deposit: terms.deposit,
    maxDeposit: terms.maxDeposit,
    nonce: terms.nonce,
  });
}
