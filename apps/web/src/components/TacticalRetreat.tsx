import { useState } from 'react';
import type { MineStatus } from '../lib/api';

export function TacticalRetreat({
  mine,
  connected,
  onSitOut,
  onRetreat,
}: {
  mine: MineStatus;
  connected: boolean;
  onSitOut: () => boolean;
  onRetreat: () => boolean;
}) {
  const [pending, setPending] = useState<'sit-out' | 'retreat' | null>(null);
  const sittingOut = !mine.autopilot;

  function handleSitOut() {
    if (pending) return;
    if (onSitOut()) setPending('sit-out');
  }

  function handleRetreat() {
    if (pending) return;
    if (onRetreat()) setPending('retreat');
  }

  return (
    <div className="glass flex items-center justify-between gap-4 px-5 py-3.5">
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest3 text-crimson-bright">
          Capital protection
        </span>
        <div className="mt-0.5 text-sm text-bone-dim">
          {sittingOut ? (
            <span className="text-bone">Sitting out — seat held, session open.</span>
          ) : (
            <>Guardrails for <span className="text-bone">{mine.name}</span></>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <button
          onClick={handleSitOut}
          disabled={!connected || sittingOut || pending !== null}
          className="btn disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'sit-out' ? 'Sitting out…' : 'Sit out'}
        </button>
        <button
          onClick={handleRetreat}
          disabled={!connected || pending !== null}
          className="btn border-crimson/60 text-crimson-soft hover:border-crimson-bright disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === 'retreat' ? 'Retreating…' : 'Tactical retreat'}
        </button>
      </div>
    </div>
  );
}
