import { describe, expect, it } from 'vitest';
import {
  applyAction,
  buildHandHistory,
  cardFromString,
  cardId,
  cardsFromStrings,
  cardToString,
  compareHandRank,
  createHand,
  evaluateBest,
  HandCategory,
  legalActions,
  makeDeck,
  replayHand,
  shuffledDeck,
  type GameState,
  type HandConfig,
} from './index';

function best(strings: string[]) {
  return evaluateBest(cardsFromStrings(strings));
}

function seats(stacks: number[]) {
  return stacks.map((stack, i) => ({
    index: i,
    playerId: `p${i}`,
    name: `Player ${i}`,
    stack,
  }));
}

function autoPlayPassive(state: GameState): GameState {
  let s = state;
  let guard = 0;
  while (s.street !== 'complete' && guard++ < 500) {
    const legal = legalActions(s);
    if (legal.seat == null) break;
    if (legal.types.includes('check')) s = applyAction(s, { seat: legal.seat, type: 'check' });
    else if (legal.types.includes('call')) s = applyAction(s, { seat: legal.seat, type: 'call' });
    else s = applyAction(s, { seat: legal.seat, type: 'fold' });
  }
  return s;
}

describe('deck integrity', () => {
  it('builds a full 52-card deck with no duplicates', () => {
    const deck = makeDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardId)).size).toBe(52);
  });

  it('round-trips card string encoding', () => {
    for (const card of makeDeck()) {
      expect(cardFromString(cardToString(card))).toEqual(card);
    }
  });

  it('shuffles deterministically from a seed (same seed -> same order)', () => {
    const a = shuffledDeck('hand-seed-001').map(cardToString);
    const b = shuffledDeck('hand-seed-001').map(cardToString);
    const c = shuffledDeck('hand-seed-002').map(cardToString);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBe(52); // still no duplicates
  });

  it('deals unique, non-overlapping hole cards', () => {
    const state = createHand({
      handId: 'h1',
      seed: 'deal-seed',
      button: 0,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([1000, 1000, 1000, 1000]),
    });
    const dealt = state.seats.flatMap((s) => s.holeCards.map(cardId));
    expect(dealt).toHaveLength(8);
    expect(new Set(dealt).size).toBe(8);
  });
});

describe('hand ranking', () => {
  it('orders categories strictly', () => {
    const straightFlush = best(['Ah', 'Kh', 'Qh', 'Jh', 'Th', '2c', '3d']);
    const quads = best(['9h', '9c', '9d', '9s', 'Kh', '2c', '3d']);
    const fullHouse = best(['Kh', 'Kc', 'Kd', '2s', '2h', '7c', '9d']);
    const flush = best(['Ah', 'Jh', '9h', '5h', '2h', 'Kc', 'Qd']);
    const straight = best(['Ts', '9h', '8c', '7d', '6s', '2c', 'Kh']);
    const trips = best(['8s', '8h', '8d', 'Kc', '4h', '2c', '9d']);
    const twoPair = best(['As', 'Ah', 'Kd', 'Kc', '4h', '2c', '9d']);
    const pair = best(['As', 'Ah', 'Kd', 'Qc', '4h', '2c', '9d']);
    const highCard = best(['As', 'Kh', 'Qd', 'Jc', '9h', '2c', '4d']);

    expect(straightFlush.category).toBe(HandCategory.StraightFlush);
    expect(quads.category).toBe(HandCategory.FourOfAKind);
    expect(fullHouse.category).toBe(HandCategory.FullHouse);
    expect(flush.category).toBe(HandCategory.Flush);
    expect(straight.category).toBe(HandCategory.Straight);
    expect(trips.category).toBe(HandCategory.ThreeOfAKind);
    expect(twoPair.category).toBe(HandCategory.TwoPair);
    expect(pair.category).toBe(HandCategory.Pair);
    expect(highCard.category).toBe(HandCategory.HighCard);

    const ordered = [highCard, pair, twoPair, trips, straight, flush, fullHouse, quads, straightFlush];
    for (let i = 1; i < ordered.length; i++) {
      expect(compareHandRank(ordered[i]!, ordered[i - 1]!)).toBeGreaterThan(0);
    }
  });

  it('recognizes the wheel (A-2-3-4-5) and ranks it below a 6-high straight', () => {
    const wheel = best(['Ah', '2c', '3d', '4s', '5h', 'Kc', 'Qd']);
    const sixHigh = best(['6c', '5h', '4d', '3s', '2c', 'Kh', 'Qd']);
    expect(wheel.category).toBe(HandCategory.Straight);
    expect(sixHigh.category).toBe(HandCategory.Straight);
    expect(compareHandRank(sixHigh, wheel)).toBeGreaterThan(0);
  });

  it('breaks flush ties by high card', () => {
    const aceHigh = best(['Ah', 'Kh', '9h', '5h', '2h', 'Kc', 'Qd']);
    const queenHigh = best(['Qh', 'Jh', '9h', '5h', '2h', 'Kc', 'Ad']);
    expect(compareHandRank(aceHigh, queenHigh)).toBeGreaterThan(0);
  });

  it('reports an exact tie as 0', () => {
    const a = best(['As', 'Kd', 'Qs', 'Jc', '9h', '2c', '3d']);
    const b = best(['Ad', 'Ks', 'Qh', 'Js', '9c', '2h', '4c']);
    expect(compareHandRank(a, b)).toBe(0);
  });
});

