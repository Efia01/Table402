import { shuffledDeck } from './rng';
import { compareHandRank, evaluateBest, type HandRank } from './evaluator';
import type {
  ActionType,
  GameState,
  HandConfig,
  LegalActions,
  PlayerSeat,
  PotAward,
  ShowdownEntry,
  Street,
} from './types';

const NEXT_STREET: Record<'preflop' | 'flop' | 'turn', Street> = {
  preflop: 'flop',
  flop: 'turn',
  turn: 'river',
};

function cloneState(state: GameState): GameState {
  return structuredClone(state);
}

/** Build a fresh hand: shuffle from seed, deal hole cards, post blinds. */
export function createHand(config: HandConfig): GameState {
  const n = config.seats.length;
  if (n < 2 || n > 6) throw new Error('Texas Hold’em requires 2–6 players');
  if (config.button < 0 || config.button >= n) throw new Error('Invalid button position');

  const deck = shuffledDeck(config.seed);
  const seats: PlayerSeat[] = config.seats.map((s, i) => ({
    index: i,
    playerId: s.playerId,
    name: s.name,
    stack: s.stack,
    holeCards: [],
    status: 'active',
    committedRound: 0,
    committedHand: 0,
    hasActedThisRound: false,
  }));

  // Deal two hole cards each, round-robin starting left of the button.
  for (let round = 0; round < 2; round++) {
    for (let k = 1; k <= n; k++) {
      const pos = (config.button + k) % n;
      seats[pos]!.holeCards.push(deck.shift()!);
    }
  }

  const state: GameState = {
    handId: config.handId,
    seed: config.seed,
    street: 'preflop',
    button: config.button,
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    seats,
    deck,
    board: [],
    pot: 0,
    currentBet: 0,
    minRaise: config.bigBlind,
    lastAggressor: null,
    toAct: null,
    actions: [],
  };

  postBlinds(state);
  return state;
}

function postBlinds(state: GameState): void {
  const n = state.seats.length;
  const sbPos = n === 2 ? state.button : (state.button + 1) % n;
  const bbPos = n === 2 ? (state.button + 1) % n : (state.button + 2) % n;
  postBlind(state, sbPos, state.smallBlind);
  postBlind(state, bbPos, state.bigBlind);
  state.currentBet = state.bigBlind;
  state.minRaise = state.bigBlind;
  state.lastAggressor = bbPos;
  const firstPos = n === 2 ? state.button : (state.button + 3) % n;
  state.toAct = nextSeatToAct(state, firstPos, true);
}

function postBlind(state: GameState, pos: number, blind: number): void {
  const seat = state.seats[pos]!;
  const amount = Math.min(blind, seat.stack);
  seat.stack -= amount;
  seat.committedRound += amount;
  seat.committedHand += amount;
  if (seat.stack === 0) seat.status = 'all-in';
  state.pot += amount;
  state.actions.push({
    seat: pos,
    playerId: seat.playerId,
    type: 'post-blind',
    amount,
    street: 'preflop',
    seq: state.actions.length,
  });
  seat.hasActedThisRound = false;
}

function needsToAct(state: GameState, seat: PlayerSeat): boolean {
  return !seat.hasActedThisRound || seat.committedRound < state.currentBet;
}

function nextSeatToAct(state: GameState, fromPos: number, inclusive: boolean): number | null {
  const n = state.seats.length;
  for (let step = inclusive ? 0 : 1; step <= n; step++) {
    const pos = (fromPos + step) % n;
    const seat = state.seats[pos]!;
    if (seat.status === 'active' && seat.stack > 0 && needsToAct(state, seat)) return pos;
  }
  return null;
}

export function seatToAct(state: GameState): PlayerSeat | null {
  return state.toAct == null ? null : state.seats[state.toAct]!;
}

export function legalActions(state: GameState): LegalActions {
  const pos = state.toAct;
  if (pos == null) return { seat: null, types: [], callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 };
  const seat = state.seats[pos]!;
  const toCall = Math.max(0, state.currentBet - seat.committedRound);
  const types: ActionType[] = ['fold'];
  if (toCall === 0) types.push('check');
  if (toCall > 0 && seat.stack > 0) types.push('call');
  const maxRaiseTo = seat.committedRound + seat.stack;
  const minRaiseTo = Math.min(
    state.currentBet > 0 ? state.currentBet + state.minRaise : state.bigBlind,
    maxRaiseTo,
  );
  if (seat.stack > toCall) {
    types.push(state.currentBet === 0 ? 'bet' : 'raise');
  }
  if (seat.stack > 0) types.push('all-in');
  return { seat: pos, types, callAmount: Math.min(toCall, seat.stack), minRaiseTo, maxRaiseTo };
}

