import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { feeColor, formatUsd } from '../lib/ui';
import { CardRow } from '../components/PlayingCard';
import { fmtChips } from '../components/BankrollPanel';
import { FeeBadge, Panel, StatusDot, Empty } from '../components/primitives';

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
  const handQ = useQuery({ queryKey: ['hand', id], queryFn: () => api.hand(id) });
  const receiptsQ = useQuery({ queryKey: ['handReceipts', id], queryFn: () => api.handReceipts(id) });
  const resultsQ = useQuery({ queryKey: ['handResults', id], queryFn: () => api.handResults(id) });

  const hand = handQ.data?.hand;
  const history = hand?.history as History | undefined;
  const actions = history?.actions ?? [];

  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

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

  if (handQ.isLoading) return <Empty>Loading hand…</Empty>;
  if (!hand) return <Empty>Hand not found.</Empty>;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Hand #{hand.number} replay</h1>
            {hand.refereeValid != null && <StatusDot ok={hand.refereeValid} />}
          </div>
          <div className="font-mono text-xs text-ghost">{hand.id}</div>
        </div>
        <Link to={`/graph/${hand.id}`} className="btn btn-primary">
          Receipt graph →
        </Link>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Replay */}
        <div className="lg:col-span-2 space-y-5">
          <Panel title={`Board · ${currentStreet}`}>
            <div className="flex min-h-[60px] items-center gap-2">
              {boardShown.length ? <CardRow cards={boardShown} size="lg" /> : <span className="text-sm text-ghost">— preflop —</span>}
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
                  className="ml-2 flex-1 accent-neon"
                />
                <span className="stat-num text-xs text-mute">
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
                  className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition ${
                    i < step ? 'bg-ink-700/50' : 'opacity-40'
                  } ${i === step - 1 ? 'ring-1 ring-neon/50' : ''}`}
                >
                  <span className="text-mute">
                    <span className="text-text">{nameFor(a.seat)}</span> · {a.street}
                  </span>
                  <span className="font-mono uppercase tracking-wide text-text">
                    {a.type}
                    {a.amount ? ` ${a.amount}` : ''}
                  </span>
                </div>
              ))}
              {actions.length === 0 && <Empty>No action history.</Empty>}
            </div>
          </Panel>
        </div>

        {/* Showdown + receipts */}
        <div className="space-y-5">
          <Panel title="Profit & loss">
            {resultsQ.data?.results.length ? (
              <div className="space-y-1">
                {resultsQ.data.results.map((r) => (
                  <div key={r.agentId} className="flex items-center justify-between text-sm">
                    <span className="truncate text-mute">
                      {r.name} <span className="text-ghost">· buy-in {fmtChips(r.buyIn)}</span>
                    </span>
                    <span
                      className="stat-num"
                      style={{ color: r.delta > 0 ? '#34d399' : r.delta < 0 ? '#fb7185' : '#9aa0b6' }}
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
            {history?.result.showdown.filter((s) => s.handName).length ? (
              <div className="space-y-2">
                {history.result.showdown
                  .filter((s) => s.handName)
                  .map((s) => {
                    const won = history.result.winningSeats.includes(s.seat);
                    return (
                      <div
                        key={s.seat}
                        className={`glass-soft px-3 py-2 ${won ? 'border-ok/40' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{nameFor(s.seat)}</span>
                          {won && <span className="chip border-ok/40 bg-ok/10 text-ok">winner</span>}
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <CardRow cards={s.holeCards} size="sm" />
                          <span className="text-xs text-mute">{s.handName}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <Empty>Won uncontested (no showdown).</Empty>
            )}
            {hand.commentary && (
              <div className="mt-3 rounded-lg border border-edge/60 bg-ink-700/40 p-3 text-sm">
                <span className="text-agent">📣 </span>
                {hand.commentary.summary}
              </div>
            )}
          </Panel>

          <Panel title="Receipts this hand">
            <div className="max-h-72 space-y-1.5 overflow-auto">
              {receiptsQ.data?.receipts.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border-l-2 bg-ink-700/40 px-3 py-1.5"
                  style={{ borderColor: feeColor(r.kind) }}
                >
                  <FeeBadge kind={r.kind} />
                  <span className="stat-num text-sm" style={{ color: feeColor(r.kind) }}>
                    {formatUsd(r.amount)}
                  </span>
                </div>
              ))}
              {!receiptsQ.data?.receipts.length && <Empty>—</Empty>}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
