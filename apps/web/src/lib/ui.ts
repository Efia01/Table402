export { formatUsd } from '@table402/shared';

export type FeeKind = 'seat-fee' | 'hand-fee' | 'action-fee' | 'service-fee';
export type NodeType = 'agent' | 'table' | 'service';

/** The single source of truth for the semantic colour system used app-wide.
 *  Drawn only from the locked Maison palette — warm neutrals + the rouge accent
 *  + deep burgundy. No neon; casino green is reserved for the felt. */
export const FEE_COLOR: Record<string, string> = {
  'seat-fee': '#c9c1b0', // cream-dim
  'hand-fee': '#8a8278', // ash
  'action-fee': '#e2333f', // rouge
  'service-fee': '#7a1b26', // burgundy-600
};

export const FEE_LABEL: Record<string, string> = {
  'seat-fee': 'Seat fee',
  'hand-fee': 'Hand fee',
  'action-fee': 'Action fee',
  'service-fee': 'Service fee',
};

export const NODE_COLOR: Record<string, string> = {
  agent: '#f2ecdd', // cream — the players
  table: '#e2333f', // rouge — the house
  service: '#7a1b26', // burgundy-600 — external services
};

export const STATUS_COLOR = {
  verified: '#f2ecdd', // cream (light = good)
  pending: '#c9c1b0', // cream-dim
  failed: '#e2333f', // rouge
};

export function feeColor(kind: string | null | undefined): string {
  return (kind && FEE_COLOR[kind]) || '#8a8278'; // ash fallback
}

export function shorten(s: string, head = 6, tail = 4): string {
  if (!s) return '';
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function archetypeColor(arch: string | null | undefined): string {
  switch (arch) {
    case 'tight':
      return '#c9c1b0'; // cream-dim — measured
    case 'aggro':
      return '#e2333f'; // rouge — aggressive
    case 'budget':
      return '#8a8278'; // ash — frugal
    case 'random':
      return '#7a1b26'; // burgundy — wild
    default:
      return '#c9c1b0';
  }
}

const SUIT = {
  s: { glyph: '♠', color: '#f2ecdd' }, // cream
  h: { glyph: '♥', color: '#e2333f' }, // rouge
  d: { glyph: '♦', color: '#b5232e' }, // rouge-dim
  c: { glyph: '♣', color: '#c9c1b0' }, // cream-dim
} as const;

export function parseCard(card: string): { rank: string; suit: keyof typeof SUIT; glyph: string; color: string } {
  const rank = card.slice(0, card.length - 1);
  const suit = card.slice(-1) as keyof typeof SUIT;
  const meta = SUIT[suit] ?? SUIT.s;
  return { rank, suit, glyph: meta.glyph, color: meta.color };
}
