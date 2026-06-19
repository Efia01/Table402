import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { USER_AGENT_THINK_MS } from '@table402/shared';
import { api, type MineStatus } from '../lib/api';
import { fmtChips } from './BankrollPanel';

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * The seated user's action bar — a full-width maison console pinned beneath the
 * felt: a bet slider with ½ POT / POT / ALL-IN presets and the three primary
 * Fold / Check·Call / Raise segments. All the action logic is unchanged.
 */
export function PlayerHand({
  tableId,
  mine,
  refetchKey,
  pot = 0,
}: {
  tableId: string;
  mine: MineStatus;
  refetchKey: string;
  pot?: number;
}) {
  const qc = useQueryClient();
  const [raiseTo, setRaiseTo] = useState<number | null>(null);

  const viewQ = useQuery({
    queryKey: ['myview', mine.agentId, refetchKey],
    queryFn: () => api.agentView(tableId, mine.agentId),
    refetchInterval: 1500,
  });
  const v = viewQ.data?.view ?? null;

  const act = useMutation({
    mutationFn: (a: { type: string; amount?: number }) =>
      api.submitAction(tableId, mine.agentId, a.type, a.amount),
    onSettled: () => qc.invalidateQueries({ queryKey: ['myview', mine.agentId] }),
  });

  // Reset the raise slider whenever the action context changes.
  useEffect(() => setRaiseTo(null), [refetchKey]);

  // Auto-play countdown: the moment it becomes your turn, your agent gives you a
  // fixed window to step in. We mirror that window client-side so the human sees
  // exactly how long they have before the agent decides for them.
  const [deadline, setDeadline] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // `legal` is only present mid-hand on your turn — guard every access or the
  // bar crashes (and unmounts the whole table) between hands.
  const legal = v?.legal;
  const inHand = !!v && v.isInHand;
  const isTurn = !!v && v.isTurn;
  const isBet = !!legal && legal.types.includes('bet');
  const canRaise = !!legal && (isBet || legal.types.includes('raise'));
  const canCheck = !!legal && legal.types.includes('check');
  const canCall = !!legal && legal.types.includes('call');
  const canAllIn = !!legal && legal.types.includes('all-in');

  const lo = legal?.minRaiseTo ?? 0;
  const hi = legal?.maxRaiseTo ?? 0;
  const amount = clamp(raiseTo ?? lo, lo, hi);
  const active = isTurn && !act.isPending;
  // Pot-based bet sizing for the presets. A pot-sized raise = raise BY the pot
  // measured AFTER you call → raise-to = currentBet + pot + toCall. Half-pot is
  // half that raise. Both clamp to the legal min/max. (Live pot from your view;
  // the prop is a fallback.)
  const potNow = v?.pot ?? pot;
  const potToCall = v?.toCall ?? 0;
  const potCurBet = v?.currentBet ?? 0;
  const potRaiseTo = clamp(potCurBet + potNow + potToCall, lo, hi);
  const halfPotRaiseTo = clamp(potCurBet + Math.round((potNow + potToCall) / 2), lo, hi);

  // Arm the countdown on the rising edge of our turn; disarm once we've acted or
  // the turn moves on. Setting the deadline once (rather than every poll) keeps it
  // monotonic across the 1.5s view refetches.
  useEffect(() => {
    if (active && inHand) setDeadline((d) => d ?? Date.now() + USER_AGENT_THINK_MS);
    else setDeadline(null);
  }, [active, inHand]);

  // Tick only while a deadline is armed.
  useEffect(() => {
    if (deadline == null) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(id);
  }, [deadline]);

  const remainingMs = deadline != null ? Math.max(0, deadline - now) : 0;
  const showTimer = deadline != null;
  const timerPct = clamp(remainingMs / USER_AGENT_THINK_MS, 0, 1);
  const timerSecs = Math.ceil(remainingMs / 1000);
  const timerUrgent = timerSecs <= 3;

  const statusNote = !inHand
    ? 'Seated — waiting for the next hand to be dealt.'
    : !isTurn
      ? 'Your agent is playing autonomously — waiting for your turn…'
      : null;

  return (
    <div className="full-bleed border-t border-hairline bg-noir-900/85 backdrop-blur-xl">
      {/* Auto-play countdown — your window to act before the agent decides for you */}
      {showTimer && (
        <div className="relative border-b border-hairline bg-noir-900/70">
          <div className="flex items-baseline justify-between px-4 py-2 sm:px-8">
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">
              Your move
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">
              Agent acts in{' '}
              <span
                className={`stat-num text-sm tabular-nums ${
                  timerUrgent ? 'text-crimson-bright' : 'text-bone'
                }`}
              >
                {timerSecs}s
              </span>
            </span>
          </div>
          {/* Sharp depletion bar */}
          <div className="h-0.5 w-full bg-noir-700">
            <div
              className={`h-full ${timerUrgent ? 'bg-crimson-bright' : 'bg-crimson-dark'}`}
              style={{ width: `${timerPct * 100}%`, transition: 'width 100ms linear' }}
            />
          </div>
        </div>
      )}

      {/* Bet slider + presets */}
      <div className="flex items-center gap-4 px-4 py-3 sm:px-8">
        <span className="font-mono text-[11px] uppercase tracking-widest2 text-bone-faint">Bet</span>
        <span className="stat-num w-20 shrink-0 text-sm text-bone">{fmtChips(amount)}</span>
        <input
          type="range"
          min={lo}
          max={Math.max(lo, hi)}
          value={amount}
          disabled={!canRaise}
          onChange={(e) => setRaiseTo(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-noir-600 accent-crimson-bright disabled:opacity-40"
        />
        <span className="stat-num hidden w-20 shrink-0 text-right text-sm text-bone-dim sm:block">
          {fmtChips(hi)}
        </span>
        <div className="flex shrink-0 gap-2">
          <button
            className="btn"
            disabled={!canRaise || potNow <= 0}
            onClick={() => setRaiseTo(halfPotRaiseTo)}
          >
            ½ Pot
          </button>
          <button
            className="btn"
            disabled={!canRaise || potNow <= 0}
            onClick={() => setRaiseTo(potRaiseTo)}
          >
            Pot
          </button>
          <button
            className="btn"
            disabled={!canAllIn && !canRaise}
            onClick={() => (canAllIn ? act.mutate({ type: 'all-in' }) : setRaiseTo(hi))}
          >
            All-in
          </button>
        </div>
      </div>

      {/* Fold / Check·Call / Raise */}
      <div className="flex items-stretch border-t border-hairline">
        <button
          className="act-seg border-r border-hairline text-bone hover:bg-crimson-dark/30 disabled:opacity-35"
          disabled={!active || (!inHand)}
          onClick={() => act.mutate({ type: 'fold' })}
        >
          Fold
        </button>

        <button
          className="act-seg border-r border-hairline text-bone hover:bg-noir-700 disabled:opacity-35"
          disabled={!active || (!canCheck && !canCall)}
          onClick={() => act.mutate({ type: canCheck ? 'check' : 'call' })}
        >
          {canCheck ? 'Check' : `Call ${fmtChips(legal?.callAmount ?? 0)}`}
        </button>

        <button
          className="act-seg text-paper disabled:opacity-35"
          style={{ background: active && canRaise ? '#e3344b' : 'rgba(227,52,75,0.18)' }}
          disabled={!active || !canRaise}
          onClick={() => act.mutate({ type: isBet ? 'bet' : 'raise', amount })}
        >
          {isBet ? 'Bet' : 'Raise'} {fmtChips(amount)}
        </button>
      </div>

      {statusNote && (
        <div className="border-t border-hairline px-8 py-2 text-center font-sans text-xs text-bone-faint">
          {statusNote}
          {act.isError && <span className="ml-2 text-crimson-soft">· action failed — try again</span>}
        </div>
      )}
    </div>
  );
}
