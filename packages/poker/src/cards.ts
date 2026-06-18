export type Suit = 'c' | 'd' | 'h' | 's';
/** 11 = J, 12 = Q, 13 = K, 14 = A. */
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ['c', 'd', 'h', 's'];
export const RANKS: readonly Rank[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

const RANK_TO_CHAR: Record<Rank, string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: 'T',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};
const CHAR_TO_RANK: Record<string, Rank> = Object.fromEntries(
  Object.entries(RANK_TO_CHAR).map(([r, c]) => [c, Number(r) as Rank]),
) as Record<string, Rank>;

const SUIT_NAMES: Record<Suit, string> = { c: 'clubs', d: 'diamonds', h: 'hearts', s: 'spades' };
const RANK_NAMES: Record<Rank, string> = {
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

export function cardToString(card: Card): string {
  return `${RANK_TO_CHAR[card.rank]}${card.suit}`;
}

export function cardFromString(input: string): Card {
  const s = input.trim();
  if (s.length < 2) throw new Error(`Invalid card string: ${input}`);
  const rankChar = s.slice(0, s.length - 1).toUpperCase();
  const suitChar = s[s.length - 1]!.toLowerCase() as Suit;
  const rank = CHAR_TO_RANK[rankChar];
  if (rank === undefined || !SUITS.includes(suitChar)) {
    throw new Error(`Invalid card string: ${input}`);
  }
  return { rank, suit: suitChar };
}

/** A stable 0..51 identifier for a card (used for duplicate detection). */
export function cardId(card: Card): number {
  return (card.rank - 2) * 4 + SUITS.indexOf(card.suit);
}

export function cardsEqual(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function cardName(card: Card): string {
  return `${RANK_NAMES[card.rank]} of ${SUIT_NAMES[card.suit]}`;
}

export function cardsToStrings(cards: Card[]): string[] {
  return cards.map(cardToString);
}

export function cardsFromStrings(strings: string[]): Card[] {
  return strings.map(cardFromString);
}

/** A fresh, ordered 52-card deck. */
export function makeDeck(): Card[] {
  const deck: Card[] = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit });
    }
  }
  return deck;
}
