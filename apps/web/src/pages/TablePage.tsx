import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import type { SeatDTO } from '@table402/shared';
import { api } from '../lib/api';
import { useTableFeed } from '../lib/ws';
import { archetypeColor } from '../lib/ui';
import { PlayingCard, CardRow } from '../components/PlayingCard';
import { PlayerHand } from '../components/PlayerHand';
import { BankrollPanel, fmtChips } from '../components/BankrollPanel';
import { JoinTableModal } from '../components/JoinTableModal';
import { useClientId } from '../lib/clientId';
import { Panel, Empty } from '../components/primitives';

// Six seats arranged around the oval — pushed to the rail so the table
// fills the screen from edge to edge.
const SEAT_POS = [
  { left: '15%', top: '83%' },
  { left: '50%', top: '94%' },
  { left: '85%', top: '83%' },
  { left: '85%', top: '13%' },
  { left: '50%', top: '4%' },
  { left: '15%', top: '13%' },
];

function SeatPod({
  seat,
  isTurn,
  myCards,
  isYou,
}: {
  seat: SeatDTO;
  isTurn: boolean;
  myCards?: string[] | null;
  isYou?: boolean;
}) {
  const empty = !seat.agentId;
  const folded = seat.status === 'folded';
  const tone = isYou ? '#e7a23c' : archetypeColor(seat.archetype);
  // You always see your own hand face-up; everyone else is face-down.
  const cards: (string | null)[] = isYou ? (myCards ?? [null, null]) : [null, null];

  if (empty) {
    return (
      <div className="grid w-24 place-items-center rounded-[3px] border border-dashed border-hairline bg-noir-900/50 py-3 text-[10px] uppercase tracking-widest2 text-bone-faint">
        open
      </div>
    );
  }

  return (
    <motion.div
      animate={isTurn ? { scale: [1, 1.045, 1] } : { scale: 1 }}
      transition={isTurn ? { repeat: Infinity, duration: 1.7, ease: 'easeInOut' } : {}}
      className={`relative w-[8.5rem] rounded-2xl border px-3 py-2.5 text-center backdrop-blur-md transition-colors ${
        isTurn
          ? 'border-crimson shadow-glow'
          : isYou
            ? 'border-ember/55'
            : 'border-hairline'
      } ${folded ? 'opacity-40 grayscale' : ''}`}
      style={{ background: 'rgba(14,8,9,0.86)' }}
    >
      {/* Hole cards lifted above the plate */}
      <div className="mb-1.5 flex justify-center">
        <CardRow cards={cards} size={isYou ? 'md' : 'sm'} />
      </div>

      <div className="flex items-center justify-center gap-1.5">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: tone }} />
        <span className="truncate font-display text-[15px] font-semibold text-bone">{seat.agentName}</span>
        {seat.isButton && (
          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-ember/25 text-[9px] font-bold text-ember">
            D
          </span>
        )}
      </div>

      <div className="mt-0.5 flex items-center justify-center gap-1 text-[11px]">
        <span className="stat-num text-bone-dim">{fmtChips(seat.stack)}</span>
        {isYou && <span className="text-[9px] font-semibold uppercase tracking-widest2 text-ember">you</span>}
      </div>
      <div className="stat-num text-[9px] uppercase tracking-wide text-bone-faint">
        bank {fmtChips(seat.bankroll ?? 0)}
      </div>

      {seat.committed > 0 && (
        <div className="absolute -bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-[3px] border border-ember/40 bg-noir px-2 py-0.5 text-[10px] text-ember shadow-ember">
          <span className="h-1.5 w-1.5 rounded-full bg-ember" /> {fmtChips(seat.committed)}
        </div>
      )}
    </motion.div>
  );
}

function CommunitySlot({ card, index }: { card: string | null; index: number }) {
  if (card) return <PlayingCard card={card} size="xl" index={index} />;
  return (
    <div
      className="rounded-[9px] border border-dashed"
      style={{ width: 86, height: 120, borderColor: 'rgba(236,227,214,0.13)', background: 'rgba(0,0,0,0.14)' }}
    />
  );
}

