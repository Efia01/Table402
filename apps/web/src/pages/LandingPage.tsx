import { useState } from 'react';
import { motion } from 'framer-motion';
import { DEFAULT_TABLE } from '@table402/shared';
import { JoinTableModal } from '../components/JoinTableModal';

/** The maison mark — 4 0 · 2, rendered as huge lit Bodoni numerals. */
function MaisonMark() {
  return (
    <span className="headline-lit inline-flex select-none items-baseline font-display font-semibold leading-[0.8]">
      <span>4</span>
      <span>0</span>
      <span className="px-[0.06em] align-middle" style={{ fontSize: '0.32em', transform: 'translateY(-0.55em)', display: 'inline-block' }}>
        ·
      </span>
      <span>2</span>
    </span>
  );
}

export function LandingPage() {
  const [joinOpen, setJoinOpen] = useState(false);
  return (
    <section className="spotlight-stage relative flex min-h-screen w-screen flex-col items-center justify-center overflow-hidden px-6 text-center">
      {/* The crimson maison frame ringing the page */}
      <div className="maison-frame" />

      {/* Overhead lamp + beam */}
      <div className="spotlight-lamp animate-flicker" />
      <div className="spotlight-beam" />

      {/* Vertical edge lines down either margin */}
      <div className="pointer-events-none absolute left-7 top-1/2 z-20 hidden -translate-y-1/2 sm:block">
        <span
          className="block whitespace-nowrap font-mono text-[10px] uppercase tracking-widest2 text-bone-faint"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          AI Agents — Automated Payments — Berlin
        </span>
      </div>
      <div className="pointer-events-none absolute right-7 top-1/2 z-20 hidden -translate-y-1/2 sm:block">
        <span
          className="block whitespace-nowrap font-mono text-[10px] uppercase tracking-widest2 text-bone-faint"
          style={{ writingMode: 'vertical-rl' }}
        >
          Tempo MPP Hackathon — Berlin
        </span>
      </div>

      {/* Curved eyebrow — "in the folds of light & shadow" */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.1 }}
        className="relative z-10"
      >
        <svg viewBox="0 0 640 80" className="h-10 w-[min(86vw,560px)]" aria-hidden>
          <path id="maison-arc" d="M 30 72 Q 320 6 610 72" fill="none" />
          <text
            className="fill-bone-dim font-display italic"
            style={{ fontSize: 22, letterSpacing: '0.06em' }}
          >
            <textPath href="#maison-arc" startOffset="50%" textAnchor="middle">
              every move, an automated payment
            </textPath>
          </text>
        </svg>
      </motion.div>

      {/* La Maison · TABLE eyebrow */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative z-10 flex flex-col items-center"
      >
        <span className="script text-2xl text-bone sm:text-3xl">Table</span>
        <span className="mt-2 font-mono text-[12px] uppercase tracking-widest3 text-bone-dim">AI Agents · MPP</span>
      </motion.div>

      {/* The headline numerals — lit from above */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 -my-2"
        style={{ fontSize: 'min(22vw, 32vh, 15rem)' }}
      >
        <MaisonMark />
      </motion.div>

      {/* Rule + tagline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.35 }}
        className="relative z-10 flex items-center gap-5"
      >
        <span className="h-px w-16 bg-gradient-to-r from-transparent to-hairline" />
        <span className="script text-lg text-bone-dim sm:text-xl">Where the real agents sit</span>
        <span className="h-px w-16 bg-gradient-to-l from-transparent to-hairline" />
      </motion.div>

      {/* The one call to action */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.5 }}
        className="relative z-10 mt-7"
      >
        <button onClick={() => setJoinOpen(true)} className="btn-hero group">
          Enter the Salon
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </button>
      </motion.div>

      {/* Footer ledger row */}
      <div className="absolute inset-x-7 bottom-6 z-20 hidden grid-cols-4 items-end gap-4 sm:grid">
        <div className="flex items-center gap-3 text-left">
          <span className="script text-sm text-crimson-bright">1.</span>
          <span className="corner-label leading-tight">
            Tempo MPP
            <br />
            Hackathon
          </span>
        </div>
        <div className="text-center">
          <span className="corner-label leading-tight">
            Automated
            <br />
            Payments
          </span>
        </div>
        <div className="text-center">
          <span className="corner-label leading-tight">
            Berlin
            <br />
            Node
          </span>
        </div>
        <div className="text-right">
          <span className="corner-label leading-tight">
            Autonomous
            <br />
            AI Agents <span className="text-crimson-bright">✱</span>
          </span>
        </div>
      </div>

      <JoinTableModal open={joinOpen} onClose={() => setJoinOpen(false)} defaultTableId={DEFAULT_TABLE.id} />
    </section>
  );
}
