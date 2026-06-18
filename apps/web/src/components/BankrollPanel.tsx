import { useQuery } from '@tanstack/react-query';
import type { MineStatus } from '../lib/api';
import { api } from '../lib/api';
import { Panel, Empty } from './primitives';

export function fmtChips(n: number): string {
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString()}`;
}

function Delta({ n }: { n: number }) {
  const color = n > 0 ? '#34d399' : n < 0 ? '#fb7185' : '#9aa0b6';
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
      title="Your bankroll & P&L"
      right={
        d ? (
          <span className="text-[11px] text-ghost">
            {d.handsPlayed} hand{d.handsPlayed === 1 ? '' : 's'} played
          </span>
        ) : null
      }
    >
      {d ? (
        <>
          <div className="flex flex-wrap gap-3">
            <div className="glass-soft flex-1 px-3.5 py-3">
              <div className="label">Bankroll</div>
              <div className="stat-num mt-1 text-2xl text-text">{fmtChips(d.bankroll)}</div>
            </div>
            <div className="glass-soft flex-1 px-3.5 py-3">
              <div className="label">Net P&amp;L (all hands)</div>
              <div className="mt-1 text-2xl">
                <Delta n={d.cumulative} />
              </div>
            </div>
          </div>

          <div className="mt-3 max-h-56 overflow-auto">
            {d.log.length === 0 ? (
              <Empty>No hands yet — play one to start your log.</Empty>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="label border-b border-edge/60 text-left">
                    <th className="py-1.5 pr-2 font-normal">hand</th>
                    <th className="py-1.5 pr-2 text-right font-normal">buy-in</th>
                    <th className="py-1.5 pr-2 text-right font-normal">result</th>
                    <th className="py-1.5 text-right font-normal">bankroll</th>
                  </tr>
                </thead>
                <tbody>
                  {d.log.map((e) => (
                    <tr key={e.handId} className="border-b border-edgesoft/50">
                      <td className="py-1.5 pr-2 text-mute">#{e.handNumber}</td>
                      <td className="stat-num py-1.5 pr-2 text-right text-mute">{fmtChips(e.buyIn)}</td>
                      <td className="py-1.5 pr-2 text-right">
                        <Delta n={e.delta} />
                      </td>
                      <td className="stat-num py-1.5 text-right text-text">{fmtChips(e.bankrollAfter)}</td>
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
