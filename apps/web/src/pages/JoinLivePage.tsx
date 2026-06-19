import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_TABLE } from '@table402/shared';
import { useWallet } from '../lib/WalletProvider';
import { hasBurnerWallet, hasInjectedWallet, shortAddress, type WalletConnection } from '../lib/wallet';
import { useTableFeed } from '../lib/ws';
import { API_BASE } from '../lib/api';
import { fundWallet, payAndJoin, type PaidJoinResult } from '../lib/mpp';
import { useMySeat, useReleaseOnExit } from '../lib/useMySeat';
import { fmtChips } from '../components/BankrollPanel';
import { MobileActionPanel } from '../components/MobileActionPanel';
import { SpendLedger } from '../components/SpendLedger';
import { Brand } from '../components/Layout';

type Phase = 'connect' | 'funding' | 'signing' | 'seated' | 'error';

const NAME_KEY = 'table402.name';

export function JoinLivePage() {
  const [params] = useSearchParams();
  const tableId = params.get('table') ?? DEFAULT_TABLE.id;
  const wallet = useWallet();
  const { feed, send } = useTableFeed(tableId);

  const [phase, setPhase] = useState<Phase>('connect');
  const [error, setError] = useState<string | null>(null);
  const [seat, setSeat] = useState<PaidJoinResult | null>(null);
  const [name, setName] = useState('');
  const attempted = useRef(false);

  const mySeatQ = useMySeat(tableId);

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? '');
  }, []);

  useEffect(() => {
    if (!wallet.connection && !wallet.isConnecting && !hasInjectedWallet() && !hasBurnerWallet()) {
      wallet.connectBurner();
    }
  }, [wallet]);

  useEffect(() => {
    const s = mySeatQ.data;
    if (phase === 'connect' && !attempted.current && s?.seated && s.agentId) {
      attempted.current = true;
      setSeat({ ok: true, seatIndex: s.seatIndex ?? undefined, agentId: s.agentId, did: wallet.did ?? undefined });
      setPhase('seated');
    }
  }, [mySeatQ.data, phase, wallet.did]);

  const join = useCallback(
    async (connection: WalletConnection) => {
      if (attempted.current) return;
      attempted.current = true;
      const trimmed = name.trim();
      if (trimmed) localStorage.setItem(NAME_KEY, trimmed);
      try {
        setPhase('funding');
        setError(null);
        await fundWallet(API_BASE, connection.address, trimmed || undefined);
        setPhase('signing');
        const result = await payAndJoin({
          apiBase: API_BASE,
          tableId,
          client: connection.client,
          address: connection.address,
          did: connection.did,
          account: connection.account,
          name: trimmed || undefined,
        });
        if (!result.ok) {
          attempted.current = false;
          setError(result.error ?? 'The table could not seat you. It may be full.');
          setPhase('error');
          return;
        }
        setSeat(result);
        setPhase('seated');
      } catch (e) {
        attempted.current = false;
        setError(e instanceof Error ? e.message : 'Could not complete the seat-fee payment.');
        setPhase('error');
      }
    },
    [name, tableId],
  );

  const takeSeat = useCallback(async () => {
    let connection = wallet.connection;
    if (!connection) {
      connection = hasInjectedWallet() ? await wallet.connect() : wallet.connectBurner();
    }
    if (connection) void join(connection);
  }, [wallet, join]);

  function retreat() {
    send({ type: 'retreat', clientId: wallet.connection?.did ?? '' });
  }

  const seatedAndGone =
    phase === 'seated' && feed.retreat && feed.retreat.agentId === seat?.agentId && feed.retreat.mode === 'retreat';

  useReleaseOnExit(tableId, wallet.did, phase === 'seated' && !seatedAndGone);

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col px-5 py-6">
      <div className="maison-frame" />
      <header className="flex items-center justify-between">
        <Brand />
        {wallet.isConnected && wallet.address && (
          <span className="flex items-center gap-2">
            {wallet.isBurner && (
              <span className="chip border-hairline text-bone-dim">Burner</span>
            )}
            <span className="stat-num text-sm text-bone">{shortAddress(wallet.address)}</span>
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-8">
        {phase === 'connect' && (
          <div className="space-y-6 text-center">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest3 text-crimson-bright">
                Live table · {tableId}
              </span>
              <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-bone">
                Take a live seat
              </h1>
              <p className="mt-2 text-sm text-bone-dim">
                {wallet.isConnected
                  ? 'Pick your name, then take your seat — you sign the seat fee and sit down beside the agents.'
                  : wallet.isAvailable
                    ? 'Pick your name and connect your wallet to sign the seat fee and sit down.'
                    : 'No wallet needed — a burner wallet on this device signs the seat fee. Pick your name to begin.'}
              </p>
            </div>
            <div className="text-left">
              <label className="label">Your name at the table</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={24}
                placeholder="Anonymous"
                className="mt-2 w-full rounded-[3px] border border-hairline bg-noir-700/60 px-4 py-3 font-sans text-bone outline-none transition placeholder:text-bone-faint focus:border-crimson-bright/70"
              />
            </div>
            <button
              onClick={() => void takeSeat()}
              disabled={wallet.isConnecting}
              className="btn-hero w-full justify-center py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-50"
            >
              {wallet.isConnecting
                ? 'Connecting…'
                : wallet.isConnected
                  ? 'Take your seat'
                  : wallet.isAvailable
                    ? 'Connect & take your seat'
                    : 'Create burner & take your seat'}
              <span>→</span>
            </button>
            {wallet.error && <p className="text-xs text-crimson-soft">{wallet.error}</p>}
          </div>
        )}

        {(phase === 'funding' || phase === 'signing') && (
          <div className="space-y-6 text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-hairline border-t-crimson-bright" />
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-bone">
                {phase === 'funding' ? 'Funding your wallet' : 'Signing the seat fee'}
              </h1>
              <p className="mt-2 text-sm text-bone-dim">
                {phase === 'funding'
                  ? 'Topping up from the testnet faucet so you can pay.'
                  : 'Approve the signature in your wallet to settle the 402 seat fee.'}
              </p>
            </div>
            <div className="stepline">
              <Step label="Connect" done />
              <Step label="Fund" done={phase === 'signing'} active={phase === 'funding'} />
              <Step label="Sign 402" active={phase === 'signing'} />
              <Step label="Seated" />
            </div>
          </div>
        )}

        {phase === 'seated' && seat && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-emerald-400/50 bg-emerald-400/10 text-2xl text-emerald-300">
                ♠
              </div>
              <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-bone">
                {seatedAndGone ? 'Retreated' : "You're seated"}
              </h1>
              <p className="mt-1 text-sm text-bone-dim">
                {seatedAndGone
                  ? 'Session closed and escrow refunded to your wallet.'
                  : `Seat #${seat.seatIndex ?? '—'} · paid the seat fee over MPP.`}
              </p>
            </div>

            <div className="glass flex items-center justify-between px-5 py-4">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-widest3 text-crimson-bright">MPP wallet</div>
                <div className="mt-0.5 text-xs text-bone-dim">drains as you pay seat · hand · action fees</div>
              </div>
              <div className="text-right">
                <div className="stat-num text-2xl text-bone tabular-nums">{fmtUsdNum(mySeatQ.data?.walletBalance ?? 0)}</div>
                <div className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">
                  {mySeatQ.data?.currency ?? 'simUSD'}
                </div>
              </div>
            </div>

            {!seatedAndGone && seat.agentId && (
              <MobileActionPanel tableId={tableId} agentId={seat.agentId} />
            )}

            <SpendLedger
              payments={feed.payments}
              agentId={seat.agentId ?? null}
              walletBalance={mySeatQ.data?.walletBalance ?? null}
              currency={mySeatQ.data?.currency ?? 'simUSD'}
            />

            <div className="glass space-y-3 px-5 py-4">
              <Row label="Identity" value={seat.did ? truncDid(seat.did) : '—'} />
              <Row label="Seat fee" value={seat.receipt ? fmtUsd(seat.receipt.settlement.amount) : '$0.01'} />
              <Row label="Receipt" value={seat.receipt ? truncHash(seat.receipt.receiptHash) : 'minted'} />
            </div>

            <div className="glass px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="label">Live table feed</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest2 text-bone-dim">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${feed.connected ? 'animate-pulseGlow' : ''}`}
                    style={{ background: feed.connected ? '#34d399' : '#c8202f' }}
                  />
                  {feed.connected ? 'live' : 'offline'}
                </span>
              </div>
              <div className="mt-3 max-h-44 space-y-1.5 overflow-auto">
                {feed.actions.length === 0 && (
                  <div className="py-6 text-center text-xs text-bone-faint">Waiting for the next hand…</div>
                )}
                {feed.actions.slice(0, 12).map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border border-hairline bg-noir-700/40 px-3 py-1.5 text-sm"
                  >
                    <span className="truncate text-bone-dim">
                      <span className="text-bone">{a.label}</span>
                    </span>
                    <span className="stat-num uppercase tracking-wide text-bone-dim">
                      {a.action}
                      {a.amount ? ` ${fmtChips(a.amount)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {!seatedAndGone && (
              <button
                onClick={retreat}
                disabled={!feed.connected}
                className="btn w-full justify-center border-crimson/60 py-3 text-crimson-soft hover:border-crimson-bright disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tactical retreat — refund &amp; leave
              </button>
            )}
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-crimson/50 bg-crimson/10 text-2xl text-crimson-soft">
              !
            </div>
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-bone">
                Couldn&rsquo;t seat you
              </h1>
              <p className="mt-2 text-sm text-crimson-soft">{error}</p>
            </div>
            <button
              onClick={() => {
                setPhase('connect');
                setError(null);
              }}
              className="btn-hero w-full justify-center py-3.5"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      <footer className="pt-4 text-center">
        <span className="corner-label">testnet simulation · non-redeemable chips · no cash-out</span>
      </footer>
    </div>
  );
}

function Step({ label, done, active }: { label: string; done?: boolean; active?: boolean }) {
  return (
    <span
      className={`text-[11px] uppercase tracking-widest2 ${
        done ? 'text-emerald-300' : active ? 'text-crimson-bright' : 'text-bone-faint'
      }`}
    >
      {done ? '✓ ' : ''}
      {label}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="label">{label}</span>
      <span className="stat-num truncate text-sm text-bone">{value}</span>
    </div>
  );
}

function truncDid(did: string): string {
  const addr = did.split(':').pop() ?? did;
  return shortAddress(addr);
}

function truncHash(hash: string): string {
  return hash.length > 14 ? `${hash.slice(0, 8)}…${hash.slice(-4)}` : hash;
}

function fmtUsd(atomic: string): string {
  return fmtUsdNum(Number(atomic));
}

function fmtUsdNum(atomic: number): string {
  const n = atomic / 1_000_000;
  return `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
}
