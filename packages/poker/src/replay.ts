import { cardsToStrings } from './cards';
import { applyAction, createHand } from './engine';
import type { GameState, HandConfig, HandHistory } from './types';

/** Build a compact, replayable history from a completed hand + its initial config. */
export function buildHandHistory(config: HandConfig, state: GameState): HandHistory {
  if (state.street !== 'complete' || !state.result) {
    throw new Error('Cannot build history: hand is not complete');
  }
  return {
    handId: config.handId,
    seed: config.seed,
    button: config.button,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    seats: config.seats.map((s) => ({ ...s })),
    actions: state.actions.map((a) => ({
      seat: a.seat,
      type: a.type,
      amount: a.amount,
      street: a.street,
    })),
    board: cardsToStrings(state.board),
    result: {
      winningSeats: state.result.winningSeats,
      payouts: state.result.payouts,
      showdown: state.result.showdown.map((e) => ({
        seat: e.seat,
        holeCards: cardsToStrings(e.holeCards),
        handName: e.hand?.name,
      })),
    },
  };
}

/** Deterministically re-run a hand from its history. Re-validates every action. */
export function replayHand(history: HandHistory): GameState {
  let state = createHand({
    handId: history.handId,
    seed: history.seed,
    button: history.button,
    smallBlind: history.smallBlind,
    bigBlind: history.bigBlind,
    seats: history.seats,
  });
  for (const action of history.actions) {
    if (action.type === 'post-blind') continue; // posted automatically by createHand
    state = applyAction(state, { seat: action.seat, type: action.type, amount: action.amount });
  }
  return state;
}
