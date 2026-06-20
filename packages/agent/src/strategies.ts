import { cardsFromStrings, evaluateBest } from '@table402/poker';
import type { Archetype } from '@table402/shared';

export interface AgentView {
  isInHand: boolean;
  isTurn: boolean;
  handId: string | null;
  holeCards: string[];
  board: string[];
  street: string;
  pot: number;
  currentBet: number;
  toCall: number;
  stack: number;
  /** Server-set epoch ms when this seat is expected to act — paces to match the UI ring. */
  turnEndsAt?: number | null;
  legal: { types: string[]; callAmount: number; minRaiseTo: number; maxRaiseTo: number };
}

export interface Decision {
  type: string;
  amount?: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function preflopStrength(holeCards: string[]): number {
  const cards = cardsFromStrings(holeCards);
  const a = cards[0]!;
  const b = cards[1]!;
  const hi = Math.max(a.rank, b.rank);
  const lo = Math.min(a.rank, b.rank);
  let s = (hi + lo) / 30;
  if (a.rank === b.rank) s += 0.34;
  if (a.suit === b.suit) s += 0.07;
  if (hi >= 13) s += 0.08;
  if (hi - lo === 1) s += 0.04;
  return Math.min(1, s);
}

/** A rough 0..1 hand-strength estimate from the agent's private view. */
export function handStrength(view: AgentView): number {
  if (view.board.length === 0) return preflopStrength(view.holeCards);
  const hr = evaluateBest(cardsFromStrings([...view.holeCards, ...view.board]));
  return Math.min(1, hr.category / 8 + 0.04);
}

function passive(view: AgentView): Decision {
  if (view.legal.types.includes('check')) return { type: 'check' };
  if (view.legal.types.includes('call')) return { type: 'call' };
  return { type: 'fold' };
}

function foldOrCheck(view: AgentView): Decision {
  return view.legal.types.includes('check') ? { type: 'check' } : { type: 'fold' };
}

function aggressive(view: AgentView, sizeFraction: number): Decision {
  const { legal } = view;
  if (legal.types.includes('raise') || legal.types.includes('bet')) {
    const type = legal.types.includes('raise') ? 'raise' : 'bet';
    const span = legal.maxRaiseTo - legal.minRaiseTo;
    const target = Math.round(legal.minRaiseTo + Math.min(span, view.pot * sizeFraction));
    return { type, amount: clamp(target, legal.minRaiseTo, legal.maxRaiseTo) };
  }
  return passive(view);
}

function weightedPick<T>(items: T[], weights: number[]): T {
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

function tight(view: AgentView): Decision {
  const s = handStrength(view);
  if (s < 0.46) return foldOrCheck(view);
  if (s < 0.72) return passive(view);
  return Math.random() < 0.6 ? aggressive(view, 0.4) : passive(view);
}

function aggro(view: AgentView): Decision {
  const s = handStrength(view);
  if (s < 0.26) {
    if (Math.random() < 0.32) return aggressive(view, 0.6); // bluff
    return foldOrCheck(view);
  }
  return Math.random() < 0.7 ? aggressive(view, 0.7) : passive(view);
}

function budget(view: AgentView): Decision {
  const s = handStrength(view);
  if (view.legal.types.includes('check')) {
    return s > 0.8 && Math.random() < 0.35 ? aggressive(view, 0.2) : { type: 'check' };
  }
  return s > 0.64 ? { type: 'call' } : { type: 'fold' };
}

function random(view: AgentView): Decision {
  const types = view.legal.types;
  if (types.length === 0) return { type: 'check' };
  const weight = (t: string): number =>
    ({ fold: 1, check: 3, call: 3, bet: 1.5, raise: 1.5, 'all-in': 0.3 })[t] ?? 1;
  const pick = weightedPick(types, types.map(weight));
  if (pick === 'raise' || pick === 'bet') return aggressive(view, Math.random());
  return { type: pick };
}

/** Decide an action for the given archetype from its private view. */
export function decide(archetype: Archetype, view: AgentView): Decision {
  if (!view.isTurn || view.legal.types.length === 0) return { type: 'check' };
  switch (archetype) {
    case 'tight':
      return tight(view);
    case 'aggro':
      return aggro(view);
    case 'budget':
      return budget(view);
    default:
      return random(view);
  }
}
