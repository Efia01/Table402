import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/lobby', label: 'Lobby', end: false },
  { to: '/receipts', label: 'Receipts', end: false },
];

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative grid h-8 w-8 place-items-center rounded-lg border border-neon/40 bg-neon/10 shadow-glow">
        <span className="font-mono text-[13px] font-bold text-neon">402</span>
      </div>
      <div className="leading-tight">
        <div className="font-semibold tracking-tight">
          Table<span className="text-neon">402</span>
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-ghost">agentic poker · mpp</div>
      </div>
    </div>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-edge/60 bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <NavLink to="/">
            <Brand />
          </NavLink>
          <nav className="flex items-center gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1.5 text-sm transition ${
                    isActive ? 'bg-neon/10 text-neon' : 'text-mute hover:bg-ink-700/60 hover:text-text'
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-5 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-edge/50 px-5 py-4 text-center text-[11px] text-ghost">
        Testnet simulation · non-redeemable simulation chips · powered by the Machine Payments Protocol
      </footer>
    </div>
  );
}