// Keep the table log readable: drop the noisy MPP/system lines and strip the
// technical parentheticals (session ids, fee notes) from the rest.
const LOG_NOISE = /fee skipped|referee failed|commentary failed|escrow|could not open/i;
function cleanLog(message: string): string {
  return message
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/^📣\s*/, '')
    .trim();
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
  const mine = statusQ.data?.mine ?? null;
  // Not seated yet → the join modal gates entry (pick a table & buy-in).
  const notSeated = statusQ.isSuccess && !mine;

  const hand = feed.hand ?? detail.data?.hand ?? null;
  const refetchKey = `${hand?.handId ?? ''}:${hand?.street ?? ''}:${hand?.toActSeat ?? ''}:${hand?.board?.length ?? 0}`;
  const myViewQ = useQuery({
    queryKey: ['myview', mine?.agentId, refetchKey],
    queryFn: () => api.agentView(id, mine!.agentId),
    enabled: !!mine?.agentId,
    refetchInterval: 1500,
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

  async function leaveTable() {
    await api.stopAgent(clientId);
    await qc.invalidateQueries({ queryKey: ['agentStatus', clientId] });
    navigate('/');
  }

  return (
    <div className="space-y-5">
      {/* Header — only the table name */}
      <h1 className="font-display text-3xl font-semibold tracking-tight text-bone sm:text-4xl">
        {detail.data?.table.name ?? 'Table'}
      </h1>

      {/* Hand-review actions — sit right above the table, on the right */}
      {last && (
        <div className="flex items-center justify-end gap-2.5">
          <Link to={`/graph/${last.handId}`} className="btn btn-primary">
            Receipt graph →
          </Link>
          <Link to={`/hands/${last.handId}`} className="btn btn-primary">
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
            Replay
          </Link>
        </div>
      )}

      {/* ── The felt: full-bleed, edge to edge ───────────────────────── */}
      <div className="full-bleed px-3 sm:px-6">
        <div className="relative mx-auto h-[clamp(470px,72vh,780px)] w-full">
          {/* Rail — a rectangle with smooth, equal rounded corners */}
          <div
            className="absolute inset-0 rounded-[28px]"
            style={{
              background: 'linear-gradient(180deg, #2a1812 0%, #1a0f0b 100%)',
              boxShadow: '0 40px 90px -40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
          />
          {/* Felt */}
          <div
            className="felt absolute inset-[14px] rounded-[22px]"
            style={{ boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 0 130px rgba(0,0,0,0.6)' }}
          />

          {/* Center: community cards + pot */}
          <div className="absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 text-center">
            <div className="flex items-center justify-center" style={{ gap: 8 }}>
              {communitySlots.map((c, i) => (
                <CommunitySlot key={`${c ?? 'slot'}-${i}`} card={c} index={i} />
              ))}
            </div>
            <div className="mt-5 flex items-center justify-center">
              <div className="inline-flex items-center gap-2 rounded-[3px] border border-ember/30 bg-noir-900/70 px-4 py-1.5 backdrop-blur">
                <span className="text-[10px] uppercase tracking-widest2 text-bone-faint">Pot</span>
                <span className="stat-num text-lg text-ember text-glow">{fmtChips(hand?.pot ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Seats around the oval */}
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
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Your controls ────────────────────────────────────────────── */}
      {mine && (
        <div className="grid gap-5 lg:grid-cols-2">
          <PlayerHand tableId={id} mine={mine} refetchKey={refetchKey} />
          <BankrollPanel mine={mine} tick={feed.lastComplete?.handId ?? ''} />
        </div>
      )}

      {/* ── Action flow (kept) + outcomes, underneath the table ──────── */}
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
                          {won && <span className="text-ember">♔</span>}
                          {r.label}
                        </span>
                        <span
                          className="stat-num"
                          style={{ color: r.delta > 0 ? '#46b187' : r.delta < 0 ? '#c8202f' : '#766c61' }}
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
            <div className="max-h-48 space-y-1.5 overflow-auto text-xs leading-relaxed">
              {logs.length === 0 && <Empty>The hand will narrate here.</Empty>}
              {logs.map((l) => (
                <div
                  key={l.id}
                  className="text-bone-dim"
                  style={{ color: l.level === 'warn' ? '#e7a23c' : l.level === 'error' ? '#c8202f' : undefined }}
                >
                  {cleanLog(l.message)}
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
    </div>
  );
}

function actionColor(a: string): string {
  switch (a) {
    case 'fold':
      return '#c8202f';
    case 'check':
      return '#b3a99c';
    case 'call':
      return '#e7a23c';
    case 'bet':
    case 'raise':
      return '#46b187';
    case 'all-in':
      return '#e2334a';
    default:
      return '#ece3d6';
  }
}
