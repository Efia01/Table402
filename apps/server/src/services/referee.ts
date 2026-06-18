import type { FastifyInstance } from 'fastify';
import { SERVICE_FEES, SERVICE_IDS } from '@table402/shared';
import { cardsToStrings, replayHand, type HandHistory } from '@table402/poker';
import type { AppContext } from '../core/context';
import { registerPaidService } from './paid-service';

interface ValidateBody {
  handId?: string;
  handHistory: HandHistory;
}

/** Independently re-derive the hand from its seed + actions and confirm the outcome. */
export function validateHandHistory(history: HandHistory): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // 1. No duplicate cards across all hole cards + the board.
  const allCards = [...history.result.showdown.flatMap((s) => s.holeCards), ...history.board];
  const seen = new Set<string>();
  for (const card of allCards) {
    if (seen.has(card)) errors.push(`duplicate card dealt: ${card}`);
    seen.add(card);
  }

  // 2. Deterministic replay must reproduce the same board and payouts.
  try {
    const replayed = replayHand(history);
    if (replayed.street !== 'complete') errors.push('replay did not reach completion');
    const replayBoard = cardsToStrings(replayed.board);
    if (JSON.stringify(replayBoard) !== JSON.stringify(history.board)) {
      errors.push('board does not match on independent replay');
    }
    if (JSON.stringify(replayed.result?.payouts ?? {}) !== JSON.stringify(history.result.payouts)) {
      errors.push('payouts do not match on independent replay');
    }
    const replayWinners = [...(replayed.result?.winningSeats ?? [])].sort();
    const claimedWinners = [...history.result.winningSeats].sort();
    if (JSON.stringify(replayWinners) !== JSON.stringify(claimedWinners)) {
      errors.push('winners do not match on independent replay');
    }
  } catch (err) {
    errors.push(`replay failed: ${(err as Error).message}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Referee service. After showdown the table buys an independent validation of the
 * completed hand. POST /services/referee/validate -> 402 -> pay -> { valid, errors }.
 */
export function registerRefereeService(app: FastifyInstance, ctx: AppContext): void {
  registerPaidService<ValidateBody, { valid: boolean; errors: string[] }>(app, ctx, {
    path: '/services/referee/validate',
    service: 'referee',
    providerId: SERVICE_IDS.referee,
    walletId: SERVICE_IDS.referee,
    fee: SERVICE_FEES.referee,
    description: 'Independent validation of a completed poker hand',
    handle: async (body) => {
      if (!body.handHistory) {
        return { result: { valid: false, errors: ['no hand history supplied'] }, handId: body.handId ?? null };
      }
      const verdict = validateHandHistory(body.handHistory);
      return { result: verdict, handId: body.handId ?? null };
    },
  });
}
