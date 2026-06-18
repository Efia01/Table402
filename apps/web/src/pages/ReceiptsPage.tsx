import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { feeColor, formatUsd, shorten } from '../lib/ui';
import { FeeBadge, Panel, Empty } from '../components/primitives';

const KINDS = ['', 'seat-fee', 'hand-fee', 'action-fee', 'service-fee'];

export function ReceiptsPage() {
  const [kind, setKind] = useState('');
  const [agent, setAgent] = useState('');
  const [hand, setHand] = useState('');

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (kind) p.set('kind', kind);
    if (agent.trim()) p.set('agent', agent.trim());
    if (hand.trim()) p.set('hand', hand.trim());
    p.set('limit', '300');
    const s = p.toString();
    return s ? `?${s}` : '';
  }, [kind, agent, hand]);

  const receipts = useQuery({ queryKey: ['receipts', qs], queryFn: () => api.receipts(qs), refetchInterval: 4000 });
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents });

  const total = receipts.data?.receipts.reduce((s, r) => s + r.amount, 0) ?? 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Receipt explorer</h1>
          <p className="text-sm text-mute">Every settled payment on the simulated MPP ledger, persisted to SQLite.</p>
        </div>
        <div className="text-right text-sm text-mute">
          <span className="stat-num text-text">{receipts.data?.count ?? 0}</span> receipts ·{' '}
          <span className="stat-num text-text">{formatUsd(total)}</span> shown
        </div>
      </div>

      {/* Filters */}
      <Panel title="Filters">
        <div className="flex flex-wrap items-center gap-2">
          {KINDS.map((k) => (
            <button
              key={k || 'all'}
              onClick={() => setKind(k)}
              className="chip transition"
              style={{
                color: k ? feeColor(k) : kind === '' ? '#38e0c8' : '#9aa0b6',
                borderColor: kind === k ? (k ? `${feeColor(k)}aa` : '#38e0c8aa') : '#272c3e',
                background: kind === k ? (k ? `${feeColor(k)}1a` : '#38e0c81a') : 'transparent',
              }}
            >
              {k ? k.replace('-', ' ') : 'all'}
            </button>
          ))}
          <div className="ml-auto flex flex-wrap gap-2">
            <select
              value={agent}
              onChange={(e) => setAgent(e.target.value)}
              className="rounded-lg border border-edge bg-ink-700/60 px-2.5 py-1.5 text-sm"
            >
              <option value="">all agents/services</option>
              {agents.data?.agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
            <input
              value={hand}
              onChange={(e) => setHand(e.target.value)}
              placeholder="filter by hand id…"
              className="w-44 rounded-lg border border-edge bg-ink-700/60 px-2.5 py-1.5 text-sm placeholder:text-ghost"
            />
          </div>
        </div>
      </Panel>

      {/* Results */}
      <Panel title="Receipts">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="label border-b border-edge/60 text-left">
                <th className="py-2 pr-3 font-normal">kind</th>
                <th className="py-2 pr-3 font-normal">from → to</th>
                <th className="py-2 pr-3 text-right font-normal">amount</th>
                <th className="py-2 pr-3 font-normal">unlocks</th>
                <th className="py-2 pr-3 font-normal">hand</th>
                <th className="py-2 font-normal">tx</th>
              </tr>
            </thead>
            <tbody>
              {receipts.data?.receipts.map((r) => (
                <tr key={r.id} className="border-b border-edgesoft/60 hover:bg-ink-700/30">
                  <td className="py-2 pr-3">
                    <FeeBadge kind={r.kind} />
                  </td>
                  <td className="py-2 pr-3 text-mute">
                    <span className="text-text">{r.fromLabel}</span> → <span className="text-text">{r.toLabel}</span>
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="stat-num" style={{ color: feeColor(r.kind) }}>
                      {formatUsd(r.amount)}
                    </span>
                  </td>
                  <td className="max-w-[220px] truncate py-2 pr-3 text-xs text-mute">{r.unlocks ?? '—'}</td>
                  <td className="py-2 pr-3">
                    {r.handId ? (
                      <Link to={`/graph/${r.handId}`} className="link-muted font-mono text-xs">
                        {shorten(r.handId, 7, 4)}
                      </Link>
                    ) : (
                      <span className="text-ghost">—</span>
                    )}
                  </td>
                  <td className="py-2 font-mono text-[11px] text-ghost">{r.txHash ? shorten(r.txHash, 8, 6) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {receipts.data?.receipts.length === 0 && <Empty>No receipts match these filters.</Empty>}
          {!receipts.data && <Empty>Loading…</Empty>}
        </div>
      </Panel>
    </div>
  );
}
