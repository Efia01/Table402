export { formatUsd } from '@table402/shared';

export type FeeKind = 'seat-fee' | 'hand-fee' | 'action-fee' | 'service-fee';
export type NodeType = 'agent' | 'table' | 'service';

/** The single source of truth for the semantic colour system used app-wide. */
export const FEE_COLOR: Record<string, string> = {
  'seat-fee': '#5eead4',
  'hand-fee': '#fbbf24',
  'action-fee': '#a3e635',
  'service-fee': '#c084fc',
};

export const FEE_LABEL: Record<string, string> = {
  'seat-fee': 'Seat fee',
  'hand-fee': 'Hand fee',
  'action-fee': 'Action fee',
  'service-fee': 'Service fee',
};

export const NODE_COLOR: Record<string, string> = {
  agent: '#2dd4bf',
  table: '#f5b942',
  service: '#a78bfa',
};

export const STATUS_COLOR = {
  verified: '#34d399',
  pending: '#fbbf24',
  failed: '#fb7185',
};

export function feeColor(kind: string | null | undefined): string {
  return (kind && FEE_COLOR[kind]) || '#9aa0b6';
}

export function shorten(s: string, head = 6, tail = 4): string {
  if (!s) return '';
  return s.length > head + tail + 1 ? `${s.slice(0, head)}…${s.slice(-tail)}` : s;
}

export function archetypeColor(arch: string | null | undefined): string {
  switch (arch) {
    case 'tight':
      return '#6aa9c4';
    case 'aggro':
      return '#c8202f';
    case 'budget':
      return '#46b187';
    case 'random':
      return '#b58bd0';
    default:
      return '#b3a99c';
  }
}

const SUIT = {
  s: { glyph: '♠', color: '#e8eaf3' },
  h: { glyph: '♥', color: '#fb7185' },
  d: { glyph: '♦', color: '#60a5fa' },
  c: { glyph: '♣', color: '#34d399' },
} as const;

export function parseCard(card: string): { rank: string; suit: keyof typeof SUIT; glyph: string; color: string } {
  const rank = card.slice(0, card.length - 1);
  const suit = card.slice(-1) as keyof typeof SUIT;
  const meta = SUIT[suit] ?? SUIT.s;
  return { rank, suit, glyph: meta.glyph, color: meta.color };
}
