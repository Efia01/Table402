import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { CopyAddress } from './CopyAddress';

/**
 * Shows how fees settle. In tempo-testnet mode it surfaces the on-chain signer
 * wallet (copyable + a direct Tempo explorer link) so you can prove, live, that
 * fees land on chain. In simulated mode it's a quiet label.
 */
export function SettlementBadge() {
  const q = useQuery({ queryKey: ['settlement'], queryFn: api.settlement, staleTime: 60_000 });
  const s = q.data;
  if (!s) return null;

  if (!s.onChain) {
    return (
      <span className="chip border-hairline text-bone-faint">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-bone-faint" />
        simulated ledger
      </span>
    );
  }

  return (
    <div className="glass flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
      <span className="chip border-emerald-400/50 text-emerald-300">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
        live on Tempo testnet
      </span>
      <span className="text-xs text-bone-dim">
        each player signs their own 402; the table wallet settles them on-chain
      </span>
      {s.signerAddress && <CopyAddress address={s.signerAddress} label="settler" />}
    </div>
  );
}