describe('hand setup + legal actions', () => {
  it('posts blinds and sets the first actor correctly (4-handed)', () => {
    const state = createHand({
      handId: 'h2',
      seed: 's',
      button: 0,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([1000, 1000, 1000, 1000]),
    });
    expect(state.seats[1]!.committedRound).toBe(5); // SB
    expect(state.seats[2]!.committedRound).toBe(10); // BB
    expect(state.pot).toBe(15);
    expect(state.currentBet).toBe(10);
    expect(state.toAct).toBe(3); // UTG = button + 3
    const legal = legalActions(state);
    expect(legal.types).toContain('fold');
    expect(legal.types).toContain('call');
    expect(legal.types).toContain('raise');
    expect(legal.types).not.toContain('check');
    expect(legal.callAmount).toBe(10);
    expect(legal.minRaiseTo).toBe(20);
  });

  it('rejects illegal actions', () => {
    const state = createHand({
      handId: 'h3',
      seed: 's',
      button: 0,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([1000, 1000, 1000, 1000]),
    });
    expect(() => applyAction(state, { seat: 0, type: 'check' })).toThrow(); // not seat 0's turn
    expect(() => applyAction(state, { seat: 3, type: 'check' })).toThrow(); // can't check facing a bet
    expect(() => applyAction(state, { seat: 3, type: 'raise', amount: 12 })).toThrow(); // below min raise
  });

  it('awards the pot uncontested when everyone folds to the big blind', () => {
    let state = createHand({
      handId: 'h4',
      seed: 's',
      button: 0,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([1000, 1000, 1000, 1000]),
    });
    state = applyAction(state, { seat: 3, type: 'fold' });
    state = applyAction(state, { seat: 0, type: 'fold' });
    state = applyAction(state, { seat: 1, type: 'fold' });
    expect(state.street).toBe('complete');
    expect(state.result?.winningSeats).toEqual([2]);
    expect(state.result?.payouts[2]).toBe(15);
  });
});

describe('side pots', () => {
  it('builds main + side pots from multiple all-ins and conserves chips', () => {
    let state = createHand({
      handId: 'h5',
      seed: 'sidepot-seed',
      button: 2,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([200, 40, 100]), // A=200, B=40 (BB), C=100
    });
    // SB = seat0 (A, 5), BB = seat1 (B, 10), UTG = seat2 (C).
    state = applyAction(state, { seat: 2, type: 'raise', amount: 100 }); // C all-in to 100
    state = applyAction(state, { seat: 0, type: 'call' }); // A calls to 100
    state = applyAction(state, { seat: 1, type: 'all-in' }); // B all-in for 40 total
    expect(state.street).toBe('complete');

    const pots = state.result!.pots;
    expect(pots).toHaveLength(2);
    expect(pots[0]!.amount).toBe(120); // 40 x 3 — everyone eligible
    expect(pots[0]!.eligible).toHaveLength(3);
    expect(pots[1]!.amount).toBe(120); // 60 x 2 — only A and C eligible
    expect(pots[1]!.eligible).toHaveLength(2);

    const totalChips = state.seats.reduce((sum, s) => sum + s.stack, 0);
    expect(totalChips).toBe(340); // 200 + 40 + 100, conserved
  });
});

describe('replay determinism', () => {
  it('replays a hand to an identical board, payouts, and winners', () => {
    const config: HandConfig = {
      handId: 'h6',
      seed: 'replay-seed-xyz',
      button: 1,
      smallBlind: 5,
      bigBlind: 10,
      seats: seats([1000, 1000, 1000, 1000, 1000, 1000]),
    };
    const original = autoPlayPassive(createHand(config));
    expect(original.street).toBe('complete');

    const history = buildHandHistory(config, original);
    const replayedA = replayHand(history);
    const replayedB = replayHand(history);

    expect(replayedA.board.map(cardToString)).toEqual(original.board.map(cardToString));
    expect(replayedA.result?.payouts).toEqual(original.result?.payouts);
    expect(replayedA.result?.winningSeats).toEqual(original.result?.winningSeats);
    expect(replayedB.board).toEqual(replayedA.board);
    expect(replayedB.result?.payouts).toEqual(replayedA.result?.payouts);
  });
});
