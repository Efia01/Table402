import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CardRow } from '../components/PlayingCard';
import { fmtChips } from '../components/BankrollPanel';
import { Panel, Empty } from '../components/primitives';
import { ReceiptGraph } from '../components/ReceiptGraph';
import { useClientId } from '../lib/clientId';

const BOARD_COUNT: Record<string, number> = { preflop: 0, flop: 3, turn: 4, river: 5, showdown: 5, complete: 5 };

interface HistoryAction {
  seat: number;
  type: string;
  amount: number;
  street: string;
}
interface History {
  seats: Array<{ index: number; playerId: string; name: string; stack: number }>;
  actions: HistoryAction[];
  board: string[];
  result: {
    winningSeats: number[];
    payouts: Record<number, number>;
    showdown: Array<{ seat: number; holeCards: string[]; handName?: string }>;
  };
}

export function HandReplayPage() {
  const { id = '' } = useParams();
  const clientId = useClientId();

  // Selector source: the hands this browser played since sitting down this session.
  const statusQ = useQuery({ queryKey: ['agentStatus', clientId], queryFn: () => api.agentStatus(clientId) });
  const agentId = statusQ.data?.agentId;
  const pnlQ = useQuery({ queryKey: ['pnl', agentId], queryFn: () => api.pnl(agentId!), enabled: !!agentId });
  const sessionHands = useMemo(
    () => [...(pnlQ.data?.log ?? [])].sort((a, b) => a.handNumber - b.handNumber),
    [pnlQ.data],
  );

  const handQ = useQuery({ queryKey: ['hand', id], queryFn: () => api.hand(id) });
  const resultsQ = useQuery({ queryKey: ['handResults', id], queryFn: () => api.handResults(id) });

  const hand = handQ.data?.hand;
  const history = hand?.history as History | undefined;
  const actions = history?.actions ?? [];

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Reset the scrubber whenever the selected hand changes.
  useEffect(() => {
    setStep(0);
    setPlaying(false);
  }, [id]);

  useEffect(() => {
    if (!playing) return;
    if (step >= actions.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => Math.min(s + 1, actions.length)), 650);
    return () => clearTimeout(t);
  }, [playing, step, actions.length]);

  const nameFor = (seat: number) => history?.seats.find((s) => s.index === seat)?.name ?? `Seat ${seat}`;
  const currentStreet = actions[Math.max(0, step - 1)]?.street ?? 'preflop';
  const boardShown = useMemo(
    () => (history?.board ?? []).slice(0, BOARD_COUNT[currentStreet] ?? 0),
    [history, currentStreet],
  );
  const fullBoard = history?.board ?? [];

  if (handQ.isLoading) return <Empty>Loading hand…</Empty>;
  if (!hand) return <Empty>Hand not found.</Empty>;

  return (
    <div className="space-y-6">
      {/* Header — no verified badge, no hash */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">Replay</h1>
        <Link to={`/table/${hand.tableId}`} className="btn">
          Live table →
        </Link>
      </div>

      {/* Session hand selector */}
      <div>
        <div className="label mb-2">Hands this session</div>
        {sessionHands.length ? (
          <div className="flex flex-wrap gap-2">
            {sessionHands.map((h) => {
              const active = h.handId === id;
              return (
                <Link
                  key={h.handId}
                  to={`/hands/${h.handId}`}
                  className={`rounded-[4px] border px-3.5 py-1.5 font-display text-sm transition ${
                    active
                      ? 'border-crimson/70 bg-crimson/[0.1] text-bone'
                      : 'border-hairline text-bone-dim hover:border-bone-faint hover:text-bone'
                  }`}
                >
                  Hand #{h.handNumber}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-bone-faint">
            No session hands recorded — currently viewing hand #{hand.number}.
          </div>
        )}
      </div>

      {/* ── Replay ─────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Panel title={`Board · ${currentStreet}`}>
            <div className="flex min-h-[88px] items-center gap-2">
              {boardShown.length ? (
                <CardRow cards={boardShown} size="lg" />
              ) : (
                <span className="text-sm text-bone-faint">— preflop —</span>
              )}
            </div>
            {history && (
              <div className="mt-4 flex items-center gap-2">
                <button className="btn" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                  ‹ prev
                </button>
                <button className="btn btn-primary" onClick={() => setPlaying((p) => !p)}>
                  {playing ? '❚❚ pause' : '▶ play'}
                </button>
                <button className="btn" onClick={() => setStep((s) => Math.min(actions.length, s + 1))}>
                  next ›
                </button>
                <input
                  type="range"
                  min={0}
                  max={actions.length}
                  value={step}
                  onChange={(e) => setStep(Number(e.target.value))}
                  className="ml-2 flex-1 accent-crimson"
                />
                <span className="stat-num text-xs text-bone-dim">
                  {step}/{actions.length}
                </span>
              </div>
            )}
          </Panel>

          <Panel title="Action log">
            <div className="max-h-[20rem] space-y-1 overflow-auto">
              {actions.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between rounded-[4px] px-3 py-1.5 text-sm transition ${
                    i < step ? 'bg-noir-700/50' : 'opacity-40'
                  } ${i === step - 1 ? 'ring-1 ring-crimson/50' : ''}`}
                >
                  <span className="text-bone-dim">
                    <span className="text-bone">{nameFor(a.seat)}</span> · {a.street}
                  </span>
                  <span className="stat-num uppercase tracking-wide text-bone">
                    {a.type}
                    {a.amount ? ` ${fmtChips(a.amount)}` : ''}
                  </span>
                </div>
              ))}
              {actions.length === 0 && <Empty>No action history.</Empty>}
            </div>
          </Panel>
        </div>

        {/* Showdown + P&L */}
        <div className="space-y-5">
          <Panel title="Profit & loss">
            {resultsQ.data?.results.length ? (
              <div className="space-y-1.5">
                {resultsQ.data.results.map((r) => (
                  <div key={r.agentId} className="flex items-center justify-between text-sm">
                    <span className="truncate text-bone-dim">
                      {r.name} <span className="text-bone-faint">· buy-in {fmtChips(r.buyIn)}</span>
                    </span>
                    <span
                      className="stat-num"
                      style={{ color: r.delta > 0 ? '#46b187' : r.delta < 0 ? '#c8202f' : '#766c61' }}
                    >
                      {r.delta > 0 ? '+' : ''}
                      {fmtChips(r.delta)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>No P&amp;L recorded for this hand.</Empty>
            )}
          </Panel>

          <Panel title="Showdown">
            {/* Community cards — shown alongside the players' hands */}
            {fullBoard.length > 0 && (
              <div className="mb-3 flex items-center gap-2.5 border-b border-hairline pb-3">
                <span className="label">Board</span>
                <CardRow cards={fullBoard} size="sm" />
              </div>
            )}
            {history?.result.showdown.filter((s) => s.handName).length ? (
              <div className="space-y-2">
                {history.result.showdown
                  .filter((s) => s.handName)
                  .map((s) => {
                    const won = history.result.winningSeats.includes(s.seat);
                    return (
                      <div key={s.seat} className={`glass-soft px-3 py-2 ${won ? 'border-ember/45' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-bone">
                            {won && <span className="text-ember">♔</span>}
                            {nameFor(s.seat)}
                          </span>
                          {won && <span className="chip border-ember/40 bg-ember/10 text-ember">winner</span>}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <CardRow cards={s.holeCards} size="sm" />
                          <span className="text-xs text-bone-dim">{s.handName}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <Empty>Won uncontested (no showdown).</Empty>
            )}
            {hand.commentary && (
              <div className="mt-3 rounded-[4px] border border-hairline bg-noir-700/40 p-3 text-sm text-bone-dim">
                <span className="text-ember">📣 </span>
                {hand.commentary.summary}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* ── Receipt graph for this hand (at the bottom) ────────────── */}
      <div>
        <h2 className="mb-3 font-display text-2xl font-semibold tracking-tight text-bone">Receipt graph</h2>
        <ReceiptGraph handId={id} />
      </div>
    </div>
  );
}
