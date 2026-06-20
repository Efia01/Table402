import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { formatUsd, archetypeColor, shorten } from '../lib/ui';
import { Panel, Stat, Empty } from '../components/primitives';
import { SettlementBadge } from '../components/SettlementBadge';

export function LobbyPage() {
  const tables = useQuery({ queryKey: ['tables'], queryFn: api.tables, refetchInterval: 3000 });
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents, refetchInterval: 3000 });
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: api.discovery, refetchInterval: 30000 });

  const table = tables.data?.tables[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Lobby</h1>
          <p className="text-sm text-mute">Open tables, live pricing, the agents in the arena, and discovered services.</p>
        </div>
        <SettlementBadge />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Table card */}
        <div className="lg:col-span-2">
          {table ? (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Panel
                title="Table"
                right={
                  <span className="chip border-ok/40 bg-ok/10 text-ok">
                    {table.seatedCount}/{table.maxSeats} seated
                  </span>
                }
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xl font-semibold">{table.name}</div>
                    <div className="font-mono text-xs text-ghost">{table.id}</div>
                    <div className="mt-1 text-sm text-mute">
                      {table.handsPlayed} hands played · {table.startingChips} starting chips · blinds{' '}
                      {table.smallBlind}/{table.bigBlind}
                    </div>
                  </div>
                  <Link to={`/table/${table.id}`} className="btn btn-primary whitespace-nowrap">
                    Enter table →
                  </Link>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <Stat label="Seat fee" value={formatUsd(table.seatFee)} accent="#5eead4" />
                  <Stat label="Hand fee" value={formatUsd(table.perHandFee)} accent="#fbbf24" />
                  <Stat label="Action fee" value={formatUsd(table.perActionFee)} accent="#a3e635" />
                </div>
              </Panel>
            </motion.div>
          ) : (
            <Panel title="Table">
              <Empty>Loading table…</Empty>
            </Panel>
          )}

          {/* Agents */}
          <div className="mt-6">
            <Panel title="Agents in the arena">
              {agents.data?.agents.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {agents.data.agents.map((a) => (
                    <div key={a.id} className="glass-soft flex items-center justify-between px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold"
                          style={{ color: archetypeColor(a.archetype), background: `${archetypeColor(a.archetype)}1a` }}
                        >
                          {a.name.slice(0, 1)}
                        </span>
                        <div>
                          <div className="text-sm font-medium">{a.name}</div>
                          <div className="font-mono text-[10px] text-ghost">{shorten(a.address, 8, 6)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="stat-num text-sm text-text">${a.bankroll.toLocaleString()}</div>
                        <div className="text-[10px] uppercase tracking-wide" style={{ color: a.seated ? '#34d399' : '#5d6379' }}>
                          {a.seated ? 'seated' : 'idle'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No agents yet — run `pnpm demo`.</Empty>
              )}
            </Panel>
          </div>
        </div>

        {/* Services */}
        <div>
          <Panel
            title="Discovered services"
            right={
              <span className="text-[11px] text-ghost">
                registry:{' '}
                <span style={{ color: discovery.data?.remote === 'reachable' ? '#34d399' : '#fbbf24' }}>
                  {discovery.data?.remote ?? '…'}
                </span>
              </span>
            }
          >
            <div className="space-y-2">
              {(discovery.data?.services ?? [])
                .filter((s) => s.source === 'local')
                .map((s) => (
                  <div key={s.id} className="glass-soft px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-sm font-medium">{s.name}</div>
                      <span
                        className="chip shrink-0"
                        style={{ color: '#38e0c8', borderColor: '#38e0c855', background: '#38e0c814' }}
                      >
                        Table402
                      </span>
                    </div>
                    <div className="truncate text-xs text-mute">{s.categories.join(' · ') || s.description}</div>
                    {s.priceHint && <div className="mt-0.5 font-mono text-[11px] text-ghost">{s.priceHint}</div>}
                  </div>
                ))}
              {!discovery.data && <Empty>Discovering services…</Empty>}
            </div>
            {(() => {
              const remote = (discovery.data?.services ?? []).filter((s) => s.source !== 'local').length;
              return remote > 0 ? (
                <div className="mt-3 text-[11px] text-ghost">
                  These are the paid services the table buys each hand. +{remote} more discoverable on the public mpp.dev registry.
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-ghost">
                  The paid services the table buys each hand (RNG · referee · commentary).
                </div>
              );
            })()}
          </Panel>
        </div>
      </div>
    </div>
  );
}