export interface ActionInput {
  seat: number;
  type: ActionType;
  amount?: number;
}

export function validateAction(state: GameState, input: ActionInput): { ok: boolean; error?: string } {
  const legal = legalActions(state);
  if (legal.seat == null) return { ok: false, error: 'No seat is to act' };
  if (input.seat !== legal.seat) {
    return { ok: false, error: `It is seat ${legal.seat}'s turn, not seat ${input.seat}` };
  }
  if (!legal.types.includes(input.type)) {
    return { ok: false, error: `Action "${input.type}" is not legal here (legal: ${legal.types.join(', ')})` };
  }
  if (input.type === 'bet' || input.type === 'raise') {
    if (input.amount == null) return { ok: false, error: `${input.type} requires a target amount` };
    if (input.amount < legal.minRaiseTo) {
      return { ok: false, error: `${input.type} must be at least ${legal.minRaiseTo}` };
    }
    if (input.amount > legal.maxRaiseTo) {
      return { ok: false, error: `${input.type} cannot exceed ${legal.maxRaiseTo} (all-in)` };
    }
  }
  return { ok: true };
}

function commit(state: GameState, seat: PlayerSeat, amount: number): void {
  const amt = Math.min(amount, seat.stack);
  seat.stack -= amt;
  seat.committedRound += amt;
  seat.committedHand += amt;
  state.pot += amt;
}

function record(state: GameState, pos: number, type: ActionType, amount: number): void {
  state.actions.push({
    seat: pos,
    playerId: state.seats[pos]!.playerId,
    type,
    amount,
    street: state.street,
    seq: state.actions.length,
  });
}

/** Apply a validated action and return the resulting (new) state. Throws if illegal. */
export function applyAction(state: GameState, input: ActionInput): GameState {
  const v = validateAction(state, input);
  if (!v.ok) throw new Error(`Illegal action: ${v.error}`);

  const s = cloneState(state);
  const pos = input.seat;
  const seat = s.seats[pos]!;

  switch (input.type) {
    case 'fold':
      seat.status = 'folded';
      seat.hasActedThisRound = true;
      record(s, pos, 'fold', 0);
      break;
    case 'check':
      seat.hasActedThisRound = true;
      record(s, pos, 'check', 0);
      break;
    case 'call': {
      const toCall = Math.min(s.currentBet - seat.committedRound, seat.stack);
      commit(s, seat, toCall);
      seat.hasActedThisRound = true;
      if (seat.stack === 0) seat.status = 'all-in';
      record(s, pos, 'call', toCall);
      break;
    }
    default: {
      // bet | raise | all-in
      const target = input.type === 'all-in' ? seat.committedRound + seat.stack : input.amount!;
      commit(s, seat, target - seat.committedRound);
      seat.hasActedThisRound = true;
      if (seat.stack === 0) seat.status = 'all-in';
      record(s, pos, input.type, target);
      if (target > s.currentBet) {
        const raiseSize = target - s.currentBet;
        if (raiseSize >= s.minRaise) s.minRaise = raiseSize;
        s.currentBet = target;
        s.lastAggressor = pos;
        for (const other of s.seats) {
          if (other.index !== pos && other.status === 'active') other.hasActedThisRound = false;
        }
      }
      break;
    }
  }

  const contenders = s.seats.filter((x) => x.status !== 'folded');
  if (contenders.length === 1) {
    finishUncontested(s, contenders[0]!);
    return s;
  }

  const next = nextSeatToAct(s, pos, false);
  if (next == null) {
    advanceStreet(s);
  } else {
    s.toAct = next;
  }
  return s;
}

function resetRound(state: GameState): void {
  for (const seat of state.seats) {
    seat.committedRound = 0;
    seat.hasActedThisRound = false;
  }
  state.currentBet = 0;
  state.minRaise = state.bigBlind;
  state.lastAggressor = null;
}

function dealBoardFor(state: GameState, street: Street): void {
  state.deck.shift(); // burn
  const count = street === 'flop' ? 3 : 1;
  for (let i = 0; i < count; i++) state.board.push(state.deck.shift()!);
}

function advanceStreet(state: GameState): void {
  // Deal forward; if betting is impossible (everyone all-in), run the board out.
  while (true) {
    if (state.street === 'river') {
      goToShowdown(state);
      return;
    }
    const next = NEXT_STREET[state.street as 'preflop' | 'flop' | 'turn'];
    state.street = next;
    dealBoardFor(state, next);
    resetRound(state);
    const canAct = state.seats.filter((x) => x.status === 'active' && x.stack > 0);
    if (canAct.length >= 2) {
      const first = nextSeatToAct(state, state.button, false);
      if (first != null) {
        state.toAct = first;
        return;
      }
    }
    // Otherwise loop and deal the next street (all-in run-out).
  }
}

