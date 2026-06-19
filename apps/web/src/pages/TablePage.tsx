import { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import type { SeatDTO } from '@table402/shared';
import { api } from '../lib/api';
import { useTableFeed } from '../lib/ws';
import { archetypeColor } from '../lib/ui';
import { PlayingCard, CardRow } from '../components/PlayingCard';
import { PlayerHand } from '../components/PlayerHand';
import { BankrollPanel, fmtChips } from '../components/BankrollPanel';
import { JoinTableModal } from '../components/JoinTableModal';
import { OutOfMoneyModal } from '../components/OutOfMoneyModal';
import { useClientId } from '../lib/clientId';
import { Panel, Empty } from '../components/primitives';

// Six seats ringed around the small oval — positions are relative to the
// felt box; left/right/top/bottom pods sit just outside the rail.
const SEAT_POS = [
  { left: '6%', top: '72%' }, // lower-left
  { left: '50%', top: '106%' }, // bottom-center
  { left: '94%', top: '72%' }, // lower-right
  { left: '94%', top: '20%' }, // upper-right
  { left: '50%', top: '-9%' }, // top-center
  { left: '6%', top: '20%' }, // upper-left
];

function BlindBadge({ kind }: { kind: 'SB' | 'BB' }) {
  return (
    <span className="absolute -right-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full border border-crimson-bright/70 bg-noir-900 font-mono text-[8px] font-bold tracking-tight text-crimson-bright shadow-panel">
      {kind}
    </span>
  );
}

function SeatPod({
  seat,
  isTurn,
  myCards,
  isYou,
  blind,
  lastAction,
}: {
  seat: SeatDTO;
  isTurn: boolean;
  myCards?: string[] | null;
  isYou?: boolean;
  blind?: 'SB' | 'BB' | null;
  lastAction?: string | null;
}) {
  const empty = !seat.agentId;
  const folded = seat.status === 'folded';
  const tone = isYou ? '#e3344b' : archetypeColor(seat.archetype);
  // You always see your own hand face-up; everyone else is face-down.
  const cards: (string | null)[] = isYou ? (myCards ?? [null, null]) : [null, null];
  const initial = (seat.agentName ?? '?').trim().charAt(0).toUpperCase() || '?';

  if (empty) {
    return (
      <div className="grid w-24 place-items-center rounded-[3px] border border-dashed border-hairline bg-noir-900/50 py-3 font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">
        open
      </div>
    );
  }

  return (
    <motion.div
      animate={isTurn ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={isTurn ? { repeat: Infinity, duration: 1.7, ease: 'easeInOut' } : {}}
      className="relative"
    >
      {/* Hole cards lifted above the plate */}
      <div
        className={`absolute left-1/2 z-0 flex -translate-x-1/2 justify-center ${folded ? 'opacity-30 grayscale' : ''}`}
        style={{ bottom: 'calc(100% - 14px)' }}
      >
        <CardRow cards={cards} size={isYou ? 'lg' : 'sm'} />
      </div>

      {/* The name plate — a sharp maison box */}
      <div
        className={`relative z-10 flex w-[9.5rem] items-center gap-2.5 rounded-[3px] border px-3 py-2 backdrop-blur-md transition-colors ${
          isTurn || isYou ? 'border-crimson-bright' : 'border-hairline'
        } ${folded ? 'opacity-45 grayscale' : ''}`}
        style={{
          background: 'rgba(18,11,12,0.9)',
          boxShadow: isTurn ? '0 0 26px -6px rgba(227,52,75,0.6)' : undefined,
        }}
      >
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border font-display text-sm text-bone"
          style={{ borderColor: tone, background: 'rgba(0,0,0,0.35)' }}
        >
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <span className="truncate font-display text-[15px] font-semibold text-bone">{seat.agentName}</span>
            {isYou && (
              <span className="font-display text-[11px] italic text-bone-dim">· you</span>
            )}
          </div>
          <div className="stat-num text-[12px] text-bone-dim">{fmtChips(seat.stack)}</div>
        </div>

        {/* Dealer button / blind badge */}
        {seat.isButton ? (
          <span className="absolute -right-2.5 -top-2.5 grid h-5 w-5 place-items-center rounded-full bg-paper font-mono text-[9px] font-bold text-noir-900 shadow-panel">
            D
          </span>
        ) : blind ? (
          <BlindBadge kind={blind} />
        ) : null}
      </div>

      {/* Current bet + last action below the plate */}
      <div className="absolute left-1/2 top-[calc(100%+7px)] -translate-x-1/2 whitespace-nowrap">
        {folded ? (
          <span className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">Fold</span>
        ) : seat.committed > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="stat-num text-[11px] text-bone">{fmtChips(seat.committed)}</span>
            {lastAction && (
              <span className="font-mono text-[10px] uppercase tracking-widest2 text-crimson-bright">{lastAction}</span>
            )}
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

// Undealt community cards show as face-down maison backs, matching the design.
function CommunitySlot({ card, index }: { card: string | null; index: number }) {
  return <PlayingCard card={card} size="xl" index={index} />;
}

// Keep the table log readable: drop the noisy MPP/system lines and strip the
// technical parentheticals (session ids, fee notes) from the rest.
const LOG_NOISE = /fee skipped|referee failed|commentary failed|escrow|could not open/i;
function ReplayIcon() {
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
    >
      <path d="M3 3v5h5" />
      <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
    </svg>
  );
}

function cleanLog(message: string): string {
  return message
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^📣\s*/, '')
    .trim();
}

// A run of board cards as they appear in commentary, e.g. "2s 6s 8c 8d Ac".
const BOARD_RE = /Board:\s*((?:[2-9TJQKA][shdc])(?:\s+[2-9TJQKA][shdc])*)/;

// Render a log line, turning its "Board: …" card codes into real mini cards.
function LogLine({ message }: { message: string }) {
  const m = message.match(BOARD_RE);
  if (!m || m.index == null) return <>{message}</>;
  const cards = m[1].split(/\s+/);
  const before = message.slice(0, m.index); // text before "Board:"
  const after = message.slice(m.index + m[0].length); // text after the cards
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 align-middle">
      <span>{before}</span>
      <span className="label !text-bone-faint">Board</span>
      <CardRow cards={cards} size="sm" />
      <span>{after}</span>
    </span>
  );
}

export function TablePage() {
  const { id = '' } = useParams();
  const clientId = useClientId();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ['table', id], queryFn: () => api.table(id), refetchInterval: 4000 });
  const feed = useTableFeed(id);

  const statusQ = useQuery({
    queryKey: ['agentStatus', clientId],
    queryFn: () => api.agentStatus(clientId),
    refetchInterval: 2500,
  });
  // "Mine" only counts on the room I'm actually seated in — viewing another room
  // shows the join gate so I can take a seat there.
  const rawMine = statusQ.data?.mine ?? null;
  const mine = rawMine && (!rawMine.tableId || rawMine.tableId === id) ? rawMine : null;
  // Not seated here yet → the join modal gates entry (pick a table & buy-in).
  const notSeated = statusQ.isSuccess && !mine;

  const hand = feed.hand ?? detail.data?.hand ?? null;
  const refetchKey = `${hand?.handId ?? ''}:${hand?.street ?? ''}:${hand?.toActSeat ?? ''}:${hand?.board?.length ?? 0}`;
  // Hole cards are fixed for a whole hand, so key only by the hand id — keying by
  // street/toActSeat churned the cache on every action and flashed the card backs.
  // keepPreviousData holds the last cards on screen across any refetch.
  const myViewQ = useQuery({
    queryKey: ['myview', mine?.agentId, hand?.handId ?? ''],
    queryFn: () => api.agentView(id, mine!.agentId),
    enabled: !!mine?.agentId,
    refetchInterval: 1500,
    placeholderData: keepPreviousData,
  });
  const myCards = myViewQ.data?.view?.isInHand ? myViewQ.data.view.holeCards : null;
  const seats: SeatDTO[] =
    hand?.seats && hand.seats.length
      ? Array.from({ length: detail.data?.table.maxSeats ?? 6 }, (_, i) => {
          const s = hand.seats.find((x) => x.index === i);
          return (
            s ?? (detail.data?.seats.find((x) => x.index === i) as SeatDTO) ?? ({ index: i, agentId: null } as SeatDTO)
          );
        })
      : (detail.data?.seats ?? []);

  const board = hand?.board ?? [];
  const communitySlots: (string | null)[] = Array.from({ length: 5 }, (_, i) => board[i] ?? null);
  const last = feed.lastComplete;
  const logs = feed.logs.filter((l) => !LOG_NOISE.test(l.message));

  // Derive the small/big-blind seats from the button, for the seat badges.
  const occupied = seats
    .filter((s) => s.agentId)
    .map((s) => s.index)
    .sort((a, b) => a - b);
  const blinds: Record<number, 'SB' | 'BB'> = {};
  if (hand && occupied.length >= 2) {
    const bi = occupied.indexOf(hand.buttonSeat);
    if (bi >= 0) {
      const heads = occupied.length === 2;
      blinds[occupied[(bi + (heads ? 0 : 1)) % occupied.length]] = 'SB';
      blinds[occupied[(bi + (heads ? 1 : 2)) % occupied.length]] = 'BB';
    }
  }
  // Latest non-blind action verb per seat (feed.actions is newest-first).
  const lastActionBySeat: Record<number, string> = {};
  for (const a of feed.actions) {
    if (!(a.seat in lastActionBySeat) && a.action !== 'post-blind') lastActionBySeat[a.seat] = a.action;
  }

  // ── Out of money: if your bank can't cover a hand, prompt a re-buy or exit. ──
  const bankroll = statusQ.data?.bankroll ?? 0;
  const bigBlind = detail.data?.table.bigBlind ?? 10;
  const rebuyAmount = detail.data?.table.startingChips ?? 1000;
  const broke = !!mine && statusQ.isSuccess && bankroll < bigBlind && !myViewQ.data?.view?.isInHand;
  const [rebuying, setRebuying] = useState(false);
  async function handleRebuy() {
    setRebuying(true);
    try {
      await api.rebuy(clientId, rebuyAmount);
      await qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });
    } finally {
      setRebuying(false);
    }
  }

  async function leaveTable() {
    await api.stopAgent(clientId);
    await qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });
    navigate('/');
  }

  return (
    <div className="space-y-5">
      {/* Viewport-fit play area — every seat + the action bar visible without scrolling */}
      <div className="flex flex-col" style={{ height: 'calc(100vh - 7rem)', minHeight: 460 }}>
      {/* Slim toolbar — table name + hand-review actions */}
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[10px] uppercase tracking-widest3 text-bone-faint">Maison de Jeu</span>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-bone">
            {detail.data?.table.name ?? 'Table'}
          </h1>
        </div>
        <div className="flex items-center gap-2.5">
          {last ? (
            <Link to={`/hands/${last.handId}`} className="btn btn-primary">
              <ReplayIcon /> Replay
            </Link>
          ) : (
            <span className="btn btn-primary cursor-not-allowed opacity-40" title="Available after the first hand finishes">
              <ReplayIcon /> Replay
            </span>
          )}
        </div>
      </div>

      {/* ── The felt: a small round oval, filling the remaining height ── */}
      <div className="full-bleed relative flex min-h-0 flex-1 items-center justify-center px-4">
        {/* The oval — sized by HEIGHT so it (and every seat) always fits above
            the action bar, on any screen, with no scrolling. */}
        <div className="relative max-w-[94vw]" style={{ height: 'min(40vh, 430px)', aspectRatio: '2.35 / 1' }}>
          {/* Wooden rail */}
          <div
            className="absolute inset-0"
            style={{
              borderRadius: '50%',
              background: 'linear-gradient(180deg, #5a3624 0%, #3a2014 52%, #24130c 100%)',
              boxShadow: '0 60px 120px -50px rgba(0,0,0,0.95), inset 0 2px 3px rgba(255,255,255,0.14)',
            }}
          />
          {/* Felt */}
          <div
            className="felt absolute inset-[16px]"
            style={{ borderRadius: '50%', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08), inset 0 0 120px rgba(0,0,0,0.55)' }}
          />
          {/* Inner betting ring */}
          <div
            className="pointer-events-none absolute inset-[11%]"
            style={{ borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }}
          />

          {/* Center watermark */}
          <div className="pointer-events-none absolute left-1/2 top-[22%] -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="script text-3xl text-bone/25 sm:text-4xl">
              {detail.data?.table.name ?? 'Table 402'}
            </div>
            <div className="mt-1 font-mono text-[9px] uppercase tracking-widest3 text-bone/20">Maison de Jeu</div>
          </div>

          {/* Pot */}
          <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="font-mono text-[10px] uppercase tracking-widest3 text-bone-dim">Le Pot</div>
            <div className="mt-1 font-display text-4xl font-semibold text-bone sm:text-5xl">
              {fmtChips(hand?.pot ?? 0)}
            </div>
          </div>

          {/* Community cards */}
          <div className="absolute left-1/2 top-[66%] -translate-x-1/2 -translate-y-1/2">
            <div className="flex items-center justify-center" style={{ gap: 10 }}>
              {communitySlots.map((c, i) => (
                <CommunitySlot key={`${c ?? 'slot'}-${i}`} card={c} index={i} />
              ))}
            </div>
          </div>

          {/* Seats ringed around the oval */}
          {seats.map((seat) => (
            <div
              key={seat.index}
              className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
              style={SEAT_POS[seat.index] ?? { left: '50%', top: '50%' }}
            >
              <SeatPod
                seat={seat}
                isTurn={hand?.toActSeat === seat.index}
                isYou={mine?.seatIndex === seat.index}
                myCards={mine?.seatIndex === seat.index ? myCards : null}
                blind={blinds[seat.index] ?? null}
                lastAction={lastActionBySeat[seat.index] ?? null}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Your action bar — sits at the bottom of the play area ────── */}
      {mine && (
        <div className="shrink-0">
          <PlayerHand tableId={id} mine={mine} refetchKey={refetchKey} pot={hand?.pot ?? 0} />
        </div>
      )}
      </div>
      {/* ── end viewport-fit play area ── */}

      {/* ── Bankroll + action flow + outcomes, underneath the table ──── */}
      {mine && (
        <div className="pt-2">
          <BankrollPanel mine={mine} tick={feed.lastComplete?.handId ?? ''} />
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Action flow" right={<span className="text-[11px] text-bone-faint">live</span>}>
            <div className="max-h-72 space-y-1.5 overflow-auto pr-1">
              <AnimatePresence initial={false}>
                {feed.actions.length === 0 && <Empty key="e">No actions yet.</Empty>}
                {feed.actions.map((a) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center justify-between rounded-lg border border-hairline bg-noir-700/40 px-3 py-1.5 text-sm"
                  >
                    <span className="text-bone-dim">
                      <span className="text-bone">{a.label}</span> · {a.street}
                    </span>
                    <span className="stat-num uppercase tracking-wide" style={{ color: actionColor(a.action) }}>
                      {a.action}
                      {a.amount ? ` ${fmtChips(a.amount)}` : ''}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          {last && last.results.length > 0 && (
            <Panel title="Last hand">
              {last.board.length > 0 && (
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="label">Board</span>
                  <CardRow cards={last.board} size="sm" />
                </div>
              )}
              <div className="space-y-1.5">
                {[...last.results]
                  .sort((a, b) => b.delta - a.delta)
                  .map((r) => {
                    const won = last.winners.some((w) => w.seat === r.seat);
                    return (
                      <div key={r.seat} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 truncate text-bone-dim">
                          {won && <span className="text-crimson-bright">♔</span>}
                          {r.label}
                        </span>
                        <span
                          className="stat-num"
                          style={{ color: r.delta > 0 ? '#f2ecdd' : r.delta < 0 ? '#e2333f' : '#8a8278' }}
                        >
                          {r.delta > 0 ? '+' : ''}
                          {fmtChips(r.delta)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </Panel>
          )}

          <Panel title="Table log">
            <div className="max-h-64 space-y-2 overflow-auto text-xs leading-relaxed">
              {logs.length === 0 && <Empty>The hand will narrate here.</Empty>}
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="border-b border-hairline/60 pb-2 text-bone-dim last:border-0 last:pb-0"
                  style={{ color: l.level === 'warn' ? '#c9c1b0' : l.level === 'error' ? '#e2333f' : undefined }}
                >
                  <LogLine message={cleanLog(l.message)} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {mine && (
        <div className="flex justify-end">
          <button onClick={() => void leaveTable()} className="btn text-bone-dim">
            Leave table
          </button>
        </div>
      )}

      {/* Join gate — pick a table & buy-in before you can play. */}
      <JoinTableModal open={notSeated} onClose={() => navigate('/')} defaultTableId={id} />

      {/* Out of money — re-buy to keep playing, or cash out and go home. */}
      <OutOfMoneyModal
        open={broke}
        rebuyAmount={rebuyAmount}
        busy={rebuying}
        onRebuy={() => void handleRebuy()}
        onLeave={() => void leaveTable()}
      />
    </div>
  );
}

function actionColor(a: string): string {
  switch (a) {
    case 'fold':
      return '#8a8278'; // ash
    case 'check':
      return '#c9c1b0'; // cream-dim
    case 'call':
      return '#d8cdb6'; // glow-dim
    case 'bet':
    case 'raise':
      return '#b5232e'; // rouge-dim
    case 'all-in':
      return '#e2333f'; // rouge
    default:
      return '#f2ecdd'; // cream
  }
}
