import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MineStatus } from '../lib/api';
import { fmtChips } from './BankrollPanel';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * The seated user's action bar — a full-width maison console pinned beneath the
 * felt: a bet slider with ½ POT / POT / ALL-IN presets and the three primary
 * Fold / Check·Call / Raise segments. All the action logic is unchanged.
 */
export function PlayerHand({
  tableId,
  mine,
  refetchKey,
  pot = 0,
}: {
  tableId: string;
  mine: MineStatus;
  refetchKey: string;
  pot?: number;
}) {
  const qc = useQueryClient();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);

  const viewQ = useQuery({
    queryKey: ['myview', mine.agentId, refetchKey],
    queryFn: () => api.agentView(tableId, mine.agentId),
    refetchInterval: 3000,
  });
  const v = viewQ.data?.view ?? null;

  const act = useMutation({
    mutationFn: (a: { type: string; amount?: number }) =>
      api.submitAction(tableId, mine.agentId, a.type, a.amount),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myview', mine.agentId] }),
  });

  // Reset the raise slider whenever the action context changes.
  useEffect(() => setRaiseTo(null), [refetchKey]);

  const legal = v?.legal ?? { types: [] as string[], callAmount: 0, minRaiseTo: 0, maxRaiseTo: 0 };
  const inHand = !!v && v.isInHand;
  const isTurn = !!v && v.isTurn;
  const isBet = legal.types.includes('bet');
  const canRaise = isBet || legal.types.includes('raise');
  const canCheck = legal.types.includes('check');
  const canCall = legal.types.includes('call');
  const canAllIn = legal.types.includes('all-in');

  const lo = legal.minRaiseTo ?? 0;
  const hi = legal.maxRaiseTo ?? 0;
  const amount = clamp(raiseTo ?? lo, lo, hi);
  const active = isTurn && !act.isPending;

  const statusNote = !inHand
    ? 'Seated — waiting for the next hand to be dealt.'
    : !isTurn
      ? 'Your agent is playing autonomously — waiting for your turn…'
      : null;

  return (
    <div className="full-bleed border-t border-hairline bg-noir-900/85 backdrop-blur-xl">
      {/* Bet slider + presets */}
      <div className="flex items-center gap-4 px-4 py-3 sm:px-8">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-bone-faint">Bet</span>
        <span className="stat-num w-20 shrink-0 text-sm text-bone">{fmtChips(amount)}</span>
        <input
          type="range"
          min={lo}
          max={Math.max(lo, hi)}
          value={amount}
          disabled={!canRaise}
          onChange={(e) => setRaiseTo(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-noir-600 accent-crimson-bright disabled:opacity-40"
        />
        <span className="stat-num hidden w-20 shrink-0 text-right text-sm text-bone-dim sm:block">
          {fmtChips(hi)}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            className="btn"
            disabled={!canRaise}
            onClick={() => setRaiseTo(clamp(Math.round(pot / 2), lo, hi))}
          >
            ½ Pot
          </button>
          <button
            className="btn"
            disabled={!canRaise}
            onClick={() => setRaiseTo(clamp(pot, lo, hi))}
          >
            Pot
          </button>
          <button
            className="btn"
            disabled={!canAllIn && !canRaise}
            onClick={() => (canAllIn ? act.mutate({ type: 'all-in' }) : setRaiseTo(hi))}
          >
            All-in
          </button>
        </div>
      </div>

      {/* Fold / Check·Call / Raise */}
      <div className="flex items-stretch border-t border-hairline">
        <button
          className="act-seg border-r border-hairline text-bone hover:bg-crimson-dark/30 disabled:opacity-35"
          disabled={!active || (!inHand)}
          onClick={() => act.mutate({ type: 'fold' })}
        >
          Fold
        </button>

        <button
          className="act-seg border-r border-hairline text-bone hover:bg-noir-700 disabled:opacity-35"
          disabled={!active || (!canCheck && !canCall)}
          onClick={() => act.mutate({ type: canCheck ? 'check' : 'call' })}
        >
          {canCheck ? 'Check' : `Call ${fmtChips(legal.callAmount)}`}
        </button>

        <button
          className="act-seg text-paper disabled:opacity-35"
          style={{ background: active && canRaise ? '#e3344b' : 'rgba(227,52,75,0.18)' }}
          disabled={!active || !canRaise}
          onClick={() => act.mutate({ type: isBet ? 'bet' : 'raise', amount })}
        >
          {isBet ? 'Bet' : 'Raise'} {fmtChips(amount)}
        </button>
      </div>

      {statusNote && (
        <div className="border-t border-hairline px-8 py-2 text-center font-sans text-xs text-bone-faint">
          {statusNote}
          {act.isError && <span className="ml-2 text-crimson-soft">· action failed — try again</span>}
        </div>
      )}
    </div>
  );
}
