import { useWallet } from '../lib/WalletProvider';
import { shortAddress } from '../lib/wallet';

export function WalletButton() {
  const { isConnected, isAvailable, isConnecting, address, did, error, connect, disconnect } =
    useWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div
          className="rounded-[3px] border border-hairline bg-noir-900/60 px-4 py-1.5 text-right"
          title={did ?? undefined}
        >
          <div className="font-mono text-[10px] uppercase tracking-widest2 text-bone-faint">
            Identity
          </div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            <span className="stat-num text-sm text-bone">{shortAddress(address)}</span>
          </div>
        </div>
        <button onClick={disconnect} className="btn">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={() => connect()}
        disabled={!isAvailable || isConnecting}
        className="btn-hero disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isConnecting ? 'Connecting…' : 'Connect wallet'}
        <span>→</span>
      </button>
      {!isAvailable && (
        <span className="text-[11px] text-bone-faint">No Web3 wallet detected</span>
      )}
      {error && <span className="text-[11px] text-crimson-soft">{error}</span>}
    </div>
  );
}
