import { AnimatePresence, motion } from 'framer-motion';
import type { ReceiptDTO } from '@table402/shared';
import { formatUsd, FEE_LABEL, feeColor } from '../lib/ui';
import { Panel, Empty } from './primitives';

/**
 * The seated player's own MPP spend, streamed live from the payment feed: one
 * line per micro-payment they made (seat · hand · action fee), with the running
 * wallet balance after each. This is the money leaving *your* wallet per request.
 */
export function SpendLedger({
  payments,
  agentId,
  walletBalance,
  currency,
}: {
  payments: ReceiptDTO[];
  agentId: string | null;
  walletBalance: number | null;
  currency: string;
}) {
  // My outgoing micro-payments, oldest→newest so we can accrue a running spend.
  const mine = payments.filter((p) => p.fromId === agentId).slice().reverse();
  const totalSpent = mine.reduce((sum, p) => sum + p.amount, 0);

  // Running balance: walk forward from the (now) balance + everything already spent.
  const opening = walletBalance != null ? walletBalance + totalSpent : null;
  let running = opening;

  const rows = mine.map((p) => {
    const after = running != null ? (running -= p.amount) : null;
    return { p, after };
  });

  return (
    <Panel
      title={<span className="font-display text-base normal-case tracking-normal text-bone">Your spend</span>}
      right={
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">wallet · {currency}</div>
          <div className="stat-num text-sm text-bone tabular-nums">
            {walletBalance != null ? formatUsd(walletBalance) : '—'}
          </div>
        </div>
      }
    >
      <div className="mb-3 flex items-center justify-between border-b border-hairline pb-2.5 text-xs">
        <span className="text-bone-dim">
          {mine.length} payment{mine.length === 1 ? '' : 's'} this session
        </span>
        <span className="text-bone-dim">
          total spent <span className="stat-num text-crimson-bright tabular-nums">−{formatUsd(totalSpent)}</span>
        </span>
      </div>

      <div className="max-h-60 space-y-1.5 overflow-auto pr-1">
        {rows.length === 0 ? (
          <Empty>Every fee you pay over MPP will appear here, live.</Empty>
        ) : (
          <AnimatePresence initial={false}>
            {[...rows].reverse().map(({ p, after }) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between gap-3 rounded-lg border border-hairline bg-noir-700/40 px-3 py-2 text-sm"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: feeColor(p.kind) }} />
                  <span className="min-w-0">
                    <span className="text-bone">{(p.kind && FEE_LABEL[p.kind]) || p.kind || 'fee'}</span>
                    {p.unlocks && <span className="truncate text-xs text-bone-faint"> · {p.unlocks}</span>}
                  </span>
                </span>
                <span className="flex shrink-0 items-baseline gap-3">
                  <span className="stat-num tabular-nums text-crimson-bright">−{formatUsd(p.amount)}</span>
                  {after != null && (
                    <span className="stat-num w-16 text-right tabular-nums text-bone-dim">{formatUsd(after)}</span>
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </Panel>
  );
}
