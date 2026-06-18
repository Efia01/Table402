import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DEFAULT_TABLE } from '@table402/shared';

const STEPS = [
  { k: 'Sit down', tone: '#2dd4bf', detail: 'take a seat and buy in for up to $1,000 of your bankroll' },
  { k: 'Blinds', tone: '#f5b942', detail: 'small & big blinds are posted, two hole cards are dealt' },
  { k: 'Play', tone: '#a3e635', detail: 'fold, check, call, bet & raise across preflop, flop, turn, river' },
  { k: 'Showdown', tone: '#c084fc', detail: 'best five-card hand wins the pot — your bankroll updates' },
];

const FEATURES = [
  { t: 'Real Texas Hold’em', d: 'Standard rules: blinds, four betting streets, all-ins, side pots, and exact showdown evaluation.' },
  { t: 'Persistent bankroll', d: 'You start each hand with up to $1,000 — but never more than you actually have. Win it up, or lose it.' },
  { t: 'Profit & loss log', d: 'Every hand records who won and lost how much. Watch your running balance climb or fall.' },
  { t: 'Play or autopilot', d: 'Take the decisions yourself, or flip autopilot and let your seat play itself.' },
  { t: 'Always a full table', d: 'House players fill the empty seats, so you can sit down and play a hand in seconds.' },
  { t: 'Live, real-time felt', d: 'Cards deal, chips slide, and the action streams to the table as it happens.' },
];

export function LandingPage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-edge/60 grid-bg px-6 py-14 sm:px-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-edge bg-ink-800/70 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-mute">
            <span className="h-1.5 w-1.5 rounded-full bg-neon animate-pulseGlow" />
            Real-time Texas Hold’em · testnet
          </div>
          <h1 className="text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Sit down.
            <br />
            <span className="bg-gradient-to-r from-neon via-agent to-service bg-clip-text text-transparent">
              Play your hand.
            </span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-mute">
            A live six-max poker arena. Take a seat, get your cards, and play real Texas Hold’em
            against the house. <span className="text-text">Build a bankroll — win it up or lose it,
            hand by hand — and track every dollar in your profit &amp; loss log.</span>
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to={`/table/${DEFAULT_TABLE.id}`} className="btn btn-primary">
              Sit down &amp; play →
            </Link>
            <Link to="/lobby" className="btn">
              Open the lobby
            </Link>
          </div>
        </motion.div>
      </section>

      {/* How a hand plays */}
      <section>
        <h2 className="label mb-4">How a hand plays</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.k}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="glass relative p-4"
            >
              <div className="absolute right-3 top-3 font-mono text-xs text-ghost">0{i + 1}</div>
              <div
                className="mb-2 inline-flex h-9 items-center rounded-lg border px-3 font-mono text-sm"
                style={{ color: step.tone, borderColor: `${step.tone}55`, background: `${step.tone}12` }}
              >
                {step.k}
              </div>
              <p className="text-sm text-mute">{step.detail}</p>
              {i < STEPS.length - 1 && (
                <div className="pointer-events-none absolute -right-2 top-1/2 hidden -translate-y-1/2 text-ghost sm:block">
                  →
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section>
        <h2 className="label mb-4">At the table</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((w, i) => (
            <motion.div
              key={w.t}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="glass p-5"
            >
              <h3 className="font-medium text-text">{w.t}</h3>
              <p className="mt-1.5 text-sm text-mute">{w.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="glass flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold">Your seat is waiting</h2>
          <p className="mt-1 max-w-xl text-sm text-mute">
            Buy in for up to $1,000, see your own hole cards, and play it out. Simulation chips only —
            non-redeemable, just for the fun of the game.
          </p>
        </div>
        <Link to={`/table/${DEFAULT_TABLE.id}`} className="btn btn-primary whitespace-nowrap">
          Deal me in →
        </Link>
      </section>
    </div>
  );
}
