import { useEffect, useState } from 'react';

/**
 * A countdown ring drawn around the active seat. Sweeps from full to empty over
 * the turn window, shifting green → amber → red, with the seconds-left number.
 * Driven purely by the server's `turnEndsAt` / `turnMs`, so it stays in sync.
 */
export function TurnTimer({ endsAt, totalMs }: { endsAt: number; totalMs: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, []);

  const remaining = Math.max(0, endsAt - now);
  const frac = totalMs > 0 ? Math.max(0, Math.min(1, remaining / totalMs)) : 0;
  const seconds = Math.ceil(remaining / 1000);

  const color = frac > 0.5 ? '#46b187' : frac > 0.2 ? '#e7a23c' : '#e3344b';

  // Ring geometry — a rounded square that hugs the seat plate.
  const size = 200; // viewBox units; scaled to fill the wrapper via width/height 100%
  const inset = 6;
  const r = 16;
  const w = size - inset * 2;
  const perimeter = 2 * (w + w) - 8 * r + 2 * Math.PI * r;
  const dash = perimeter * frac;

  return (
    <div className="pointer-events-none absolute -inset-1 z-20">
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" preserveAspectRatio="none">
        <rect
          x={inset}
          y={inset}
          width={w}
          height={w}
          rx={r}
          ry={r}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={3}
        />
        <rect
          x={inset}
          y={inset}
          width={w}
          height={w}
          rx={r}
          ry={r}
          fill="none"
          stroke={color}
          strokeWidth={3.5}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${perimeter}`}
          style={{ transition: 'stroke 0.4s linear', filter: `drop-shadow(0 0 5px ${color}aa)` }}
        />
      </svg>
      <span
        className="absolute -right-2 -top-3 grid h-6 min-w-6 place-items-center rounded-full px-1.5 font-mono text-[11px] font-bold tabular-nums text-paper"
        style={{ background: color, boxShadow: `0 0 10px -2px ${color}` }}
      >
        {seconds}
      </span>
    </div>
  );
}
