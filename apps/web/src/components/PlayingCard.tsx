import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CenterArt, CornerSuit, suitColor, type Suit } from './cardArt';

/**
 * The deck is the hand-designed PNG art in `apps/web/public/cards/`, rendered
 * verbatim. Filenames: `<rank><suit>.png` — rank ∈ A 2 3 4 5 6 7 8 9 10 J Q K,
 * suit ∈ c d h s (lowercase) — e.g. `As.png`, `10h.png`, `2c.png`, plus `back.png`.
 * If a file is missing it falls back to the built-in vector card for that card.
 */
const CARD_IMAGES_ENABLED = true;
const CARD_EXT = 'png';
function cardImageUrl(code: string): string {
  if (code === 'back') return `/cards/back.${CARD_EXT}`;
  const suit = code.slice(-1).toLowerCase();
  let rank = code.slice(0, -1).toUpperCase();
  if (rank === 'T') rank = '10'; // app uses 'T' for ten; files use natural "10"
  return `/cards/${rank}${suit}.${CARD_EXT}`;
}

// Tall cards with the generous, rounded "maison" corner (radius ≈ 0.21·width).
const SIZES = {
  sm: { w: 30, h: 42, rank: 11, suitSm: 7, suitBig: 17, radius: 7 },
  md: { w: 44, h: 62, rank: 16, suitSm: 10, suitBig: 25, radius: 10 },
  lg: { w: 60, h: 84, rank: 22, suitSm: 13, suitBig: 35, radius: 14 },
  xl: { w: 86, h: 120, rank: 32, suitSm: 18, suitBig: 52, radius: 20 },
};
export type CardSize = keyof typeof SIZES;

// The card back — a cream-bordered card over a deep-red interior with the
// overlapping TABLE motif and the white 402 mark.
function CardBack({ s }: { s: (typeof SIZES)[CardSize] }) {
  const big = s.suitBig;
  const showWordmark = s.w >= 48;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'linear-gradient(160deg, #f3ead4 0%, #e7dcc1 100%)',
        boxShadow: '0 6px 18px -7px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(20,12,10,0.18)',
      }}
    >
      {/* Deep-red interior, inset within the cream frame. */}
      <div
        className="absolute overflow-hidden"
        style={{
          inset: Math.max(2.5, s.w * 0.08),
          borderRadius: Math.max(2, s.radius - 3),
          background: 'radial-gradient(125% 120% at 32% 16%, #80141e 0%, #581017 46%, #380a0e 100%)',
          boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.45)',
        }}
      >
        {/* Overlapping TABLE watermark (larger cards only). */}
        {showWordmark && (
          <div
            className="absolute inset-0 grid place-items-center font-display font-bold uppercase leading-none"
            style={{ color: 'rgba(0,0,0,0.36)', fontSize: big * 1.18, letterSpacing: '-0.16em' }}
          >
            TABLE
          </div>
        )}
        {/* The 402 mark. */}
        <div
          className="absolute inset-0 grid place-items-center font-display leading-none"
          style={{ color: '#f4efe7', fontSize: showWordmark ? big * 0.64 : big * 0.62, fontWeight: 500 }}
        >
          402
        </div>
      </div>
    </div>
  );
}

function CardFace({ card, s }: { card: string; s: (typeof SIZES)[CardSize] }) {
  const rank = card.slice(0, card.length - 1).replace('T', '10');
  const suit = card.slice(-1).toLowerCase() as Suit;
  const color = suitColor(suit);
  const red = suit === 'h' || suit === 'd';
  const line = red ? 'rgba(210,51,63,0.55)' : 'rgba(54,42,34,0.22)';
  const figW = s.w * 0.66;

  const Corner = ({ flip }: { flip?: boolean }) => (
    <div
      className="absolute flex flex-col items-center leading-[0.74]"
      style={{
        color,
        ...(flip
          ? { right: '8%', bottom: '6%', transform: 'rotate(180deg)' }
          : { left: '8%', top: '6%' }),
      }}
    >
      <span className="font-display font-bold" style={{ fontSize: s.rank }}>
        {rank}
      </span>
      <span style={{ marginTop: s.rank * -0.04, lineHeight: 0 }}>
        <CornerSuit suit={suit} color={color} size={s.suitSm} />
      </span>
    </div>
  );

  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'linear-gradient(160deg, #f8f2e4 0%, #efe6d0 58%, #e7dcc2 100%)',
        boxShadow: '0 6px 18px -7px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(20,12,10,0.12)',
      }}
    >
      {/* Inner frame + the signature diagonal hairline. */}
      <svg
        viewBox="0 0 100 140"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
      >
        <rect x="4.5" y="4.5" width="91" height="131" rx="9" ry="9" fill="none" stroke={line} strokeWidth="1.1" />
        <line x1="20" y1="14" x2="88" y2="128" stroke={line} strokeWidth="0.7" opacity="0.55" />
      </svg>

      <Corner />
      <div className="absolute inset-0 grid place-items-center">
        <svg width={figW} height={figW} viewBox="0 0 200 200" aria-hidden>
          <CenterArt rank={rank} suit={suit} color={color} />
        </svg>
      </div>
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

  // Flip in only when this slot's card actually changes (first deal, or a reveal
  // null→card) — never on unrelated re-renders triggered by other players acting.
  const prev = useRef<string | null | undefined>(undefined);
  const changed = prev.current !== card;
  prev.current = card;

  // Render the supplied PNG exactly as-is (contain, no clipping/recolouring),
  // with only a soft shadow so it reads on the felt.
  const imgStyle = {
    width: s.w,
    height: s.h,
    objectFit: 'contain' as const,
    filter: 'drop-shadow(0 5px 11px rgba(0,0,0,0.5))',
  };

  let inner;
  if (!card) {
    inner = useImage ? (
      <img src={cardImageUrl('back')} alt="card back" style={imgStyle} onError={() => setImgFailed(true)} />
    ) : (
      <CardBack s={s} />
    );
  } else {
    inner = useImage ? (
      <img src={cardImageUrl(card)} alt={card} style={imgStyle} onError={() => setImgFailed(true)} />
    ) : (
      <CardFace card={card} s={s} />
    );
  }

  if (!changed) {
    return <div style={{ width: s.w, height: s.h }}>{inner}</div>;
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
        <PlayingCard key={i} card={c} size={size} index={i} />
      ))}
    </div>
  );
}
