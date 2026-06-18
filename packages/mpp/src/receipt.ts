import { canonicalize, sha256Hex } from './encoding';
import type { MppReceipt } from './types';

/** The canonical "core" of a receipt that the receiptHash commits to. */
export function receiptCore(receipt: MppReceipt) {
  return {
    challengeId: receipt.challengeId,
    method: receipt.method,
    intent: receipt.intent,
    reference: receipt.reference,
    settlement: receipt.settlement,
    status: receipt.status,
    timestamp: receipt.timestamp,
    source: receipt.source,
    recipient: receipt.recipient,
  };
}

/** Recompute a receipt's hash (sha256 of the canonical core) for verification. */
export function computeReceiptHash(receipt: MppReceipt): string {
  return sha256Hex(canonicalize(receiptCore(receipt)));
}

/** True if the receipt's stored hash matches a fresh recomputation. */
export function isReceiptHashValid(receipt: MppReceipt): boolean {
  return computeReceiptHash(receipt) === receipt.receiptHash;
}
