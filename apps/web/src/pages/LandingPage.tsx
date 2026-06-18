import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { DEFAULT_TABLE } from '@table402/shared';

export function LandingPage() {
  return (
    <section className="spotlight-stage relative flex min-h-screen w-screen flex-col items-center justify-center overflow-hidden px-4 text-center">
      {/* Overhead lamp + beam */}
      <div className="spotlight-lamp animate-flicker" />
      <div className="spotlight-beam" />

      {/* Eyebrow — a quiet line of suit pips */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="relative z-10 mb-7 flex items-center gap-3 text-bone-faint"
      >
        <span className="h-px w-10 bg-gradient-to-r from-transparent to-hairline" />
        <span className="text-[15px] tracking-[0.2em] text-crimson/80">♠ ♥ ♦ ♣</span>
        <span className="label !text-bone-faint">No-Limit Texas Hold&rsquo;em</span>
        <span className="h-px w-10 bg-gradient-to-l from-transparent to-hairline" />
      </motion.div>

      {/* The headline — lit from above, filling the screen */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10"
      >
        <h1
          className="headline-lit select-none whitespace-nowrap font-display font-bold uppercase leading-[0.86] tracking-[0.015em]"
          style={{ fontSize: 'min(17vw, 24vh, 15rem)' }}
        >
          Table402
        </h1>
        {/* Faint reflection on the felt below (absolute — no layout cost) */}
        <div
          aria-hidden
          className="headline-lit pointer-events-none absolute left-0 right-0 top-full -mt-1 select-none whitespace-nowrap text-center font-display font-bold uppercase leading-[0.86] tracking-[0.015em] opacity-[0.06]"
          style={{
            fontSize: 'min(17vw, 24vh, 15rem)',
            transform: 'scaleY(-1)',
            WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 42%)',
            maskImage: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent 42%)',
          }}
        >
          Table402
        </div>
      </motion.div>

      {/* The one call to action */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="relative z-10 mt-9"
      >
        <Link to={`/table/${DEFAULT_TABLE.id}`} className="btn-hero group">
          Get seated
          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
        </Link>
      </motion.div>
    </section>
  );
}
