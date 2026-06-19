import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import type { SeatDTO, TableDTO } from '@table402/shared';
import { api } from '../lib/api';
import { useClientId } from '../lib/clientId';
import { formatUsd, archetypeColor, shorten } from '../lib/ui';
import { fmtChips } from '../components/BankrollPanel';
import { Panel, Stat, Empty } from '../components/primitives';

const NAME_KEY = 'table402.name';

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 transition-transform duration-200"
      style={{ transform: open ? 'rotate(180deg)' : 'none' }}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

// One table in the lobby — collapsed to a summary row, toggled open to reveal
// the players currently seated at it and how much each has in play.
function TableCard({
  table,
  seats,
  onSeat,
  seating,
}: {
  table: TableDTO;
  seats?: SeatDTO[];
  onSeat: (t: TableDTO) => void;
  seating: boolean;
}) {
  const [open, setOpen] = useState(false);
  const players = (seats ?? []).filter((s) => s.agentId);
  const full = table.seatedCount >= table.maxSeats;

  return (
    <section className="glass overflow-hidden">
      {/* Summary header — the label toggles the card; the seat button sits beside it */}
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="-my-2 flex min-w-0 flex-1 items-center gap-3 py-2 text-left transition hover:opacity-90"
        >
          <Chevron open={open} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-lg font-semibold">{table.name}</span>
              <span className="chip border-ok/40 bg-ok/10 text-ok">
                {table.seatedCount}/{table.maxSeats} seated
              </span>
            </div>
            <div className="mt-0.5 text-xs text-mute">
              {table.handsPlayed} hands · {table.startingChips} chips · blinds {table.smallBlind}/
              {table.bigBlind}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => {
            if (!full && !seating) onSeat(table);
          }}
          disabled={full || seating}
          className="btn btn-primary shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50"
        >
          {full ? 'Full' : seating ? 'Seating…' : 'Get seated →'}
        </button>
      </div>

      {/* Expanded detail — only the players at THIS table */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-hairline px-5 py-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="label">Players at this table</span>
                <span className="font-mono text-[10px] uppercase tracking-widest2 text-ghost">
                  {players.length} seated
                </span>
              </div>
              {players.length ? (
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {players.map((p) => {
                    const tone = archetypeColor(p.archetype);
                    return (
                      <div
                        key={p.index}
                        className="glass-soft flex items-center justify-between px-3 py-2"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
                          <span className="truncate text-sm text-text">{p.agentName}</span>
                          {p.isButton && (
                            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-paper text-[8px] font-bold text-noir-900">
                              D
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="stat-num text-xs text-text">{fmtChips(p.stack)}</div>
                          <div className="font-mono text-[9px] uppercase tracking-widest2 text-ghost">
                            in play
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-bone-faint">No players seated yet.</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

export function LobbyPage() {
  const clientId = useClientId();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tables = useQuery({ queryKey: ['tables'], queryFn: api.tables, refetchInterval: 3000 });
  const agents = useQuery({ queryKey: ['agents'], queryFn: api.agents, refetchInterval: 3000 });
  const discovery = useQuery({ queryKey: ['discovery'], queryFn: api.discovery, refetchInterval: 30000 });
  const status = useQuery({ queryKey: ['agentStatus', clientId], queryFn: () => api.agentStatus(clientId) });

  const tableList = tables.data?.tables ?? [];
  // Fees are identical across tables, so they're shown once, above the list.
  const fees = tableList[0];

  // Pull each table's seats so we can list its players underneath the card.
  const details = useQueries({
    queries: tableList.map((t) => ({
      queryKey: ['table', t.id],
      queryFn: () => api.table(t.id),
      refetchInterval: 4000,
    })),
  });
  const seatsByTable = new Map<string, SeatDTO[]>();
  tableList.forEach((t, i) => {
    const d = details[i]?.data;
    if (d) seatsByTable.set(t.id, d.seats);
  });

  // Clicking "Get seated" takes the seat directly and goes to the table — no
  // intermediary table-picker (the table is already chosen here in the lobby).
  const [seatingId, setSeatingId] = useState<string | null>(null);
  async function seatDirectly(t: TableDTO) {
    setSeatingId(t.id);
    try {
      const bankroll = status.data?.bankroll ?? t.startingChips;
      const buyIn = Math.max(t.bigBlind, Math.min(t.startingChips, bankroll));
      const name = localStorage.getItem(NAME_KEY)?.trim() || undefined;
      // Fresh session — stand up from any prior seat first.
      await api.stopAgent(clientId).catch(() => {});
      await api.startAgent(clientId, { tableId: t.id, buyIn, name });
      await qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });
    } catch {
      // Fall through — the table page's join gate will catch any failure.
    } finally {
      setSeatingId(null);
      navigate(`/table/${t.id}`);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Lobby</h1>
        <p className="text-sm text-mute">Open tables, live pricing, the agents in the arena, and discovered services.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tables */}
        <div className="space-y-6 lg:col-span-2">
          {/* Shared house fees — identical for every table */}
          <Panel title="House fees" right={<span className="text-[11px] text-ghost">same for all tables</span>}>
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Seat fee" value={fees ? formatUsd(fees.seatFee) : '—'} accent="#c9c1b0" />
              <Stat label="Hand fee" value={fees ? formatUsd(fees.perHandFee) : '—'} accent="#8a8278" />
              <Stat label="Action fee" value={fees ? formatUsd(fees.perActionFee) : '—'} accent="#e2333f" />
            </div>
          </Panel>

          <div className="flex items-center justify-between">
            <span className="label">Open tables</span>
            <span className="font-mono text-[11px] text-ghost">
              {tableList.length} {tableList.length === 1 ? 'table' : 'tables'}
            </span>
          </div>

          {tableList.length ? (
            tableList.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <TableCard
                  table={t}
                  seats={seatsByTable.get(t.id)}
                  onSeat={seatDirectly}
                  seating={seatingId === t.id}
                />
              </motion.div>
            ))
          ) : (
            <Panel title="Tables">
              <Empty>{tables.isError ? 'Could not load tables.' : 'Loading tables…'}</Empty>
            </Panel>
          )}

          {/* Agents */}
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
                      <div className="text-[10px] uppercase tracking-wide" style={{ color: a.seated ? '#c9c1b0' : '#8a8278' }}>
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

        {/* Services */}
        <div>
          <Panel
            title="Discovered services"
            right={
              <span className="text-[11px] text-ghost">
                registry:{' '}
                <span style={{ color: discovery.data?.remote === 'reachable' ? '#f2ecdd' : '#8a8278' }}>
                  {discovery.data?.remote ?? '…'}
                </span>
              </span>
            }
          >
            <div className="space-y-2">
              {discovery.data?.services.slice(0, 16).map((s) => (
                <div key={s.id} className="glass-soft px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="truncate text-sm font-medium">{s.name}</div>
                    <span
                      className="chip shrink-0"
                      style={{
                        color: s.source === 'local' ? '#c9c1b0' : '#8a8278',
                        borderColor: s.source === 'local' ? '#c9c1b055' : '#8a827855',
                        background: s.source === 'local' ? '#c9c1b014' : '#8a827814',
                      }}
                    >
                      {s.source}
                    </span>
                  </div>
                  <div className="truncate text-xs text-mute">{s.categories.join(' · ') || s.description}</div>
                  {s.priceHint && <div className="mt-0.5 font-mono text-[11px] text-ghost">{s.priceHint}</div>}
                </div>
              ))}
              {!discovery.data && <Empty>Discovering services…</Empty>}
            </div>
            <div className="mt-3 text-[11px] text-ghost">
              Local services always available; remote entries pulled from mpp.dev when reachable.
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
