/**
 * Table402 card art — the hand-designed Berlin deck, as composable, recolorable
 * SVG. Every figure is monochrome (one `color` fill) so the same art renders in
 * ink for ♠/♣ and rouge for ♥/♦, exactly like the source deck.
 *
 * Suit pips are unit shapes centred at (0,0), ~±48 in extent. Figures draw into a
 * 0..200 viewBox and are placed by the card at the centre.
 */
import type { ReactNode } from 'react';

export type Suit = 's' | 'h' | 'd' | 'c';

/** Suit colours pulled from the app palette (ink + rouge). */
export const INK = '#15100f';
export const ROUGE = '#d2333f';
export function suitColor(suit: Suit): string {
  return suit === 'h' || suit === 'd' ? ROUGE : INK;
}

const HEART =
  'M0 44 C -26 22 -48 4 -48 -17 C -48 -34 -35 -45 -22 -45 C -11 -45 -3 -37 0 -28 C 3 -37 11 -45 22 -45 C 35 -45 48 -34 48 -17 C 48 4 26 22 0 44 Z';
const DIAMOND = 'M0 -48 L 40 0 L 0 48 L -40 0 Z';
const SPADE =
  'M0 -46 C -6 -34 -47 -7 -47 17 C -47 32 -34 38 -22 33 C -15 30 -10 24 -8 18 C -9 31 -15 42 -27 48 L 27 48 C 15 42 9 31 8 18 C 10 24 15 30 22 33 C 34 38 47 32 47 17 C 47 -7 6 -34 0 -46 Z';

/** A single suit pip (centred at 0,0), drawn inside an SVG coordinate system. */
export function SuitPath({ suit, color }: { suit: Suit; color: string }): ReactNode {
  if (suit === 'c') {
    return (
      <g fill={color}>
        <circle cx={0} cy={-20} r={19} />
        <circle cx={-25} cy={13} r={19} />
        <circle cx={25} cy={13} r={19} />
        <path d="M-8 6 C -9 25 -16 40 -29 50 L 29 50 C 16 40 9 25 8 6 Z" />
      </g>
    );
  }
  return <path d={suit === 'h' ? HEART : suit === 'd' ? DIAMOND : SPADE} fill={color} />;
}

