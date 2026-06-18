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

const SIZES = {
  sm: { w: 30, h: 42, rank: 11, suitSm: 8, suitBig: 17, radius: 4 },
  md: { w: 44, h: 62, rank: 16, suitSm: 11, suitBig: 25, radius: 5 },
  lg: { w: 60, h: 84, rank: 22, suitSm: 14, suitBig: 35, radius: 7 },
  xl: { w: 86, h: 120, rank: 33, suitSm: 19, suitBig: 54, radius: 9 },
};
export type CardSize = keyof typeof SIZES;

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };

function suitColor(suit: string): string {
  return suit === 'h' || suit === 'd' ? '#c8202f' : '#16100f';
}

function CardBack({ s }: { s: (typeof SIZES)[CardSize] }) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'radial-gradient(130% 130% at 50% -10%, #2a0e12, #160a0c 68%)',
        boxShadow:
          '0 5px 16px -7px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(14,8,9,0.9), inset 0 0 0 2px rgba(231,162,60,0.22)',
      }}
    >
      <div
        className="absolute inset-[3px]"
        style={{
          borderRadius: s.radius - 2,
          backgroundImage:
            'repeating-linear-gradient(45deg, rgba(231,162,60,0.05) 0 4px, transparent 4px 8px), repeating-linear-gradient(-45deg, rgba(200,32,47,0.06) 0 4px, transparent 4px 8px)',
        }}
      />
      <div
        className="absolute inset-0 grid place-items-center font-display"
        style={{ color: 'rgba(231,162,60,0.7)', fontSize: s.suitBig * 0.7 }}
      >
        ♠
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
      className="absolute flex flex-col items-center leading-[0.85]"
      style={{
        color,
        ...(flip ? { right: '7%', bottom: '5%', transform: 'rotate(180deg)' } : { left: '7%', top: '5%' }),
      }}
    >
      <span className="font-display font-bold" style={{ fontSize: s.rank }}>
        {rank}
      </span>
      <span style={{ fontSize: s.suitSm }}>{glyph}</span>
    </div>
  );
  return (
    <div
      className="relative"
      style={{
        width: s.w,
        height: s.h,
        borderRadius: s.radius,
        background: 'linear-gradient(160deg, #fcf8f0 0%, #ece1cf 100%)',
        boxShadow: '0 5px 16px -7px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(20,12,10,0.14)',
      }}
    >
      <Corner />
      <span
        className="absolute inset-0 grid place-items-center"
        style={{ color, fontSize: s.suitBig, opacity: 0.95 }}
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
