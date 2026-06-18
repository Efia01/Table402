import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import type { SeatDTO } from '@table402/shared';
import { api } from '../lib/api';
import { useTableFeed } from '../lib/ws';
import { archetypeColor, feeColor, formatUsd } from '../lib/ui';
import { CardRow } from '../components/PlayingCard';
import { ControlPanel } from '../components/ControlPanel';
import { PlayerHand } from '../components/PlayerHand';
import { BankrollPanel, fmtChips } from '../components/BankrollPanel';
import { useClientId } from '../lib/clientId';
import { FeeBadge, LiveDot, Panel, Empty } from '../components/primitives';

const SEAT_POS = [
  { left: '16%', top: '80%' },
  { left: '50%', top: '90%' },
  { left: '84%', top: '80%' },
  { left: '84%', top: '16%' },
  { left: '50%', top: '6%' },
  { left: '16%', top: '16%' },
];

function SeatPod({
  seat,
  isTurn,
  revealCards,
  isYou,
}: {
  seat: SeatDTO;
  isTurn: boolean;
  revealCards?: string[] | null;
  isYou?: boolean;
}) {
  const empty = !seat.agentId;
  const folded = seat.status === 'folded';
  const tone = isYou ? '#2dd4bf' : archetypeColor(seat.archetype);
  const cards = revealCards ?? seat.holeCards ?? [null, null];
  return (
    <motion.div
      animate={isTurn ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={isTurn ? { repeat: Infinity, duration: 1.6 } : {}}
      className={`w-36 rounded-xl border px-3 py-2 text-center backdrop-blur ${
        isTurn ? 'border-neon shadow-glow' : isYou ? 'border-agent/60' : 'border-edge/70'
      } ${folded ? 'opacity-40' : ''}`}
      style={{ background: 'rgba(10,12,18,0.82)' }}
    >
      {empty ? (
        <div className="py-2 text-xs text-ghost">empty seat</div>
      ) : (
        <>
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: tone }} />
            <span className="truncate text-sm font-medium">{seat.agentName}</span>
            {isYou && <span className="text-[9px] font-bold uppercase tracking-wide text-agent">you</span>}
            {seat.isButton && (
              <span className="ml-1 grid h-4 w-4 place-items-center rounded-full bg-tabletone/20 text-[9px] font-bold text-tabletone">
                D
              </span>
            )}
          </div>
          <div className="stat-num mt-0.5 text-xs text-mute">{seat.stack} chips</div>
          <div className="stat-num text-[10px] text-ghost">bank {fmtChips(seat.bankroll ?? 0)}</div>
          <div className="mt-1 flex justify-center">
            <CardRow cards={cards} size="sm" />
          </div>
          {seat.committed > 0 && (
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-tabletone/15 px-2 py-0.5 text-[10px] text-tabletone">
              <span className="h-1.5 w-1.5 rounded-full bg-tabletone" /> {seat.committed}
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

export function TablePage() {
  const { id = '' } = useParams();
  const clientId = useClientId();
  const detail = useQuery({ queryKey: ['table', id], queryFn: () => api.table(id), refetchInterval: 4000 });
  const feed = useTableFeed(id);

  const statusQ = useQuery({
    queryKey: ['agentStatus', clientId],
    queryFn: () => api.agentStatus(clientId),
    refetchInterval: 2500,
  });
  const mine = statusQ.data?.mine ?? null;

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
      ? // map hand seats into a full ring keyed by seat index
        Array.from({ length: detail.data?.table.maxSeats ?? 6 }, (_, i) => {
          const s = hand.seats.find((x) => x.index === i);
          return (
            s ?? (detail.data?.seats.find((x) => x.index === i) as SeatDTO) ?? ({ index: i, agentId: null } as SeatDTO)
          );
        })
      : (detail.data?.seats ?? []);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.data?.table.name ?? 'Table'}</h1>
          <div className="text-sm text-mute">
            {hand ? (
              <>
                Hand #{hand.number} · <span className="capitalize text-text">{hand.street}</span> · pot{' '}
                <span className="stat-num text-tabletone">{hand.pot}</span> chips
              </>
            ) : (
              'Waiting for the next hand…'
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LiveDot connected={feed.connected} />
          {feed.lastComplete && (
            <>
              <Link to={`/graph/${feed.lastComplete.handId}`} className="btn btn-primary">
                Receipt graph →
              </Link>
              <Link to={`/hands/${feed.lastComplete.handId}`} className="btn">
                Replay
              </Link>
            </>
          )}
        </div>
      </div>

      <ControlPanel />

      {mine && (
        <div className="grid gap-5 lg:grid-cols-2">
          <PlayerHand tableId={id} mine={mine} refetchKey={refetchKey} />
          <BankrollPanel mine={mine} tick={feed.lastComplete?.handId ?? ''} />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Felt */}
        <div className="lg:col-span-2">
          <div className="relative aspect-[16/10] w-full overflow-hidden rounded-[2rem] border border-edge/70 shadow-panel">
            <div
              className="absolute inset-6 rounded-[3rem] border border-[#1c3b33]"
              style={{
                background:
                  'radial-gradient(ellipse at center, #114036 0%, #0c2a24 55%, #08201b 100%)',
                boxShadow: 'inset 0 0 80px rgba(0,0,0,0.6)',
              }}
            />
            {/* center: board + pot */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
              <div className="flex min-h-[56px] items-center justify-center gap-1.5">
                {hand && hand.board.length > 0 ? (
                  <CardRow cards={hand.board} size="md" />
                ) : (
                  <span className="text-xs text-emerald-200/40">— community cards —</span>
                )}
              </div>
              {hand && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-tabletone/30 bg-black/30 px-3 py-1">
                  <span className="h-2 w-2 rounded-full bg-tabletone" />
                  <span className="stat-num text-sm text-tabletone">{hand.pot}</span>
                  <span className="text-[11px] text-emerald-100/60">pot</span>
                </div>
              )}
            </div>
            {/* seats */}
            {seats.map((seat) => (
              <div
                key={seat.index}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={SEAT_POS[seat.index] ?? { left: '50%', top: '50%' }}
              >
                <SeatPod
                  seat={seat}
                  isTurn={hand?.toActSeat === seat.index}
                  isYou={mine?.seatIndex === seat.index}
                  revealCards={mine?.seatIndex === seat.index ? myCards : null}
                />
              </div>
            ))}
          </div>

          {/* Action feed */}
          <div className="mt-5">
            <Panel title="Action feed">
              <div className="max-h-56 space-y-1.5 overflow-auto">
                <AnimatePresence initial={false}>
                  {feed.actions.length === 0 && <Empty key="e">No actions yet.</Empty>}
                  {feed.actions.map((a) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between rounded-lg bg-ink-700/40 px-3 py-1.5 text-sm"
                    >
                      <span className="text-mute">
                        <span className="text-text">{a.label}</span> · {a.street}
                      </span>
                      <span className="font-mono uppercase tracking-wide" style={{ color: actionColor(a.action) }}>
                        {a.action}
                        {a.amount ? ` ${a.amount}` : ''}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </Panel>
          </div>
        </div>

        {/* Right column: payment feed + log */}
        <div className="space-y-5">
          <Panel
            title="Payment feed"
            right={<span className="text-[11px] text-ghost">simUSD over MPP</span>}
          >
            <div className="max-h-[22rem] space-y-1.5 overflow-auto">
              <AnimatePresence initial={false}>
                {feed.payments.length === 0 && <Empty key="e">Payments will stream here.</Empty>}
                {feed.payments.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: -8, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className="rounded-lg border-l-2 bg-ink-700/40 px-3 py-2"
                    style={{ borderColor: feeColor(p.kind) }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <FeeBadge kind={p.kind} />
                      <span className="stat-num text-sm" style={{ color: feeColor(p.kind) }}>
                        {formatUsd(p.amount)}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs text-mute">
                      <span className="text-text">{p.fromLabel}</span> → <span className="text-text">{p.toLabel}</span>
                    </div>
                    {p.unlocks && <div className="truncate text-[11px] text-ghost">unlocks: {p.unlocks}</div>}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </Panel>

          {feed.lastComplete && feed.lastComplete.results.length > 0 && (
            <Panel title={`Last hand · who won & lost`}>
              <div className="space-y-1">
                {[...feed.lastComplete.results]
                  .sort((a, b) => b.delta - a.delta)
                  .map((r) => (
                    <div key={r.seat} className="flex items-center justify-between text-sm">
                      <span className="truncate text-mute">{r.label}</span>
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
            </Panel>
          )}

          <Panel title="Table log">
            <div className="max-h-56 space-y-1 overflow-auto text-xs">
              {feed.logs.length === 0 && <Empty>—</Empty>}
              {feed.logs.map((l) => (
                <div key={l.id} className="text-mute" style={{ color: l.level === 'warn' ? '#fbbf24' : l.level === 'error' ? '#fb7185' : undefined }}>
                  {l.message}
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function actionColor(a: string): string {
  switch (a) {
    case 'fold':
      return '#fb7185';
    case 'check':
      return '#9aa0b6';
    case 'call':
      return '#38bdf8';
    case 'bet':
    case 'raise':
      return '#a3e635';
    case 'all-in':
      return '#f5b942';
    default:
      return '#e8eaf3';
  }
}
