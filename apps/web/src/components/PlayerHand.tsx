import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MineStatus } from '../lib/api';
import { CardRow } from './PlayingCard';
import { Panel } from './primitives';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// Minimal line icons for the action buttons.
const ICON = {
  fold: 'M6 6l12 12M18 6L6 18', // ✕  discard
  check: 'M5 13l4 4L19 7', // ✓  pass
  call: 'M5 9h14M5 15h14', // =  match the bet
  bet: 'M12 19V5M5 12l7-7 7 7', // ↑  put in / raise
  allin: 'M6 12l6-6 6 6M6 19l6-6 6 6', // ⇈  everything
};
function Icon({ d }: { d: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** The seated user's private view: their own hole cards + manual action controls. */
export function PlayerHand({
  tableId,
  mine,
  refetchKey,
}: {
  tableId: string;
  mine: MineStatus;
  refetchKey: string;
}) {
  const qc = useQueryClient();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);

  const viewQ = useQuery({
    queryKey: ['myview', mine.agentId, refetchKey],
    queryFn: () => api.agentView(tableId, mine.agentId),
    refetchInterval: 1500,
  });
  const v = viewQ.data?.view ?? null;

  const act = useMutation({
    mutationFn: (a: { type: string; amount?: number }) =>
      api.submitAction(tableId, mine.agentId, a.type, a.amount),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myview', mine.agentId] }),
  });

  // Reset the raise slider whenever the action context changes.
  useEffect(() => setRaiseTo(null), [refetchKey]);

  if (!v || !v.isInHand) {
    return (
      <Panel title={<span className="font-display text-base normal-case tracking-normal text-bone">Your hand</span>}>
        <div className="text-sm text-bone-dim">You're seated — waiting for the next hand to be dealt.</div>
      </Panel>
    );
  }

  const isBet = v.legal.types.includes('bet');
  const canRaise = isBet || v.legal.types.includes('raise');
  const amount = clamp(raiseTo ?? v.legal.minRaiseTo, v.legal.minRaiseTo, v.legal.maxRaiseTo);

  const right = v.isTurn ? (
    <span className="chip border-ok/50 bg-ok/10 text-ok animate-pulseGlow">your turn</span>
  ) : (
    <span className="chip border-ember/40 bg-ember/[0.08] text-ember">auto</span>
  );

  return (
    <Panel title={<span className="font-display text-base normal-case tracking-normal text-bone">Your hand</span>} right={right}>
      <div className="flex flex-wrap items-center gap-6">
        <CardRow cards={v.holeCards} size="lg" />
        <div className="text-sm text-bone-dim">
          to call <span className="stat-num text-xl text-bone">{v.toCall}</span>
        </div>
      </div>

      {v.isTurn ? (
        <div className="mt-5 space-y-3">
          <div className="flex flex-wrap gap-2.5">
            <button
              className="btn"
              style={{ color: '#d8606b', borderColor: 'rgba(216,96,107,0.4)' }}
              onClick={() => act.mutate({ type: 'fold' })}
              disabled={act.isPending}
            >
              <Icon d={ICON.fold} /> Fold
            </button>
            {v.legal.types.includes('check') && (
              <button
                className="btn"
                style={{ color: '#ece3d6', borderColor: 'rgba(236,227,214,0.22)' }}
                onClick={() => act.mutate({ type: 'check' })}
                disabled={act.isPending}
              >
                <Icon d={ICON.check} /> Check
              </button>
            )}
            {v.legal.types.includes('call') && (
              <button
                className="btn"
                style={{ color: '#e7a23c', borderColor: 'rgba(231,162,60,0.45)' }}
                onClick={() => act.mutate({ type: 'call' })}
                disabled={act.isPending}
              >
                <Icon d={ICON.call} /> Call {v.legal.callAmount}
              </button>
            )}
            {canRaise && (
              <button
                className="btn btn-primary"
                onClick={() => act.mutate({ type: isBet ? 'bet' : 'raise', amount })}
                disabled={act.isPending}
              >
                <Icon d={ICON.bet} /> {isBet ? 'Bet' : 'Raise to'} {amount}
              </button>
            )}
            {v.legal.types.includes('all-in') && (
              <button
                className="btn"
                style={{ color: '#e7a23c', borderColor: 'rgba(231,162,60,0.5)', background: 'rgba(231,162,60,0.1)' }}
                onClick={() => act.mutate({ type: 'all-in' })}
                disabled={act.isPending}
              >
                <Icon d={ICON.allin} /> All-in {v.legal.maxRaiseTo}
              </button>
            )}
          </div>
          {canRaise && v.legal.maxRaiseTo > v.legal.minRaiseTo && (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={v.legal.minRaiseTo}
                max={v.legal.maxRaiseTo}
                value={amount}
                onChange={(e) => setRaiseTo(Number(e.target.value))}
                className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-noir-600 accent-crimson"
              />
              <span className="stat-num w-16 text-right text-sm text-bone">{amount}</span>
            </div>
          )}
          {act.isError && <div className="text-xs text-bad">action failed — try again</div>}
        </div>
      ) : (
        <div className="mt-3 text-sm text-bone-faint">
          Your agent is playing autonomously — waiting for your turn…
        </div>
      )}
    </Panel>
  );
}
