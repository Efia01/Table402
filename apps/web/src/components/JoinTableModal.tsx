import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import type { TableDTO } from '@table402/shared';
import { api } from '../lib/api';
import { useClientId } from '../lib/clientId';
import { fmtChips } from './BankrollPanel';

const NAME_KEY = 'table402.name';

/** A standard poker table-size label from the seat count. */
function tableSize(maxSeats: number): string {
  if (maxSeats <= 2) return 'Heads-up';
  if (maxSeats <= 6) return `${maxSeats}-max`;
  return 'Full ring';
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-widest2 text-bone-faint">{label}</span>
      <span className={`stat-num text-sm ${accent ? 'text-ember' : 'text-bone'}`}>{value}</span>
    </div>
  );
}

export function JoinTableModal({
  open,
  onClose,
  defaultTableId,
}: {
  open: boolean;
  onClose: () => void;
  defaultTableId?: string;
}) {
  const clientId = useClientId();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const tablesQ = useQuery({ queryKey: ['tables'], queryFn: api.tables, enabled: open });
  const statusQ = useQuery({
    queryKey: ['agentStatus', clientId],
    queryFn: () => api.agentStatus(clientId),
    enabled: open,
  });
  const bankroll = statusQ.data?.bankroll ?? 1000;

  const tables = tablesQ.data?.tables ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(defaultTableId ?? null);
  const selected: TableDTO | null =
    tables.find((t) => t.id === selectedId) ?? tables[0] ?? null;

  const [name, setName] = useState('');
  const [buyIn, setBuyIn] = useState<number>(0);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore the last-used display name.
  useEffect(() => {
    if (open) setName(localStorage.getItem(NAME_KEY) ?? '');
  }, [open]);

  // Buy-in bounds for the selected table — bring up to your bank account, capped
  // at the table's standard 100bb stack; never less than a 20bb short stack.
  const bounds = useMemo(() => {
    if (!selected) return { min: 0, max: 0, step: 10 };
    const max = Math.max(selected.bigBlind, Math.min(selected.startingChips, bankroll));
    const min = Math.min(max, selected.bigBlind * 20);
    return { min, max, step: Math.max(selected.bigBlind, 10) };
  }, [selected, bankroll]);

  // Default the buy-in to the full standard stack whenever the table changes.
  useEffect(() => {
    setBuyIn(bounds.max);
  }, [bounds.max, selected?.id]);

  if (!open) return null;

  const bb = selected && selected.bigBlind > 0 ? Math.round(buyIn / selected.bigBlind) : 0;

  async function takeSeat() {
    if (!selected || joining) return;
    setJoining(true);
    setError(null);
    localStorage.setItem(NAME_KEY, name.trim());
    try {
      // Taking a seat is always a fresh session — stand up from any prior seat
      // first so the P&L log + Net P&L reset to zero (the bankroll itself carries).
      await api.stopAgent(clientId).catch(() => {});
      const res = await api.startAgent(clientId, { name: name.trim() || undefined, buyIn });
      if (!res.ok) {
        setError(res.error ?? 'Could not take a seat. The table may be full.');
        setJoining(false);
        return;
      }
      await qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });
      // Navigate to the table; the parent closes the modal once we're seated
      // (don't call onClose() here — on the table-page gate it would bounce home).
      navigate(`/table/${selected.id}`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setJoining(false);
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 grid place-items-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-noir-900/80 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />

        <motion.div
          className="glass relative z-10 w-full max-w-3xl overflow-hidden"
          initial={{ y: 16, scale: 0.98, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 16, scale: 0.98, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-hairline px-7 py-5">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-bone">
                Take your seat
              </h2>
              <p className="mt-0.5 text-sm text-bone-dim">
                Choose a table and decide how much of your bank to bring.
              </p>
            </div>
            <div className="rounded-md border border-hairline bg-noir-900/60 px-4 py-2 text-right">
              <div className="text-[10px] uppercase tracking-widest2 text-bone-faint">Bank account</div>
              <div className="stat-num text-xl text-ember text-glow">{fmtChips(bankroll)}</div>
            </div>
          </div>

          <div className="max-h-[68vh] space-y-6 overflow-auto px-7 py-6">
            {/* Name */}
            <div>
              <label className="label">Your name at the table</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Anonymous"
                className="mt-2 w-full rounded-md border border-hairline bg-noir-700/60 px-4 py-2.5 text-bone outline-none transition placeholder:text-bone-faint focus:border-crimson/60"
              />
            </div>

            {/* Table selection */}
            <div>
              <label className="label">Choose a table</label>
              <div className="mt-2 space-y-2.5">
                {tables.length === 0 && (
                  <div className="rounded-md border border-hairline bg-noir-900/40 px-4 py-6 text-center text-sm text-bone-faint">
                    {tablesQ.isLoading ? 'Loading tables…' : 'No tables available right now.'}
                  </div>
                )}
                {tables.map((t) => {
                  const isSel = selected?.id === t.id;
                  const full = t.seatedCount >= t.maxSeats;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setSelectedId(t.id)}
                      className={`flex w-full items-center justify-between gap-4 rounded-md border px-5 py-3.5 text-left transition ${
                        isSel
                          ? 'border-crimson/70 bg-crimson/[0.08]'
                          : 'border-hairline bg-noir-800/40 hover:border-bone-faint'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-lg font-semibold text-bone">{t.name}</span>
                          <span className="chip border-hairline text-bone-dim">
                            No-Limit Hold&rsquo;em
                          </span>
                        </div>
                        <div className="mt-0.5 text-xs text-bone-dim">
                          {tableSize(t.maxSeats)} · blinds{' '}
                          <span className="stat-num text-bone">
                            {fmtChips(t.smallBlind)}/{fmtChips(t.bigBlind)}
                          </span>{' '}
                          · {t.handsPlayed} hands played
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-6">
                        <Stat label="Seated" value={`${t.seatedCount}/${t.maxSeats}`} />
                        <span
                          className={`grid h-5 w-5 place-items-center rounded-full border ${
                            isSel ? 'border-crimson bg-crimson text-paper' : 'border-bone-faint text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                        {full && !isSel && (
                          <span className="text-[10px] uppercase tracking-widest2 text-bone-faint">full</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Buy-in */}
            {selected && (
              <div>
                <div className="flex items-end justify-between">
                  <label className="label">Your buy-in</label>
                  <div className="text-right">
                    <span className="stat-num text-xl text-bone">{fmtChips(buyIn)}</span>
                    <span className="ml-2 text-xs text-bone-dim">{bb} bb</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={bounds.min}
                  max={bounds.max}
                  step={bounds.step}
                  value={buyIn}
                  onChange={(e) => setBuyIn(Number(e.target.value))}
                  className="mt-3 h-1 w-full cursor-pointer appearance-none rounded-full bg-noir-600 accent-crimson"
                />
                <div className="mt-1.5 flex justify-between text-[11px] text-bone-faint">
                  <span>min {fmtChips(bounds.min)}</span>
                  <span>
                    you bring this much each hand · capped at your bank ({fmtChips(bankroll)})
                  </span>
                  <span>max {fmtChips(bounds.max)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-crimson/40 bg-crimson/[0.08] px-4 py-2.5 text-sm text-crimson-soft">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 border-t border-hairline px-7 py-4">
            <button onClick={onClose} className="btn">
              Cancel
            </button>
            <button
              onClick={takeSeat}
              disabled={!selected || joining || selected.seatedCount >= selected.maxSeats}
              className="btn-hero disabled:cursor-not-allowed disabled:opacity-50"
            >
              {joining ? 'Taking your seat…' : 'Take your seat'}
              <span>→</span>
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
