import { useState } from 'react';
import { motion } from 'framer-motion';

/**
 * Drop your own card art into `apps/web/public/cards/` named by code
 * (`As.png`, `Kh.png`, `Td.png`, … and `back.png`), then flip this to `true`.
 * Until then, the elegant built-in cards below are used.
 */
const CARD_IMAGES_ENABLED = false;
const CARD_EXT = 'png';
const cardImageUrl = (code: string) => `/cards/${code}.${CARD_EXT}`;

// Tall cards with the generous, rounded "maison" corner (radius ≈ 0.21·width).
const SIZES = {
  sm: { w: 30, h: 42, rank: 11, suitSm: 7, suitBig: 17, radius: 7 },
  md: { w: 44, h: 62, rank: 16, suitSm: 10, suitBig: 25, radius: 10 },
  lg: { w: 60, h: 84, rank: 22, suitSm: 13, suitBig: 35, radius: 14 },
  xl: { w: 86, h: 120, rank: 32, suitSm: 18, suitBig: 52, radius: 20 },
};
export type CardSize = keyof typeof SIZES;

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

// Suit pips must render in a font that actually has them. Bodoni (font-display)
// does not cover ♠♥♦♣, so force a safe symbol/system stack for the glyphs.
const SUIT_FONT =
  '"Segoe UI Symbol", "Apple Symbols", "Noto Sans Symbols2", "Arial Unicode MS", system-ui, sans-serif';

function suitColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? '#c8202f' : '#16100f';
}

// The maison card back — deep maroon with the overlapping TABLE motif and the
// 40·2 mark, echoing the brand card.
function CardBack({ s }: { s: (typeof SIZES)[CardSize] }) {
  const big = s.suitBig;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'radial-gradient(130% 130% at 50% -8%, #5e1119 0%, #4e0e13 46%, #340a0e 100%)',
        boxShadow:
          '0 6px 18px -7px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(0,0,0,0.55)',
      }}
    >
      {/* Inset hairline frame in a lighter maroon. */}
      <div
        className="absolute"
        style={{
          inset: Math.max(2, s.w * 0.07),
          borderRadius: s.radius - 3,
          border: '1px solid rgba(216,96,107,0.30)',
        }}
      />
      {/* Faint overlapping TABLE watermark behind the mark. */}
      <div
        className="absolute inset-0 grid place-items-center font-display font-bold uppercase leading-none"
        style={{ color: 'rgba(255,255,255,0.05)', fontSize: big * 0.95, letterSpacing: '-0.12em' }}
      >
        TABLE
      </div>
      {/* The crisp 40·2 mark. */}
      <div
        className="absolute inset-0 grid place-items-center font-display font-semibold leading-none"
        style={{ color: 'rgba(244,239,231,0.92)', fontSize: big * 0.5 }}
      >
        40<span style={{ fontSize: big * 0.32, transform: 'translateY(-0.12em)', display: 'inline-block', margin: '0 0.04em' }}>·</span>2
      </div>
    </div>
  );
}

function CardFace({ card, s }: { card: string; s: (typeof SIZES)[CardSize] }) {
  const rank = card.slice(0, card.length - 1).replace('T', '10');
  const suit = card.slice(-1).toLowerCase();
  const glyph = SUIT_GLYPH[suit] ?? '♠';
  const color = suitColor(suit);
  const Corner = ({ flip }: { flip?: boolean }) => (
    <div
      className="absolute flex flex-col items-center leading-[0.82]"
      style={{
        color,
        ...(flip
          ? { right: '9%', bottom: '6%', transform: 'rotate(180deg)' }
          : { left: '9%', top: '6%' }),
      }}
    >
      <span className="font-display font-bold" style={{ fontSize: s.rank }}>
        {rank}
      </span>
      <span style={{ fontSize: s.suitSm, fontFamily: SUIT_FONT }}>{glyph}</span>
    </div>
  );
  return (
    <div
      className="relative"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'linear-gradient(165deg, #ffffff 0%, #f6f2ea 100%)',
        boxShadow: '0 6px 18px -7px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(20,12,10,0.10)',
      }}
    >
      {/* Faint inner frame, in the spirit of the brand cards. */}
      <div
        className="pointer-events-none absolute"
        style={{
          inset: Math.max(2, s.w * 0.07),
          borderRadius: s.radius - 3,
          border: '1px solid rgba(20,12,10,0.07)',
        }}
      />
      <Corner />
      <span
        className="absolute inset-0 grid place-items-center"
        style={{ color, fontSize: s.suitBig, opacity: 0.96, fontFamily: SUIT_FONT }}
      >
        {glyph}
      </span>
      <Corner flip />
    </div>
  );
}

export function PlayingCard({
  card,
  size = 'md',
  index = 0,
}: {
  card: string | null;
  size?: CardSize;
  index?: number;
}) {
  const s = SIZES[size];
  const [imgFailed, setImgFailed] = useState(false);
  const useImage = CARD_IMAGES_ENABLED && !imgFailed;

  let inner;
  if (!card) {
    inner =
      useImage ? (
        <img
          src={cardImageUrl('back')}
          alt="card back"
          width={s.w}
          height={s.h}
          style={{ borderRadius: s.radius }}
          onError={() => setImgFailed(true)}
        />
      ) : (
        <CardBack s={s} />
      );
  } else {
    inner = useImage ? (
      <img
        src={cardImageUrl(card)}
        alt={card}
        width={s.w}
        height={s.h}
        style={{ borderRadius: s.radius }}
        onError={() => setImgFailed(true)}
      />
    ) : (
      <CardFace card={card} s={s} />
    );
  }

  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0, y: -6 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, type: 'spring', stiffness: 210, damping: 19 }}
      style={{ width: s.w, height: s.h, transformStyle: 'preserve-3d' }}
    >
      {inner}
    </motion.div>
  );
}

export function CardRow({ cards, size = 'md' }: { cards: (string | null)[]; size?: CardSize }) {
  return (
    <div className="flex" style={{ gap: size === 'xl' ? 8 : size === 'lg' ? 6 : 4 }}>
      {cards.map((c, i) => (
        <PlayingCard key={`${c ?? 'x'}-${i}`} card={c} size={size} index={i} />
      ))}
    </div>
  );
}