function buildPots(seats: PlayerSeat[]): Array<{ amount: number; eligible: number[] }> {
  const working = seats
    .map((s) => ({ seat: s.index, amount: s.committedHand, folded: s.status === 'folded' }))
    .filter((c) => c.amount > 0);

  const raw: Array<{ amount: number; eligible: number[] }> = [];
  while (working.some((c) => c.amount > 0)) {
    const positive = working.filter((c) => c.amount > 0);
    const minAmt = Math.min(...positive.map((c) => c.amount));
    let amount = 0;
    const eligible: number[] = [];
    for (const c of working) {
      if (c.amount > 0) {
        amount += minAmt;
        c.amount -= minAmt;
        if (!c.folded) eligible.push(c.seat);
      }
    }
    raw.push({ amount, eligible });
  }

  // Merge adjacent pots with identical eligibility for a cleaner pot list.
  const merged: Array<{ amount: number; eligible: number[] }> = [];
  for (const pot of raw) {
    const last = merged[merged.length - 1];
    if (last && sameSet(last.eligible, pot.eligible)) last.amount += pot.amount;
    else merged.push({ amount: pot.amount, eligible: pot.eligible.slice() });
  }
  return merged;
}

function sameSet(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((x) => set.has(x));
}

function distributePot(
  amount: number,
  winners: number[],
  state: GameState,
  payouts: Record<number, number>,
  awards: PotAward[],
  eligible: number[],
): void {
  if (winners.length === 0) return;
  const ordered = winners.slice().sort((a, b) => a - b);
  const share = Math.floor(amount / ordered.length);
  let remainder = amount - share * ordered.length;
  const winnerRecords = ordered.map((idx) => {
    let won = share;
    if (remainder > 0) {
      won += 1;
      remainder -= 1;
    }
    state.seats[idx]!.stack += won;
    payouts[idx] = (payouts[idx] ?? 0) + won;
    return { seat: idx, playerId: state.seats[idx]!.playerId, amount: won };
  });
  awards.push({ amount, winners: winnerRecords, eligible: eligible.slice(), contested: eligible.length > 1 });
}

function goToShowdown(state: GameState): void {
  state.street = 'showdown';
  const pots = buildPots(state.seats);
  const evals = new Map<number, HandRank>();
  for (const seat of state.seats) {
    if (seat.status !== 'folded') {
      evals.set(seat.index, evaluateBest([...seat.holeCards, ...state.board]));
    }
  }

  const awards: PotAward[] = [];
  const payouts: Record<number, number> = {};
  for (const pot of pots) {
    const eligible = pot.eligible.filter((idx) => evals.has(idx));
    let best: HandRank | null = null;
    let winners: number[] = [];
    for (const idx of eligible) {
      const hr = evals.get(idx)!;
      const cmp = best ? compareHandRank(hr, best) : 1;
      if (cmp > 0) {
        best = hr;
        winners = [idx];
      } else if (cmp === 0) {
        winners.push(idx);
      }
    }
    distributePot(pot.amount, winners, state, payouts, awards, eligible);
  }

  const showdown: ShowdownEntry[] = state.seats.map((seat) => ({
    seat: seat.index,
    playerId: seat.playerId,
    holeCards: seat.holeCards,
    hand: seat.status !== 'folded' ? evals.get(seat.index) : undefined,
    folded: seat.status === 'folded',
  }));
  finalize(state, awards, showdown, payouts);
}

function finishUncontested(state: GameState, winner: PlayerSeat): void {
  const total = state.seats.reduce((sum, x) => sum + x.committedHand, 0);
  winner.stack += total;
  const payouts: Record<number, number> = { [winner.index]: total };
  const awards: PotAward[] = [
    {
      amount: total,
      winners: [{ seat: winner.index, playerId: winner.playerId, amount: total }],
      eligible: [winner.index],
      contested: false,
    },
  ];
  const showdown: ShowdownEntry[] = state.seats.map((seat) => ({
    seat: seat.index,
    playerId: seat.playerId,
    holeCards: seat.holeCards,
    hand: undefined,
    folded: seat.status === 'folded',
  }));
  finalize(state, awards, showdown, payouts);
}

function finalize(
  state: GameState,
  awards: PotAward[],
  showdown: ShowdownEntry[],
  payouts: Record<number, number>,
): void {
  state.street = 'complete';
  state.toAct = null;
  state.currentBet = 0;
  const winningSeats = [...new Set(awards.flatMap((a) => a.winners.map((w) => w.seat)))];
  state.result = { pots: awards, showdown, board: state.board, payouts, winningSeats };
}

export function isHandComplete(state: GameState): boolean {
  return state.street === 'complete';
}
