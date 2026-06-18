import { newId } from '@table402/shared';
import { signMessage, type MppIdentity } from './identity';
import { chargeSigningMessage, sessionSigningMessage } from './signing';
import type { MppChallenge, MppCredential, SessionAuthorization } from './types';

/** Sign a challenge to produce a payment credential (the `Authorization: Payment` body). */
export async function createCredential(
  identity: MppIdentity,
  challenge: MppChallenge,
  idempotencyKey?: string,
): Promise<MppCredential> {
  const message = chargeSigningMessage(challenge);
  const signature = await signMessage(identity.privateKey, message);
  return {
    challenge,
    source: identity.did,
    payload: { type: 'transaction', signature, signedMessage: message },
    idempotencyKey: idempotencyKey ?? newId('idem'),
  };
}

export interface SessionTermInput {
  recipient: string;
  currency: string;
  deposit: string;
  maxDeposit: string;
}

/** Sign the terms to authorize opening a payment session/channel. */
export async function createSessionAuthorization(
  identity: MppIdentity,
  terms: SessionTermInput,
): Promise<SessionAuthorization> {
  const partial = {
    source: identity.did,
    recipient: terms.recipient,
    currency: terms.currency,
    deposit: terms.deposit,
    maxDeposit: terms.maxDeposit,
    nonce: newId('snonce'),
  };
  const signature = await signMessage(identity.privateKey, sessionSigningMessage(partial));
  return { ...partial, signature };
}
