import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type MineStatus } from '../lib/api';
import { CardRow } from './PlayingCard';
import { Panel } from './primitives';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
      <Panel title="Your hand">
        <div className="text-sm text-mute">You're seated — waiting for the next hand to be dealt.</div>
      </Panel>
    );
  }

  const isBet = v.legal.types.includes('bet');
  const canRaise = isBet || v.legal.types.includes('raise');
  const amount = clamp(raiseTo ?? v.legal.minRaiseTo, v.legal.minRaiseTo, v.legal.maxRaiseTo);

  const right = mine.autopilot ? (
    <span className="chip border-service/40 bg-service/10 text-service">autopilot</span>
  ) : v.isTurn ? (
    <span className="chip border-ok/50 bg-ok/10 text-ok animate-pulseGlow">your turn</span>
  ) : (
    <span className="text-[11px] text-ghost">waiting…</span>
  );

  return (
    <Panel title="Your hand" right={right}>
      <div className="flex flex-wrap items-center gap-5">
        <CardRow cards={v.holeCards} size="lg" />
        <div className="text-sm text-mute">
          <div>
            stack <span className="stat-num text-text">{v.stack}</span>
          </div>
          <div>
            to call <span className="stat-num text-text">{v.toCall}</span>
          </div>
          <div>
            pot <span className="stat-num text-tabletone">{v.pot}</span> ·{' '}
            <span className="capitalize">{v.street}</span>
          </div>
        </div>
      </div>

      {mine.autopilot ? (
        <div className="mt-3 text-xs text-ghost">Autopilot is on — your agent is playing this seat itself.</div>
      ) : v.isTurn ? (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              style={{ color: '#fb7185', borderColor: '#fb718555' }}
              onClick={() => act.mutate({ type: 'fold' })}
              disabled={act.isPending}
            >
              Fold
            </button>
            {v.legal.types.includes('check') && (
              <button className="btn" onClick={() => act.mutate({ type: 'check' })} disabled={act.isPending}>
                Check
              </button>
            )}
            {v.legal.types.includes('call') && (
              <button
                className="btn btn-primary"
                onClick={() => act.mutate({ type: 'call' })}
                disabled={act.isPending}
              >
                Call {v.legal.callAmount}
              </button>
            )}
            {canRaise && (
              <button
                className="btn"
                style={{ color: '#a3e635', borderColor: '#a3e63555' }}
                onClick={() => act.mutate({ type: isBet ? 'bet' : 'raise', amount })}
                disabled={act.isPending}
              >
                {isBet ? 'Bet' : 'Raise to'} {amount}
              </button>
            )}
            {v.legal.types.includes('all-in') && (
              <button
                className="btn"
                style={{ color: '#f5b942', borderColor: '#f5b94255' }}
                onClick={() => act.mutate({ type: 'all-in' })}
                disabled={act.isPending}
              >
                All-in {v.legal.maxRaiseTo}
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
                className="flex-1 accent-neon"
              />
              <span className="stat-num w-16 text-right text-sm">{amount}</span>
            </div>
          )}
          {act.isError && <div className="text-xs text-bad">action failed — try again</div>}
        </div>
      ) : (
        <div className="mt-3 text-sm text-ghost">Waiting for other players to act…</div>
      )}
    </Panel>
  );
}
