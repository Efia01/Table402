import type { ReactNode } from 'react';
import { FEE_COLOR, FEE_LABEL, feeColor } from '../lib/ui';

export function Panel({
  title,
  right,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`glass ${className}`}>
      {(title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
          <h2 className="label">{title}</h2>
          {right}
        </header>
      )}
      <div className={`p-5 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent = '#ece3d6',
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  accent?: string;
}) {
  return (
    <div className="glass-soft px-4 py-3.5">
      <div className="label">{label}</div>
      <div className="stat-num mt-1.5 text-2xl text-bone" style={{ color: accent }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs text-bone-dim">{sub}</div>}
    </div>
  );
}

export function FeeBadge({ kind }: { kind: string | null | undefined }) {
  const color = feeColor(kind);
  const label = (kind && FEE_LABEL[kind]) || kind || 'fee';
  return (
    <span
      className="chip"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function StatusDot({ ok }: { ok: boolean }) {
  const color = ok ? '#34d399' : '#c8202f';
  return (
    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wide" style={{ color }}>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: color, boxShadow: `0 0 7px -1px ${color}` }}
      />
      {ok ? 'verified' : 'unverified'}
    </span>
  );
}

export function LiveDot({ connected }: { connected: boolean }) {
  const color = connected ? '#34d399' : '#c8202f';
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest2 text-bone-dim">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? 'animate-pulseGlow' : ''}`}
        style={{ background: color, boxShadow: `0 0 7px -1px ${color}` }}
      />
      {connected ? 'live' : 'offline'}
    </span>
  );
}

export function Money({ value, className = '' }: { value: ReactNode; className?: string }) {
  return <span className={`stat-num ${className}`}>{value}</span>;
}

export function FeeLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(FEE_COLOR).map((k) => (
        <FeeBadge key={k} kind={k} />
      ))}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-bone-faint">{children}</div>;
}
