import { useQuery } from '@tanstack/react-query';
import type { MineStatus } from '../lib/api';
import { api } from '../lib/api';
import { Panel, Empty } from './primitives';

export function fmtChips(n: number): string {
  const sign = n < 0 ? '-' : '';
  // Force en-US grouping so 1000 reads "€1,000", not a locale-ambiguous "€1.000".
  return `${sign}€${Math.abs(Math.round(n)).toLocaleString('en-US')}`;
}

function Delta({ n }: { n: number }) {
  // Gains read in bright ivory, losses in rouge — no green off the felt.
  const color = n > 0 ? '#f2ecdd' : n < 0 ? '#e2333f' : '#8a8278';
  return (
    <span className="stat-num" style={{ color }}>
      {n > 0 ? '+' : ''}
      {fmtChips(n)}
    </span>
  );
}

/** The seated user's persistent bankroll, cumulative P&L, and per-hand history. */
export function BankrollPanel({ mine, tick }: { mine: MineStatus; tick: string }) {
  const q = useQuery({
    queryKey: ['pnl', mine.agentId, tick],
    queryFn: () => api.pnl(mine.agentId),
    refetchInterval: 4000,
  });
  const d = q.data;

  return (
    <Panel
      title={<span className="font-display text-base normal-case tracking-normal text-bone">Your bankroll &amp; P&amp;L</span>}
      right={
        d ? (
          <span className="text-[11px] text-bone-faint">
            {d.handsPlayed} hand{d.handsPlayed === 1 ? '' : 's'} played
          </span>
        ) : null
      }
    >
      {d ? (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="glass-soft flex-1 px-4 py-3.5">
              <div className="label">Bankroll</div>
              <div className="mt-1.5 font-display text-3xl text-bone">{fmtChips(d.bankroll)}</div>
            </div>
            <div className="glass-soft flex-1 px-4 py-3.5">
              <div className="label">Net P&amp;L (this session)</div>
              <div className="mt-1.5 text-3xl">
                <Delta n={d.cumulative} />
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-56 overflow-auto">
            {d.log.length === 0 ? (
              <Empty>No hands yet — play one to start your log.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="label border-b border-hairline text-left">
                    <th className="py-2 pr-2 font-normal">hand</th>
                    <th className="py-2 pr-2 text-right font-normal">buy-in</th>
                    <th className="py-2 pr-2 text-right font-normal">result</th>
                    <th className="py-2 text-right font-normal">bankroll</th>
                  </tr>
                </thead>
                <tbody>
                  {d.log.map((e) => (
                    <tr key={e.handId} className="border-b border-hairline/60 transition hover:bg-noir-700/30">
                      <td className="py-2 pr-2 text-bone-dim">#{e.handNumber}</td>
                      <td className="stat-num py-2 pr-2 text-right tabular-nums text-bone-dim">{fmtChips(e.buyIn)}</td>
                      <td className="py-2 pr-2 text-right tabular-nums">
                        <Delta n={e.delta} />
                      </td>
                      <td className="stat-num py-2 text-right tabular-nums text-bone">{fmtChips(e.bankrollAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      ) : (
        <Empty>Loading your bankroll…</Empty>
      )}
    </Panel>
  );
}
