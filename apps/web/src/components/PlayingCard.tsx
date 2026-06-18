import { motion } from 'framer-motion';
import { parseCard } from '../lib/ui';

const SIZES = {
  sm: { w: 30, h: 42, rank: 'text-sm', suit: 'text-xs' },
  md: { w: 40, h: 56, rank: 'text-lg', suit: 'text-sm' },
  lg: { w: 52, h: 72, rank: 'text-2xl', suit: 'text-lg' },
};

export function PlayingCard({
  card,
  size = 'md',
  index = 0,
}: {
  card: string | null;
  size?: keyof typeof SIZES;
  index?: number;
}) {
  const s = SIZES[size];
  if (!card) {
    return (
      <div
        className="rounded-md border border-edge"
        style={{
          width: s.w,
          height: s.h,
          background:
            'repeating-linear-gradient(45deg, #1a1f30, #1a1f30 5px, #161b29 5px, #161b29 10px)',
        }}
      />
    );
  }
  const { rank, glyph, color } = parseCard(card);
  return (
    <motion.div
      initial={{ rotateY: 90, opacity: 0, y: -6 }}
      animate={{ rotateY: 0, opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, type: 'spring', stiffness: 220, damping: 18 }}
      className="relative flex flex-col items-center justify-center rounded-md border border-edge bg-gradient-to-b from-[#fbfcff] to-[#e7ebf5] font-mono font-bold text-ink shadow-md"
      style={{ width: s.w, height: s.h }}
    >
      <span className={`${s.rank} leading-none`} style={{ color }}>
        {rank}
      </span>
      <span className={`${s.suit} leading-none`} style={{ color }}>
        {glyph}
      </span>
    </motion.div>
  );
}

export function CardRow({ cards, size = 'md' }: { cards: (string | null)[]; size?: keyof typeof SIZES }) {
  return (
    <div className="flex gap-1.5">
      {cards.map((c, i) => (
        <PlayingCard key={`${c ?? 'x'}-${i}`} card={c} size={size} index={i} />
      ))}
    </div>
  );
}
