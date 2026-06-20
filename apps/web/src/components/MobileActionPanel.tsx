import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { fmtChips } from './BankrollPanel';
import { CardRow } from './PlayingCard';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function MobileActionPanel({ tableId, agentId }: { tableId: string; agentId: string }) {
  const qc = useQueryClient();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);
  const [autopilot, setAutopilot] = useState(true);

  const viewQ = useQuery({
    queryKey: ['myview', agentId],
    queryFn: () => api.agentView(tableId, agentId),
    refetchInterval: 2000,
  });
  const v = viewQ.data?.view ?? null;

  const act = useMutation({
    mutationFn: (a: { type: string; amount?: number }) =>
      api.submitAction(tableId, agentId, a.type, a.amount),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myview', agentId] }),
  });

  const refetchKey = `${v?.handId ?? ''}:${v?.street ?? ''}:${v?.toCall ?? ''}:${v?.board?.length ?? 0}`;
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

  useEffect(() => {
    if (!autopilot || !active) return;
    const callAmount = legal.callAmount ?? 0;
    const stack = v?.stack ?? 0;
    const t = setTimeout(() => {
      if (canCheck) act.mutate({ type: 'check' });
      else if (canCall && callAmount <= stack * 0.25) act.mutate({ type: 'call' });
      else act.mutate({ type: 'fold' });
    }, 2500);
    return () => clearTimeout(t);
  }, [autopilot, active, refetchKey]);

  return (
    <div className="glass overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <span className="label">Your hand</span>
        <div className="flex items-center gap-3">
          {inHand && v?.holeCards?.length ? (
            <CardRow cards={v.holeCards} size="sm" />
          ) : (
            <span className="text-xs text-bone-faint">waiting…</span>
          )}
          <button
            onClick={() => setAutopilot((on) => !on)}
            className={`chip ${autopilot ? 'border-crimson-bright/60 text-crimson-bright' : 'border-hairline text-bone-faint'}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${autopilot ? 'bg-crimson-bright' : 'bg-bone-faint'}`} />
            auto {autopilot ? 'on' : 'off'}
          </button>
        </div>
      </div>

      {inHand && (
        <div className="flex items-center justify-between px-4 py-2 text-xs text-bone-dim">
          <span>pot <span className="stat-num text-bone">{fmtChips(v?.pot ?? 0)}</span></span>
          <span>stack <span className="stat-num text-bone">{fmtChips(v?.stack ?? 0)}</span></span>
          {(v?.toCall ?? 0) > 0 && (
            <span>to call <span className="stat-num text-crimson-bright">{fmtChips(v?.toCall ?? 0)}</span></span>
          )}
        </div>
      )}

      {canRaise && (
        <div className="flex items-center gap-3 border-t border-hairline px-4 py-3">
          <span className="stat-num w-16 shrink-0 text-sm text-bone">{fmtChips(amount)}</span>
          <input
            type="range"
            min={lo}
            max={Math.max(lo, hi)}
            value={amount}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-noir-600 accent-crimson-bright"
          />
        </div>
      )}

      <div className="grid grid-cols-3 border-t border-hairline">
        <button
          className="py-4 text-center font-mono text-sm uppercase tracking-widest2 text-bone hover:bg-crimson-dark/30 disabled:opacity-30"
          disabled={!active || !inHand}
          onClick={() => act.mutate({ type: 'fold' })}
        >
          Fold
        </button>
        <button
          className="border-l border-hairline py-4 text-center font-mono text-sm uppercase tracking-widest2 text-bone hover:bg-noir-700 disabled:opacity-30"
          disabled={!active || (!canCheck && !canCall)}
          onClick={() => act.mutate({ type: canCheck ? 'check' : 'call' })}
        >
          {canCheck ? 'Check' : `Call ${fmtChips(legal.callAmount)}`}
        </button>
        <button
          className="border-l border-hairline py-4 text-center font-mono text-sm uppercase tracking-widest2 text-paper disabled:opacity-30"
          style={{ background: active && (canRaise || canAllIn) ? '#e3344b' : 'rgba(227,52,75,0.18)' }}
          disabled={!active || (!canRaise && !canAllIn)}
          onClick={() => (canRaise ? act.mutate({ type: isBet ? 'bet' : 'raise', amount }) : act.mutate({ type: 'all-in' }))}
        >
          {canRaise ? `${isBet ? 'Bet' : 'Raise'} ${fmtChips(amount)}` : 'All-in'}
        </button>
      </div>

      <div className="border-t border-hairline px-4 py-2 text-center text-xs text-bone-faint">
        {!inHand
          ? 'Seated — waiting for the next hand to be dealt.'
          : isTurn
            ? autopilot
              ? 'Autopilot will act shortly — tap a button to decide yourself.'
              : 'Your turn — act before the timer.'
            : autopilot
              ? 'Autopilot is playing your seat. Toggle it off to play manually.'
              : 'Waiting for your turn…'}
        {act.isError && <span className="ml-2 text-crimson-soft">· action failed</span>}
      </div>
    </div>
  );
}
