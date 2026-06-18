import type { Card } from './cards';
import type { HandRank } from './evaluator';

export type Street = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'complete';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in' | 'post-blind';
export type SeatStatus = 'active' | 'folded' | 'all-in';

/**
 * A seat *within a hand*. `index` is the seat's position among the participating
 * players (0..n-1, ordered by table seat). `playerId` ties it back to an agent.
 */
export interface PlayerSeat {
  index: number;
  playerId: string;
  name: string;
  stack: number;
  holeCards: Card[];
  status: SeatStatus;
  committedRound: number;
  committedHand: number;
  hasActedThisRound: boolean;
}

export interface Action {
  seat: number;
  playerId: string;
  type: ActionType;
  /** bet/raise: total bet-to amount; call: chips called; post-blind: blind size. */
  amount: number;
  street: Street;
  seq: number;
}

export interface PotAward {
  amount: number;
  winners: Array<{ seat: number; playerId: string; amount: number }>;
  eligible: number[];
  contested: boolean;
}

export interface ShowdownEntry {
  seat: number;
  playerId: string;
  holeCards: Card[];
  hand?: HandRank;
  folded: boolean;
}

export interface HandResult {
  pots: PotAward[];
  showdown: ShowdownEntry[];
  board: Card[];
  /** seat index -> net chips won (gross award; does not subtract contributions). */
  payouts: Record<number, number>;
  winningSeats: number[];
}

export interface SeatConfig {
  index: number;
  playerId: string;
  name: string;
  stack: number;
}

export interface HandConfig {
  handId: string;
  seed: string;
  /** Button position among participants (0..n-1). */
  button: number;
  smallBlind: number;
  bigBlind: number;
  seats: SeatConfig[];
}

export interface GameState {
  handId: string;
  seed: string;
  street: Street;
  button: number;
  smallBlind: number;
  bigBlind: number;
  seats: PlayerSeat[];
  deck: Card[];
  board: Card[];
  pot: number;
  currentBet: number;
  minRaise: number;
  lastAggressor: number | null;
  toAct: number | null;
  actions: Action[];
  result?: HandResult;
}

export interface LegalActions {
  seat: number | null;
  types: ActionType[];
  callAmount: number;
  minRaiseTo: number;
  maxRaiseTo: number;
}

/** A compact, replayable record of a completed hand. */
export interface HandHistory {
  handId: string;
  seed: string;
  button: number;
  smallBlind: number;
  bigBlind: number;
  seats: SeatConfig[];
  actions: Array<{ seat: number; type: ActionType; amount: number; street: Street }>;
  board: string[];
  result: {
    winningSeats: number[];
    payouts: Record<number, number>;
    showdown: Array<{ seat: number; holeCards: string[]; handName?: string }>;
  };
}