function Placed({
  suit,
  color,
  x,
  y,
  scale,
  rot = 0,
}: {
  suit: Suit;
  color: string;
  x: number;
  y: number;
  scale: number;
  rot?: number;
}): ReactNode {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale})`}>
      <SuitPath suit={suit} color={color} />
    </g>
  );
}

/** A. The Berlin bear, upright and striding, holding the suit aloft. */
export function FigureA({ suit, color }: { suit: Suit; color: string }): ReactNode {
  return (
    <g fill={color}>
      {/* hind legs mid-stride + feet */}
      <path d="M120 132 C 138 140 146 162 140 182 C 136 194 122 196 116 186 C 110 172 110 150 120 132 Z" />
      <path d="M96 140 C 84 152 78 174 84 190 C 88 200 102 200 106 190 C 110 174 108 154 96 140 Z" />
      <ellipse cx={134} cy={186} rx={20} ry={9} />
      <ellipse cx={92} cy={193} rx={19} ry={8} />
      {/* body, leaning forward */}
      <path d="M70 92 C 54 120 56 156 90 168 C 124 178 150 160 152 128 C 153 102 140 82 114 76 C 92 71 80 76 70 92 Z" />
      {/* haunch */}
      <circle cx={132} cy={120} r={26} />
      {/* head, upper-left */}
      <circle cx={74} cy={54} r={27} />
      {/* rounded ears */}
      <circle cx={56} cy={31} r={11} />
      <circle cx={94} cy={31} r={10} />
      {/* snout pointing left */}
      <path d="M40 54 C 30 52 26 62 32 70 C 40 78 56 78 64 70 C 70 62 64 52 54 50 C 48 49 44 51 40 54 Z" />
      {/* near foreleg reaching down to the emblem */}
      <path d="M84 86 C 64 88 48 102 44 122 C 42 134 52 142 62 136 C 78 126 92 108 96 92 Z" />
      {/* the held suit, clutched in the paws */}
      <Placed suit={suit} color={color} x={56} y={120} scale={0.48} />
    </g>
  );
}

/** K. The ornate skeleton key. */
export function FigureK({ color }: { color: string }): ReactNode {
  return (
    <g fill={color} stroke={color}>
      {/* ornate bow */}
      <circle cx={100} cy={52} r={21} fill="none" strokeWidth={7} />
      <circle cx={100} cy={52} r={7} fill={color} stroke="none" />
      {/* fleur crown */}
      <path
        d="M100 12 C 94 22 86 24 82 22 C 88 30 96 30 100 26 C 104 30 112 30 118 22 C 114 24 106 22 100 12 Z"
        stroke="none"
      />
      {/* side scrolls on the bow */}
      <path d="M72 50 C 62 48 58 58 64 64 C 66 56 72 56 76 58 Z" stroke="none" />
      <path d="M128 50 C 138 48 142 58 136 64 C 134 56 128 56 124 58 Z" stroke="none" />
      {/* shaft */}
      <rect x={96} y={70} width={8} height={84} stroke="none" />
      {/* collar */}
      <circle cx={100} cy={104} r={8} stroke="none" />
      {/* bit / teeth */}
      <path d="M104 132 h20 v9 h-10 v8 h10 v9 h-20 Z" stroke="none" />
      <circle cx={100} cy={160} r={6} stroke="none" />
    </g>
  );
}

/** J. A medallion rosette woven from the suit. */
export function FigureJ({ suit, color }: { suit: Suit; color: string }): ReactNode {
  const petals = (count: number, radius: number, scale: number, phase = 0) =>
    Array.from({ length: count }, (_, i) => {
      const a = (i * 360) / count + phase;
      const r = (a * Math.PI) / 180;
      return (
        <Placed
          key={`${count}-${i}`}
          suit={suit}
          color={color}
          x={100 + radius * Math.cos(r)}
          y={100 + radius * Math.sin(r)}
          scale={scale}
          rot={a + 90}
        />
      );
    });
  return (
    <g>
      <circle cx={100} cy={100} r={84} fill="none" stroke={color} strokeWidth={3} />
      <circle cx={100} cy={100} r={88} fill="none" stroke={color} strokeWidth={1} />
      {petals(11, 60, 0.34)}
      {petals(6, 32, 0.3, 30)}
      <Placed suit={suit} color={color} x={100} y={100} scale={0.26} />
    </g>
  );
}

/** Q. The Brandenburg Gate, crowned with the suit. */
export function FigureQ({ suit, color }: { suit: Suit; color: string }): ReactNode {
  const cols = [54, 72, 90, 110, 128, 146];
  return (
    <g fill={color}>
      {/* quadriga → a suit on top */}
      <Placed suit={suit} color={color} x={100} y={40} scale={0.22} />
      {/* entablature */}
      <rect x={42} y={64} width={116} height={13} rx={2} />
      <rect x={52} y={56} width={96} height={8} rx={2} />
      {/* columns */}
      {cols.map((x) => (
        <rect key={x} x={x - 5} y={80} width={10} height={68} rx={2} />
      ))}
      {/* base steps */}
      <rect x={40} y={150} width={120} height={9} rx={2} />
      <rect x={34} y={161} width={132} height={9} rx={2} />
    </g>
  );
}

/** The centre artwork for a given rank+suit (figure, or a single big pip). */
export function CenterArt({ rank, suit, color }: { rank: string; suit: Suit; color: string }): ReactNode {
  switch (rank) {
    case 'A':
      return <FigureA suit={suit} color={color} />;
    case 'K':
      return <FigureK color={color} />;
    case 'J':
      return <FigureJ suit={suit} color={color} />;
    case 'Q':
      return <FigureQ suit={suit} color={color} />;
    default:
      return <Placed suit={suit} color={color} x={100} y={102} scale={0.95} />;
  }
}

/** A corner index mark: the small suit pip with the signature dot above it. */
export function CornerSuit({ suit, color, size }: { suit: Suit; color: string; size: number }): ReactNode {
  return (
    <svg width={size} height={size * 1.32} viewBox="-50 -82 100 132" aria-hidden>
      <circle cx={0} cy={-58} r={11} fill={color} />
      <g transform="translate(0 10) scale(0.9)">
        <SuitPath suit={suit} color={color} />
      </g>
    </svg>
  );
}
