import type { Card, Rank } from './cards';

export enum HandCategory {
  HighCard = 0,
  Pair = 1,
  TwoPair = 2,
  ThreeOfAKind = 3,
  Straight = 4,
  Flush = 5,
  FullHouse = 6,
  FourOfAKind = 7,
  StraightFlush = 8,
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  [HandCategory.HighCard]: 'High Card',
  [HandCategory.Pair]: 'Pair',
  [HandCategory.TwoPair]: 'Two Pair',
  [HandCategory.ThreeOfAKind]: 'Three of a Kind',
  [HandCategory.Straight]: 'Straight',
  [HandCategory.Flush]: 'Flush',
  [HandCategory.FullHouse]: 'Full House',
  [HandCategory.FourOfAKind]: 'Four of a Kind',
  [HandCategory.StraightFlush]: 'Straight Flush',
};

export interface HandValue {
  category: HandCategory;
  /** Tiebreak ranks, high -> low. */
  tiebreak: number[];
}

export interface HandRank extends HandValue {
  cards: Card[];
  name: string;
}

function detectStraightHigh(rankSet: Set<number>): number {
  for (let high = 14; high >= 6; high--) {
    let ok = true;
    for (let r = high; r > high - 5; r--) {
      if (!rankSet.has(r)) {
        ok = false;
        break;
      }
    }
    if (ok) return high;
  }
  // Wheel: A-2-3-4-5 (Ace plays low, straight high = 5).
  if (rankSet.has(14) && rankSet.has(2) && rankSet.has(3) && rankSet.has(4) && rankSet.has(5)) {
    return 5;
  }
  return 0;
}

/** Evaluate exactly five cards into a comparable hand value. */
export function evaluate5(cards: Card[]): HandValue {
  if (cards.length !== 5) throw new Error('evaluate5 requires exactly 5 cards');
  const ranks = cards.map((c) => c.rank).sort((a, b) => b - a);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);
  const rankSet = new Set<number>(ranks);
  const straightHigh = detectStraightHigh(rankSet);

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const top = groups[0]!;
  const second = groups[1];

  if (isFlush && straightHigh) return { category: HandCategory.StraightFlush, tiebreak: [straightHigh] };
  if (top[1] === 4) {
    const kicker = groups.find((g) => g[1] === 1)![0];
    return { category: HandCategory.FourOfAKind, tiebreak: [top[0], kicker] };
  }
  if (top[1] === 3 && second && second[1] === 2) {
    return { category: HandCategory.FullHouse, tiebreak: [top[0], second[0]] };
  }
  if (isFlush) return { category: HandCategory.Flush, tiebreak: ranks };
  if (straightHigh) return { category: HandCategory.Straight, tiebreak: [straightHigh] };
  if (top[1] === 3) {
    const kickers = groups
      .filter((g) => g[1] === 1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return { category: HandCategory.ThreeOfAKind, tiebreak: [top[0], ...kickers] };
  }
  if (top[1] === 2 && second && second[1] === 2) {
    const pairs = [top[0], second[0]].sort((a, b) => b - a);
    const kicker = groups.find((g) => g[1] === 1)![0];
    return { category: HandCategory.TwoPair, tiebreak: [...pairs, kicker] };
  }
  if (top[1] === 2) {
    const kickers = groups
      .filter((g) => g[1] === 1)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    return { category: HandCategory.Pair, tiebreak: [top[0], ...kickers] };
  }
  return { category: HandCategory.HighCard, tiebreak: ranks };
}

export function compareHandValue(a: HandValue, b: HandValue): number {
  if (a.category !== b.category) return a.category - b.category;
  const len = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < len; i++) {
    const x = a.tiebreak[i] ?? 0;
    const y = b.tiebreak[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

function* combinations<T>(items: T[], k: number): Generator<T[]> {
  const n = items.length;
  if (k > n) return;
  const idx = Array.from({ length: k }, (_, i) => i);
  while (true) {
    yield idx.map((i) => items[i]!);
    let i = k - 1;
    while (i >= 0 && idx[i] === i + n - k) i--;
    if (i < 0) return;
    idx[i]!++;
    for (let j = i + 1; j < k; j++) idx[j] = idx[j - 1]! + 1;
  }
}

/** Best 5-card hand from 5–7 cards (typically 2 hole + up to 5 board). */
export function evaluateBest(cards: Card[]): HandRank {
  if (cards.length < 5) throw new Error('evaluateBest requires at least 5 cards');
  let best: HandValue | null = null;
  let bestCards: Card[] = [];
  for (const combo of combinations(cards, 5)) {
    const value = evaluate5(combo);
    if (!best || compareHandValue(value, best) > 0) {
      best = value;
      bestCards = combo;
    }
  }
  return { ...best!, cards: bestCards, name: CATEGORY_NAMES[best!.category] };
}

export function compareHandRank(a: HandRank, b: HandRank): number {
  return compareHandValue(a, b);
}

/** Describe a hand value for commentary/UI, e.g. "Full House, Kings over Tens". */
export function describeHandValue(value: HandValue): string {
  const r = (n: number) => RANK_LABEL[n as Rank] ?? String(n);
  const t = value.tiebreak;
  switch (value.category) {
    case HandCategory.StraightFlush:
      return t[0] === 14 ? 'Royal Flush' : `Straight Flush, ${r(t[0]!)} high`;
    case HandCategory.FourOfAKind:
      return `Four of a Kind, ${r(t[0]!)}s`;
    case HandCategory.FullHouse:
      return `Full House, ${r(t[0]!)}s over ${r(t[1]!)}s`;
    case HandCategory.Flush:
      return `Flush, ${r(t[0]!)} high`;
    case HandCategory.Straight:
      return `Straight, ${r(t[0]!)} high`;
    case HandCategory.ThreeOfAKind:
      return `Three of a Kind, ${r(t[0]!)}s`;
    case HandCategory.TwoPair:
      return `Two Pair, ${r(t[0]!)}s and ${r(t[1]!)}s`;
    case HandCategory.Pair:
      return `Pair of ${r(t[0]!)}s`;
    default:
      return `${r(t[0]!)} high`;
  }
}

const RANK_LABEL: Record<Rank, string> = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};
