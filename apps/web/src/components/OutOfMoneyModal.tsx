import { AnimatePresence, motion } from 'framer-motion';
import { fmtChips } from './BankrollPanel';

/**
 * Shown when the seated player's bank account can no longer cover a hand.
 * Re-buy to keep playing, or cash out and return to the entrance.
 */
export function OutOfMoneyModal({
  open,
  rebuyAmount,
  onRebuy,
  onLeave,
  busy,
}: {
  open: boolean;
  rebuyAmount: number;
  onRebuy: () => void;
  onLeave: () => void;
  busy?: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] grid place-items-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-noir-900/88 backdrop-blur-md" aria-hidden />

          <motion.div
            className="glass relative z-10 w-full max-w-md overflow-hidden text-center"
            initial={{ y: 20, scale: 0.95, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 20, scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 22 }}
          >
            {/* Crimson accent across the top */}
            <div
              className="h-[3px] w-full"
              style={{ background: 'linear-gradient(90deg, transparent, #e3344b, transparent)' }}
            />

            <div className="px-9 py-10">
              <div className="text-xl tracking-[0.5em] text-crimson-bright/90">♠ ♥ ♦ ♣</div>
              <div className="mt-5 font-mono text-[11px] uppercase tracking-widest2 text-crimson-bright">
                The house collects
              </div>
              <h2 className="mt-2 font-display text-4xl font-semibold tracking-tight text-bone sm:text-5xl">
                Out of chips
              </h2>
              <p className="mx-auto mt-4 max-w-xs text-sm leading-relaxed text-bone-dim">
                Your bank account is empty — there&rsquo;s nothing left to cover the next hand. Put more
                money on the table to stay in the game.
              </p>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={onRebuy}
                  disabled={busy}
                  className="btn-hero w-full justify-center disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busy ? 'Adding chips…' : `Re-buy ${fmtChips(rebuyAmount)}`}
                </button>
                <button
                  onClick={onLeave}
                  disabled={busy}
                  className="btn w-full justify-center disabled:opacity-50"
                >
                  Cash out &amp; leave
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
