import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/lobby', label: 'Lobby', end: false },
  { to: '/receipts', label: 'Ledger', end: false },
];

export function Brand() {
  return (
    <span className="font-display text-xl font-semibold tracking-tight text-bone">
      Table<span className="text-crimson">402</span>
    </span>
  );
}

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-40 border-b border-hairline bg-noir/55 backdrop-blur-xl">
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
                  `rounded-[3px] px-3.5 py-1.5 text-[11px] uppercase tracking-widest2 transition ${
                    isActive ? 'text-crimson' : 'text-bone-faint hover:text-bone'
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

      <footer className="border-t border-hairline px-5 py-4 text-center">
        <span className="corner-label">Table402 · testnet simulation · non-redeemable chips · no cash-out</span>
      </footer>
    </div>
  );
}
